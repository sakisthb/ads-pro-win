import { createHash } from 'node:crypto';
import { z } from 'zod';

export const GOOGLE_REPAIR_RECORD_TYPE='google_repair_v1';
const id=z.string().regex(/^\d{1,20}$/);
const reason=z.string().trim().min(10).max(1000);
const destination=z.string().max(2048).superRefine((raw,ctx)=>{
  try { const u=new URL(raw); if(u.protocol!=='https:' || !['bagtobag.com.gr','www.bagtobag.com.gr'].includes(u.hostname) || u.username || u.password || u.port || u.hash) throw new Error(); }
  catch {ctx.addIssue({code:z.ZodIssueCode.custom,message:'Use a canonical HTTPS BagToBag destination without credentials, port or fragment'});}
});
const urls=z.array(destination).min(1).max(1);
const pin=z.enum(['HEADLINE_1','HEADLINE_2','HEADLINE_3','DESCRIPTION_1','DESCRIPTION_2']);
const asset=(max:number)=>z.object({text:z.string().trim().min(1).refine(x=>Array.from(x).length<=max,`Maximum ${max} characters`),pinnedField:pin.optional()}).strict();
const headlines=z.array(asset(30)).min(3).max(15);
const descriptions=z.array(asset(90)).min(2).max(4);
const patch=z.object({finalUrls:urls.optional(),headlines:headlines.optional(),descriptions:descriptions.optional()}).strict().refine(x=>Object.keys(x).length>0,'Supply at least one repaired field');
export const repairRequestSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('rsa_update'),campaignId:id,adGroupId:id,adId:id,reason,patch}).strict(),
  z.object({kind:z.literal('keyword_pause'),campaignId:id,adGroupId:id,criterionId:id,reason}).strict(),
  z.object({kind:z.literal('keyword_destination'),campaignId:id,adGroupId:id,criterionId:id,reason,finalUrls:urls}).strict(),
  z.object({kind:z.literal('sitelink_pause'),campaignId:id,assetId:id,reason}).strict(),
]);
export type RepairRequest=z.infer<typeof repairRequestSchema>;
export const repairStateSchema=z.object({resourceName:z.string().min(1).max(250),campaignStatus:z.string(),adGroupStatus:z.string().optional(),status:z.string(),type:z.string(),
  finalUrls:z.array(z.string()).default([]),finalMobileUrls:z.array(z.string()).default([]),headlines:z.array(asset(30)).default([]),descriptions:z.array(asset(90)).default([]),
  negative:z.boolean().optional(),keyword:z.object({text:z.string(),matchType:z.string()}).strict().optional(),linkText:z.string().optional(),description1:z.string().optional(),description2:z.string().optional(),
}).strict();
export type RepairState=z.infer<typeof repairStateSchema>;
export const repairScopeSchema=z.object({brandId:z.string().min(1),adAccountId:z.string().min(1),customerId:id}).strict();
const frozenSchema=z.object({scope:repairScopeSchema,createdBy:z.string(),createdAt:z.string().datetime(),expiresAt:z.string().datetime(),request:repairRequestSchema,before:repairStateSchema,desired:repairStateSchema}).strict();
const executionState=z.enum(['prepared','executing','verified','blocked','provider_unknown','readback_mismatch']);
const attemptSchema=z.object({actorId:z.string(),at:z.string().datetime(),message:z.string().max(1000),providerMayHaveChanged:z.boolean()}).strict();
export const repairPreviewSchema=frozenSchema.extend({schemaVersion:z.literal(1),hash:z.string().regex(/^[a-f0-9]{64}$/),state:executionState,
  attempt:attemptSchema.nullable(),events:z.array(attemptSchema.extend({state:executionState}).strict()).max(100).default([]),
}).strict();
export type RepairPreview=z.infer<typeof repairPreviewSchema>;
export function repairContentHash(p:z.infer<typeof frozenSchema>):string {
  const parsed=frozenSchema.parse(p);
  return createHash('sha256').update(JSON.stringify(parsed)).digest('hex');
}
export function assertRepairFresh(expiresAt:string,now=new Date()) {
  const t=Date.parse(expiresAt); if(!Number.isFinite(t)||t<=now.getTime()) throw new Error('Repair preview expired; prepare a fresh exact preview');
}
export function desiredRepairState(request:RepairRequest,before:RepairState):RepairState {
  if(!['ENABLED','PAUSED'].includes(before.campaignStatus)||!['ENABLED','PAUSED'].includes(before.status)) throw new Error('Removed or unsupported target');
  let desired:RepairState;
  switch(request.kind) {
    case 'rsa_update':
      if(before.type!=='RESPONSIVE_SEARCH_AD') throw new Error('Only existing responsive Search ads can be edited');
      desired={...before,...request.patch};break;
    case 'keyword_pause':case 'keyword_destination':
      if(before.type!=='KEYWORD'||before.negative!==false) throw new Error('Only positive existing keywords can be repaired');
      desired=request.kind==='keyword_pause'?{...before,status:'PAUSED'}:{...before,finalUrls:request.finalUrls};break;
    case 'sitelink_pause':
      if(before.type!=='SITELINK') throw new Error('Only this campaign sitelink association can be paused');
      desired={...before,status:'PAUSED'};break;
  }
  if(JSON.stringify(before)===JSON.stringify(desired)) throw new Error('No effective repair; current fields already match');
  return repairStateSchema.parse(desired);
}
export function buildRepairMutation(request:RepairRequest,before:RepairState) {
  desiredRepairState(request,before);
  switch(request.kind) {
    case 'rsa_update': {
      const {finalUrls,...copy}=request.patch;
      const mask=[...(finalUrls?['final_urls']:[]),...(copy.headlines?['responsive_search_ad.headlines']:[]),...(copy.descriptions?['responsive_search_ad.descriptions']:[])];
      return {service:'ads',operation:{update:{resourceName:before.resourceName,...(finalUrls?{finalUrls}:{}),...(Object.keys(copy).length?{responsiveSearchAd:copy}:{})},updateMask:mask.join(',')}};
    }
    case 'keyword_pause':return {service:'adGroupCriteria',operation:{update:{resourceName:before.resourceName,status:'PAUSED'},updateMask:'status'}};
    case 'keyword_destination':return {service:'adGroupCriteria',operation:{update:{resourceName:before.resourceName,finalUrls:request.finalUrls},updateMask:'final_urls'}};
    case 'sitelink_pause':return {service:'campaignAssets',operation:{update:{resourceName:before.resourceName,status:'PAUSED'},updateMask:'status'}};
  }
}
