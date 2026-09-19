/** @jest-environment node */
import { repairRequestSchema, desiredRepairState, buildRepairMutation, repairContentHash, assertRepairFresh, type RepairState } from '../google-repair';

const before: RepairState = { resourceName:'customers/1111111111/ads/111', campaignStatus:'ENABLED', adGroupStatus:'PAUSED', status:'ENABLED', type:'RESPONSIVE_SEARCH_AD', finalUrls:['https://bagtobag.com.gr/old/'], finalMobileUrls:[], headlines:[{text:'Fixture one',pinnedField:'HEADLINE_1'},{text:'Fixture two'},{text:'Fixture three'}], descriptions:[{text:'Fixture description one'},{text:'Fixture description two'}] };
const request = { kind:'rsa_update' as const, campaignId:'222', adGroupId:'333', adId:'111', reason:'Repair obsolete destination', patch:{finalUrls:['https://bagtobag.com.gr/wallet-portofolia/']} };
const networkRequest = { kind:'campaign_network_update' as const, campaignId:'222', reason:'Remove unmeasured Display expansion', targetContentNetwork:false as const };
const networkBefore = { resourceName:'customers/1111111111/campaigns/222', campaignStatus:'ENABLED', status:'ENABLED', type:'SEARCH_CAMPAIGN', finalUrls:[], finalMobileUrls:[], headlines:[], descriptions:[], networkSettings:{ targetGoogleSearch:true, targetSearchNetwork:true, targetContentNetwork:true, targetPartnerSearchNetwork:false } } as unknown as RepairState;

it('permits only bounded repair kinds and rejects campaign activation, budgets, extra fields and empty patches',()=>{
  expect(repairRequestSchema.safeParse(request).success).toBe(true);
  for(const invalid of [{...request,kind:'campaign_activate'},{...request,budget:20},{...request,patch:{}},{...request,patch:{status:'ENABLED'}}]) expect(repairRequestSchema.safeParse(invalid).success).toBe(false);
});
it.each(['http://bagtobag.com.gr/','https://other.example/','https://bagtobag.com.gr.evil.example/','https://user:pass@bagtobag.com.gr/','https://bagtobag.com.gr:444/','https://bagtobag.com.gr/#x','https://127.0.0.1/'])('rejects unsafe or foreign destination %s',url=>expect(repairRequestSchema.safeParse({...request,patch:{finalUrls:[url]}}).success).toBe(false));
it('rejects insufficient, overlong or output-only RSA assets',()=>{
  for(const patch of [{headlines:[{text:'one'}]},{descriptions:[{text:'a'.repeat(91)},{text:'two'}]},{headlines:[{text:'one',assetPerformanceLabel:'GOOD'},{text:'two'},{text:'three'}]}]) expect(repairRequestSchema.safeParse({...request,patch}).success).toBe(false);
});
it('preserves mobile URLs, copy, pinning and paused parents during a destination-only repair',()=>{
  const desired=desiredRepairState(repairRequestSchema.parse(request),before);
  expect(desired).toEqual({...before,finalUrls:request.patch.finalUrls});
  expect(buildRepairMutation(repairRequestSchema.parse(request),before)).toEqual({service:'ads',operation:{update:{resourceName:before.resourceName,finalUrls:request.patch.finalUrls},updateMask:'final_urls'}});
});
it('does not edit legacy call ads, removed objects or negative keywords through the RSA/keyword repair paths',()=>{
  expect(()=>desiredRepairState(repairRequestSchema.parse(request),{...before,type:'CALL_AD'})).toThrow();
  expect(()=>desiredRepairState(repairRequestSchema.parse(request),{...before,status:'REMOVED'})).toThrow();
  expect(()=>desiredRepairState(repairRequestSchema.parse({kind:'keyword_pause',campaignId:'222',adGroupId:'333',criterionId:'444',reason:'Non brand relevance repair'}),{...before,type:'KEYWORD',negative:true})).toThrow();
});
it('pauses one positive keyword without enabling campaigns or changing keyword text/match type',()=>{
  const q=repairRequestSchema.parse({kind:'keyword_pause',campaignId:'222',adGroupId:'333',criterionId:'444',reason:'Non brand relevance repair'});
  const state={...before,resourceName:'customers/1111111111/adGroupCriteria/333~444',type:'KEYWORD',negative:false,keyword:{text:'fixture',matchType:'BROAD'}};
  expect(desiredRepairState(q,state)).toEqual({...state,status:'PAUSED'});
  expect(buildRepairMutation(q,state)).toEqual({service:'adGroupCriteria',operation:{update:{resourceName:state.resourceName,status:'PAUSED'},updateMask:'status'}});
});
it('pauses only the campaign sitelink association, never the shared asset',()=>{
  const q=repairRequestSchema.parse({kind:'sitelink_pause',campaignId:'222',assetId:'555',reason:'Unverified dated sale claim'});
  expect(buildRepairMutation(q,{...before,type:'SITELINK',resourceName:'customers/1111111111/campaignAssets/222~555~SITELINK'})).toEqual({service:'campaignAssets',operation:{update:{resourceName:'customers/1111111111/campaignAssets/222~555~SITELINK',status:'PAUSED'},updateMask:'status'}});
});
it('allows only a one-way Search campaign repair that disables Content Network and preserves every other campaign field',()=>{
  const parsed=repairRequestSchema.parse(networkRequest);
  const desired=desiredRepairState(parsed,networkBefore);
  expect(desired).toEqual({...networkBefore,networkSettings:{...networkBefore.networkSettings,targetContentNetwork:false}});
  expect(buildRepairMutation(parsed,networkBefore)).toEqual({service:'campaigns',operation:{update:{resourceName:networkBefore.resourceName,networkSettings:{targetContentNetwork:false}},updateMask:'network_settings.target_content_network'}});
  expect(repairRequestSchema.safeParse({...networkRequest,targetContentNetwork:true}).success).toBe(false);
  expect(repairRequestSchema.safeParse({...networkRequest,budget:20}).success).toBe(false);
});
it('binds preview integrity to scope, author, timestamps, request, before and desired fields',()=>{
  const p={scope:{brandId:'fixture-brand',adAccountId:'fixture-account',customerId:'1111111111'},createdBy:'fixture-owner',createdAt:'2026-09-17T12:00:00Z',expiresAt:'2026-09-17T12:10:00Z',request:repairRequestSchema.parse(request),before,desired:desiredRepairState(repairRequestSchema.parse(request),before)};
  expect(repairContentHash(p)).toMatch(/^[a-f0-9]{64}$/);
  expect(repairContentHash({...p,scope:{...p.scope,customerId:'2222222222'}})).not.toBe(repairContentHash(p));
});
it('expires prepared previews and rejects malformed timestamps instead of silently reusing consent',()=>{
  expect(()=>assertRepairFresh('2026-09-17T12:10:00Z',new Date('2026-09-17T12:09:59Z'))).not.toThrow();
  expect(()=>assertRepairFresh('2026-09-17T12:10:00Z',new Date('2026-09-17T12:10:00Z'))).toThrow();
  expect(()=>assertRepairFresh('bad',new Date())).toThrow();
});
