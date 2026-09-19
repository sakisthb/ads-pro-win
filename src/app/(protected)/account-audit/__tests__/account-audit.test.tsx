import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountAuditPage from "../page";
import { api } from "@/components/providers/trpc-provider";
import { GoogleResearchDesk } from "@/components/audit/google-research-desk";
import { GoogleRepairDesk } from '@/components/audit/google-repair-desk';
import { GoogleHygieneDesk } from '@/components/audit/google-hygiene-desk';
import { GoogleHistoryImport } from '@/components/audit/google-history-import';
jest.mock('@/components/audit/google-repair-desk',()=>({GoogleRepairDesk:jest.fn(()=> <div data-testid='google-repair-desk'/>)}));
jest.mock('@/components/audit/google-hygiene-desk',()=>({GoogleHygieneDesk:jest.fn(()=> <div data-testid='google-hygiene-desk'/>)}));
jest.mock('@/components/audit/google-history-import',()=>({GoogleHistoryImport:jest.fn(()=> <div data-testid='google-history-import'/>)}));

jest.mock("@/components/providers/trpc-provider", () => ({api:{marketing:{
  getCampaignPerformance:{useQuery:jest.fn()},getCampaignReportAccounts:{useQuery:jest.fn()},
},onboarding:{getBrandContext:{useQuery:jest.fn()}},researchMemory:{list:{useQuery:jest.fn(()=>({data:[],isLoading:false}))}}}}));
jest.mock("@/hooks/use-active-brand", () => ({useActiveBrand:()=>({brandId:"brand-1",brands:[{id:"brand-1",name:"Fixture shop"}],setBrandId:jest.fn(),isLoading:false})}));
jest.mock("@/hooks/use-active-market", () => ({useActiveMarket:()=>({market:"all"})}));
jest.mock("@/components/brands/desk-filters",()=>({DeskFilterRow:()=>null}));
jest.mock("recharts",()=>({ResponsiveContainer:()=>null,BarChart:()=>null,Bar:()=>null,XAxis:()=>null,YAxis:()=>null,Tooltip:()=>null,CartesianGrid:()=>null}));
jest.mock("@/components/audit/google-research-desk",()=>({GoogleResearchDesk:jest.fn(()=> <div>Google research fixture</div>)}));
jest.mock("@/components/audit/campaign-study-desk",()=>({CampaignStudyDesk:jest.fn(()=> <div>Campaign study fixture</div>)}));
jest.mock("@/components/audit/proposals-desk",()=>({ProposalsDesk:jest.fn(()=> <div>Proposals fixture</div>)}));

const query = api.marketing.getCampaignPerformance.useQuery;
const accounts = api.marketing.getCampaignReportAccounts.useQuery;
const businessContext = api.onboarding.getBrandContext.useQuery;

it('shows the evidence-gated adaptation review for Google only and removes it on platform switch', async () => {
  render(<AccountAuditPage />);
  expect(screen.getByRole('region', { name: 'Campaign adaptation review' })).toHaveTextContent('Unverified');
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Platform' }), 'meta');
  expect(screen.queryByRole('region', { name: 'Campaign adaptation review' })).not.toBeInTheDocument();
});

it("mounts the Google research/review workflow only for the exact selected valid Google audit scope",()=>{
  render(<AccountAuditPage/>);
  expect(GoogleResearchDesk).toHaveBeenCalledWith(expect.objectContaining({brandId:"brand-1",adAccountId:"account-google",market:"all",goal:"sales",comparison:{mode:"previous"}}),undefined);
  expect(GoogleRepairDesk).toHaveBeenCalledWith(expect.objectContaining({brandId:'brand-1',adAccountId:'account-google'}),undefined);
  expect(GoogleHygieneDesk).toHaveBeenCalledWith(expect.objectContaining({brandId:'brand-1',adAccountId:'account-google'}),undefined);
});

it("loads the selected completed preset and historical baseline with unchanged owned scope", async()=>{
  render(<AccountAuditPage/>);
  await userEvent.selectOptions(screen.getByRole("combobox",{name:"Audit period"}),"year");
  await userEvent.selectOptions(screen.getByRole("combobox",{name:"Comparison period"}),"year_2");
  const start=(screen.getByLabelText("Start date (UTC)") as HTMLInputElement).value;
  const inputs=jest.mocked(query).mock.calls.map(c=>c[0] as {adAccountId:string;startDate:string;endDate:string});
  expect(inputs.at(-1)?.startDate.slice(0,4)).toBe(String(Number(start.slice(0,4))-2));
  expect(inputs.at(-1)?.adAccountId).toBe("account-google");
  expect(screen.getByRole("region",{name:"KPI definitions and availability"})).toHaveTextContent("Purchase-only ROAS");
  expect(screen.getByRole("button",{name:"Campaign activation locked"})).toBeDisabled();
});
it('mounts historical imports only for the exact valid selected Google account and periods', async () => {
  render(<AccountAuditPage />);
  expect(GoogleHistoryImport).toHaveBeenCalledWith(expect.objectContaining({ brandId: 'brand-1', adAccountId: 'account-google',
    current: expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }), baseline: expect.objectContaining({ startDate: expect.any(String), endDate: expect.any(String) }) }), undefined);
  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Platform' }), 'meta');
  expect(screen.queryByTestId('google-history-import')).not.toBeInTheDocument();
});
it("rejects overlapping custom baselines and disables both reporting queries and export", async()=>{
  render(<AccountAuditPage/>);
  await userEvent.selectOptions(screen.getByRole("combobox",{name:"Comparison period"}),"custom");
  fireEvent.change(screen.getByLabelText("Baseline start date (UTC)"),{target:{value:(screen.getByLabelText("Start date (UTC)") as HTMLInputElement).value}});
  fireEvent.change(screen.getByLabelText("Baseline end date (UTC)"),{target:{value:(screen.getByLabelText("End date (UTC)") as HTMLInputElement).value}});
  expect(screen.getByRole("alert")).toHaveTextContent("baseline");
  expect(query).toHaveBeenLastCalledWith(expect.anything(),expect.objectContaining({enabled:false}));
  expect(screen.getByRole("button",{name:"Download audit (.md)"})).toBeDisabled();
});
it("withholds a stale current response for a different window rather than exporting the wrong period",()=>{
  jest.mocked(query).mockReturnValue({isLoading:false,isFetching:false,data:{data:{window:{startDate:"2020-01-01",endDate:"2020-01-07"},campaigns:[],truncated:false,
    coverage:"stored_only_not_provider_verified",totals:{campaigns:0,active:0,storedMetricCampaigns:0,unverifiedCampaigns:0}}}} as never);
  render(<AccountAuditPage/>);
  expect(screen.getByRole("alert")).toHaveTextContent("Stored response does not match the selected current window");
  expect(screen.getByRole("button",{name:"Download audit (.md)"})).toBeDisabled();
});
it("clears the download receipt when the historical comparison changes",()=>{
  const originalCreate=URL.createObjectURL, originalRevoke=URL.revokeObjectURL;
  URL.createObjectURL=jest.fn(()=>"blob:fixture"); URL.revokeObjectURL=jest.fn();
  const click=jest.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
  jest.useFakeTimers();
  try {
    render(<AccountAuditPage/>);
    fireEvent.click(screen.getByRole("button",{name:"Download audit (.md)"}));
    expect(screen.getByRole("status")).toHaveTextContent("Audit download requested");
    fireEvent.change(screen.getByRole("combobox",{name:"Comparison period"}),{target:{value:"year_1"}});
    expect(screen.queryByText("Audit download requested for this displayed scope.")).not.toBeInTheDocument();
  } finally { jest.runOnlyPendingTimers(); jest.useRealTimers(); URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;click.mockRestore(); }
});
beforeEach(()=>{
  jest.clearAllMocks();
  jest.mocked(businessContext).mockReturnValue({isLoading:false,isFetching:false,data:{brandId:"brand-1",source:"missing",context:null}} as never);
  jest.mocked(accounts).mockReturnValue({isLoading:false,data:{accounts:[{id:"account-google",name:"Fixture Google",accountId:"1111111111",platform:"google",currency:"EUR"}]}} as never);
  jest.mocked(query).mockImplementation((input:unknown)=>{
    const scope=input as {platform:string;startDate:string;endDate:string;adAccountId:string};
    return {isLoading:false,isFetching:false,data:{data:{window:{startDate:scope.startDate,endDate:scope.endDate},
      campaigns:[],coverage:"stored_only_not_provider_verified",truncated:false,
      totals:{campaigns:0,active:0,storedMetricCampaigns:0,unverifiedCampaigns:0}}}} as never;
  });
});

it("renders the three brand desks without duplicate React keys",()=>{
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<AccountAuditPage />);
    const duplicateKeyWarnings = consoleError.mock.calls.filter(
      (args) => typeof args[0] === "string" && args[0].includes("same key"),
    );
    expect(duplicateKeyWarnings).toEqual([]);
  } finally {
    consoleError.mockRestore();
  }
});

it("shows the shared saved brand inputs separately from measured evidence and the selected audit goal",()=>{
  jest.mocked(businessContext).mockReturnValue({isLoading:false,data:{brandId:"brand-1",source:"brand",context:{
    objective:"leads",targetResult:"Qualified business buyers",priorities:"Wholesale quality",constraints:"No automatic scaling",
    seasonality:"Owner winter plan",notes:"Owner inputs",updatedAt:"2026-09-17T10:00:00Z",
  }}} as never);
  render(<AccountAuditPage/>);
  const region=screen.getByRole("region",{name:"Business Context (brand-level)"});
  expect(region).toHaveTextContent("Qualified business buyers");
  expect(region).toHaveTextContent("No automatic scaling");
  expect(region).toHaveTextContent("Operator inputs, not verified business economics");
  expect(region).toHaveTextContent("shared across accounts and markets");
  expect(region).toHaveTextContent("Saved inputs may be outdated");
  expect(screen.getByRole("link",{name:"Review / edit saved brand context"})).toHaveAttribute("href","/onboarding?brand=brand-1");
  expect(screen.getByRole("combobox",{name:"Business objective"})).toHaveValue("sales");
  expect(businessContext).toHaveBeenCalledWith({brandId:"brand-1"},expect.objectContaining({enabled:true}));
});
it("renders the evidence-first decision plan on the desk, never a host/recovery project",()=>{
  render(<AccountAuditPage/>);
  const section=screen.getByRole("heading",{name:"Decision plan"}).closest("section") ?? document.body;
  expect(within(section as HTMLElement).getByText(/Reconcile the exact owned account/)).toBeInTheDocument();
  expect(within(section as HTMLElement).getByText(/Google Repair Desk \(ADR 0003\)/)).toBeInTheDocument();
  expect(section.textContent).not.toMatch(/host\/recovery|reinstall/i);
});
it("flags saved business context that predates a live connection as stale claims, not current truth",()=>{
  jest.mocked(businessContext).mockReturnValue({isLoading:false,data:{brandId:"brand-1",source:"brand",context:{
    objective:"sales",notes:"Google not connected yet; Meta only",updatedAt:"2026-08-28T10:00:00Z",
  },connections:[{platform:"google",connectedAt:"2026-09-17"}]}} as never);
  render(<AccountAuditPage/>);
  const region=screen.getByRole("region",{name:"Business Context (brand-level)"});
  expect(region).toHaveTextContent("Saved on 2026-08-28, before the google connection");
  expect(region).toHaveTextContent("historical, not current truth");
});
it("stays silent on staleness when connections predate the saved context or none exist",()=>{
  jest.mocked(businessContext).mockReturnValue({isLoading:false,data:{brandId:"brand-1",source:"brand",context:{
    objective:"sales",notes:"Current platform mix",updatedAt:"2026-09-17T10:00:00Z",
  },connections:[{platform:"google",connectedAt:"2026-08-01"}]}} as never);
  render(<AccountAuditPage/>);
  expect(screen.queryByText(/before the google connection/)).not.toBeInTheDocument();
});
it("keeps a context read error explicit while preserving valid stored diagnostics",()=>{
  jest.mocked(businessContext).mockReturnValue({isLoading:false,error:{message:"Fixture context failure"}} as never);
  render(<AccountAuditPage/>);
  expect(screen.getByRole("region",{name:"Business Context (brand-level)"})).toHaveTextContent("Business context source: unavailable");
  expect(screen.getByText("No stored metrics for this account/window")).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Campaign activation locked"})).toBeDisabled();
});
it("withholds stale other-brand context rather than exporting it",()=>{
  jest.mocked(businessContext).mockReturnValue({isLoading:false,data:{brandId:"other-brand",source:"brand",context:{notes:"Other shop private input"}}} as never);
  render(<AccountAuditPage/>);
  expect(screen.queryByText("Other shop private input")).not.toBeInTheDocument();
  expect(screen.getByRole("region",{name:"Business Context (brand-level)"})).toHaveTextContent("Business context source: unavailable");
});
it("waits for the current business input before enabling a download",()=>{
  jest.mocked(businessContext).mockReturnValue({isLoading:true,isFetching:true} as never);
  render(<AccountAuditPage/>);
  expect(screen.getByRole("button",{name:"Download audit (.md)"})).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent("business context");
});
it("loads current and preceding windows for one owned account, never an all-platform fallback",()=>{
  render(<AccountAuditPage/>);
  expect(query).toHaveBeenCalledWith(expect.objectContaining({platform:"google",brandId:"brand-1",adAccountId:"account-google",market:"all",limit:1000}),expect.objectContaining({enabled:true}));
  const inputs=jest.mocked(query).mock.calls.map(c=>c[0] as {startDate:string;endDate:string});
  expect(new Set(inputs.map(x=>x.startDate)).size).toBe(2);
  expect(screen.getByRole("heading",{name:"Performance Marketing Desk"})).toBeInTheDocument();
});
it("shows empty Google metrics as Unverified, not zero spend and safe-to-launch",()=>{
  render(<AccountAuditPage/>);
  expect(screen.getByText("No stored metrics for this account/window")).toBeInTheDocument();
  expect(screen.getByLabelText("Audit performance summary")).toHaveTextContent("Unverified");
  expect(screen.getByRole("button",{name:"Campaign activation locked"})).toBeDisabled();
  expect(screen.queryByText("€0.00")).not.toBeInTheDocument();
});
it("makes query errors explicit and disables export rather than showing an empty-success audit",()=>{
  jest.mocked(query).mockReturnValue({isLoading:false,error:{message:"Fixture failure"}} as never);
  render(<AccountAuditPage/>);
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load account audit");
  expect(screen.getByRole("button",{name:"Download audit (.md)"})).toBeDisabled();
});
it("does not enable reporting until a specific account is selected when several are available",()=>{
  jest.mocked(accounts).mockReturnValue({isLoading:false,data:{accounts:[{id:"a",name:"A",accountId:"1"},{id:"b",name:"B",accountId:"2"}]}} as never);
  render(<AccountAuditPage/>);
  expect(query).toHaveBeenLastCalledWith(expect.anything(),expect.objectContaining({enabled:false}));
  expect(screen.getByText("Select an owned ad account to run the audit.")).toBeInTheDocument();
});
it("switches to wholesale qualification strategy without reinterpreting generic conversions as wholesale sales",async()=>{
  render(<AccountAuditPage/>);
  await userEvent.selectOptions(screen.getByRole("combobox",{name:"Business objective"}),"wholesale");
  expect(screen.getByText(/Which activity brings qualified wholesale buyers/)).toBeInTheDocument();
  expect(screen.getByText("Lead identity → sales follow-up → first paid order")).toBeInTheDocument();
  expect(screen.getByRole("button",{name:"Campaign activation locked"})).toBeDisabled();
});
it("clears the owned account scope when platform changes, never reusing stale Google data",async()=>{
  jest.mocked(accounts).mockImplementation((input:unknown)=>({isLoading:false,data:{accounts:(input as {platform:string}).platform==="google"?[{id:"account-google",name:"Google",accountId:"1"}]:[]}} as never));
  render(<AccountAuditPage/>);
  await userEvent.selectOptions(screen.getByRole("combobox",{name:"Platform"}),"meta");
  expect(query).toHaveBeenLastCalledWith(expect.objectContaining({platform:"meta",adAccountId:undefined}),expect.objectContaining({enabled:false}));
  expect(screen.queryByText("No stored metrics for this account/window")).not.toBeInTheDocument();
});
it("shows inventory with missing metrics and no live action buttons",()=>{
  jest.mocked(query).mockImplementation((input:unknown)=>{
    const s=input as {startDate:string;endDate:string};
    return {isLoading:false,data:{data:{window:{startDate:s.startDate,endDate:s.endDate},truncated:false,coverage:"stored_only_not_provider_verified",
      totals:{campaigns:1,active:1,storedMetricCampaigns:0,unverifiedCampaigns:1},campaigns:[{reportRowId:"fixture",adAccountId:"account-google",campaignId:"fixture-id",campaignName:"Fixture campaign",platform:"google",currency:"EUR",status:"active",metricState:"no_stored_metrics",totalSpend:0,totalConversionValue:0,totalConversions:0,totalClicks:0,totalImpressions:0}]}}} as never;
  });
  render(<AccountAuditPage/>);
  const table=screen.getByRole("table",{name:"Account campaign inventory"});
  expect(within(table).getByText("Fixture campaign")).toBeInTheDocument();
  expect(within(table).getAllByText("Unverified").length).toBeGreaterThan(0);
  expect(within(table).queryByRole("button",{name:/Pause|Resume|Activate|Budget/})).not.toBeInTheDocument();
});
it("rejects reversed dates and keeps export disabled",async()=>{
  render(<AccountAuditPage/>);
  await userEvent.clear(screen.getByLabelText("Start date (UTC)"));
  await userEvent.type(screen.getByLabelText("Start date (UTC)"),"2099-01-01");
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a valid completed UTC window");
  expect(screen.getByRole("button",{name:"Download audit (.md)"})).toBeDisabled();
});

it("prepares a Markdown download and does not show its receipt for a different objective",()=>{
  jest.useFakeTimers();
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(()=>"blob:fixture-audit");
  URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
  try {
    render(<AccountAuditPage/>);
    fireEvent.click(screen.getByRole("button",{name:"Download audit (.md)"}));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status")).toHaveTextContent("Audit download requested");
    fireEvent.change(screen.getByRole("combobox",{name:"Business objective"}),{target:{value:"wholesale"}});
    expect(screen.queryByText("Audit download requested for this displayed scope.")).not.toBeInTheDocument();
    jest.runOnlyPendingTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fixture-audit");
  } finally {
    jest.runOnlyPendingTimers();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    click.mockRestore();
    jest.useRealTimers();
  }
});

it("clears a download receipt when the displayed business context changes",()=>{
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = jest.fn(()=>"blob:fixture-audit");
  URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
  jest.useFakeTimers();
  try {
    const {rerender}=render(<AccountAuditPage/>);
    fireEvent.click(screen.getByRole("button",{name:"Download audit (.md)"}));
    expect(screen.getByRole("status")).toHaveTextContent("Audit download requested");
    jest.mocked(businessContext).mockReturnValue({isLoading:false,data:{brandId:"brand-1",source:"brand",context:{objective:"sales",notes:"New input version"}}} as never);
    rerender(<AccountAuditPage/>);
    expect(screen.queryByText("Audit download requested for this displayed scope.")).not.toBeInTheDocument();
  } finally {
    jest.runOnlyPendingTimers();
    URL.createObjectURL=originalCreate; URL.revokeObjectURL=originalRevoke; click.mockRestore(); jest.useRealTimers();
  }
});
