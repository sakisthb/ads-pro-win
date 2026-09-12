import { render, screen } from "@/test-utils/test-utils";
import { GrowthCenterDesk } from "../growth-center-desk";
import type { GrowthDesk } from "@/lib/growth-center";

describe("GrowthCenterDesk", () => {
  it("renders nothing when the brand is not mapped to Growth Center", () => {
    const { container } = render(
      <GrowthCenterDesk desk={{ status: "unlinked" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("opens Growth Center without showing invented catalog counts", () => {
    const desk: GrowthDesk = {
      status: "linked",
      hostname: "bagtobag.com.gr",
      siteId: "bagtobag_com_gr",
      origin: "http://127.0.0.1:18806",
      href: "http://127.0.0.1:18806/",
      catalogFacts: null,
      reachability: "reachable",
    };
    render(<GrowthCenterDesk desk={desk} />);
    const link = screen.getByRole("link", { name: /open growth center/i });
    expect(link).toHaveAttribute(
      "href",
      "http://127.0.0.1:18806/?site=bagtobag_com_gr",
    );
    expect(screen.getByText(/bagtobag.com.gr/i)).toBeInTheDocument();
    expect(screen.queryByText(/MFA/i)).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByText("2,753")).not.toBeInTheDocument();
  });

  it("says the origin did not answer without substituting zeros", () => {
    render(
      <GrowthCenterDesk
        desk={{
          status: "linked",
          hostname: "bagtobag.com.gr",
          siteId: "bagtobag_com_gr",
          origin: "http://127.0.0.1:18806",
          href: "http://127.0.0.1:18806/",
          catalogFacts: null,
          reachability: "unreachable",
        }}
      />,
    );
    expect(screen.getByText(/did not answer/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open growth center/i })).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows SACOS desk-summary counts when they exist", () => {
    render(
      <GrowthCenterDesk
        desk={{
          status: "linked",
          hostname: "bagtobag.com.gr",
          siteId: "bagtobag_com_gr",
          origin: "http://127.0.0.1:18806",
          href: "http://127.0.0.1:18806/",
          catalogFacts: {
            imageIssues: 12,
            pendingDrafts: 3,
            lastAccepted: { appliedProducts: 32, at: "2026-09-11T12:38:19Z" },
          },
          reachability: "reachable",
        }}
      />,
    );
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.getByText("Sep 11, 2026")).toBeInTheDocument();
    expect(screen.queryByText(/MFA/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /image issues/i }),
    ).toHaveAttribute(
      "href",
      "http://127.0.0.1:18806/?site=bagtobag_com_gr&view=images",
    );
    expect(
      screen.getByRole("link", { name: /pending drafts/i }),
    ).toHaveAttribute(
      "href",
      "http://127.0.0.1:18806/?site=bagtobag_com_gr&view=products",
    );
    expect(
      screen.getByRole("link", { name: /last accepted/i }),
    ).toHaveAttribute(
      "href",
      "http://127.0.0.1:18806/?site=bagtobag_com_gr&view=products&pilot=1",
    );
    expect(
      screen.queryByText(/does not copy those numbers/i),
    ).not.toBeInTheDocument();
  });

  it("may show a real zero from SACOS without inventing a last-accepted batch", () => {
    render(
      <GrowthCenterDesk
        desk={{
          status: "linked",
          hostname: "bagtobag.com.gr",
          siteId: "bagtobag_com_gr",
          origin: "http://127.0.0.1:18806",
          href: "http://127.0.0.1:18806/",
          catalogFacts: {
            imageIssues: 0,
            pendingDrafts: 0,
            lastAccepted: null,
          },
          reachability: "reachable",
        }}
      />,
    );
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.getByText(/none yet/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/does not copy those numbers/i),
    ).not.toBeInTheDocument();
  });
});
