import { render, screen } from "@testing-library/react";
import { AppSidebar } from "../AppSidebar";

jest.mock("next/navigation", () => ({ usePathname: () => "/account-audit" }));
jest.mock("@/components/providers/trpc-provider", () => ({api:{alerts:{unreadCount:{useQuery:()=>({data:{count:0}})}}}}));

it("makes the audit desk discoverable in authenticated main navigation", () => {
  render(<AppSidebar/>);
  expect(screen.getByRole("link",{name:"Account Audit"})).toHaveAttribute("href","/account-audit");
});
