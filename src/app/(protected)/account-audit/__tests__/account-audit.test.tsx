import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountAuditPage from "../page";
import { api } from "@/components/providers/trpc-provider";

jest.mock("@/components/providers/trpc-provider", () => ({api:{marketing:{
  getCampaignPerformance:{useQuery:jest.fn()},getCampaignReportAccounts:{useQuery:jest.fn()},
}}}));
jest.mock("@/hooks/use-active-brand", () => ({useActiveBrand:()=>({brandId:"brand-1",brands:[{id:"brand-1",name:"Fixture shop"}],setBrandId:jest.fn(),isLoading:false})}));
jest.mock("@/hooks/use-active-market", () => ({useActiveMarket:()=>({market:"all"})}));
jest.mock("@/components/brands/desk-filters",()=>({DeskFilterRow:()=>null}));
jest.mock("recharts",()=>({ResponsiveContainer:()=>null,BarChart:()=>null,Bar:()=>null,XAxis:()=>null,YAxis:()=>null,Tooltip:()=>null,CartesianGrid:()=>null}));

const query = api.marketing.getCampaignPerformance.useQuery;
const accounts = api.marketing.getCampaignReportAccounts.useQuery;
beforeEach(()=>{
  jest.clearAllMocks();
  jest.mocked(accounts).mockReturnValue({isLoading:false,data:{accounts:[{id:"account-google",name:"Fixture Google",accountId:"1111111111",platform:"google",currency:"EUR"}]}} as never);
  jest.mocked(query).mockImplementation((input:unknown)=>{
    const scope=input as {platform:string;startDate:string;endDate:string;adAccountId:string};
    return {isLoading:false,isFetching:false,data:{data:{window:{startDate:scope.startDate,endDate:scope.endDate},
      campaigns:[],coverage:"stored_only_not_provider_verified",truncated:false,
      totals:{campaigns:0,active:0,storedMetricCampaigns:0,unverifiedCampaigns:0}}}} as never;
  });
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
