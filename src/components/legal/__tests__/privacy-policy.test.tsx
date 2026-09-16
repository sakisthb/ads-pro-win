import { render, screen } from "@testing-library/react";
import { PrivacyPolicy } from "@/components/legal/privacy-policy";
import { BRAND } from "@/lib/brand";

describe("PrivacyPolicy", () => {
  it("is a public Ads Pro Digital GDPR notice in Greek", () => {
    render(<PrivacyPolicy />);

    expect(
      screen.getByRole("heading", { name: /προσωπικά δεδομένα/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(BRAND.name)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(BRAND.privacyUrl).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: BRAND.name })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("does not invent a legal entity and never uses the BagToBag WP GDPR URL", () => {
    render(<PrivacyPolicy />);

    expect(screen.getByTestId("controller-unknown")).toHaveTextContent(
      /\[UNKNOWN/i,
    );
    expect(document.body.textContent).not.toMatch(
      /bagtobag\.com\.gr\/prosopika-dedomena-gdpr/i,
    );
    expect(document.body.textContent).not.toMatch(/apdm\.gr/i);
    expect(document.body.textContent).toMatch(/Ads Pro Digital/);
    expect(document.body.textContent).toMatch(/GDPR|ΓΚΠΔ/);
  });

  it("uses quiet black / white / charcoal chrome", () => {
    const { container } = render(<PrivacyPolicy />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/bg-\[#0A0A0A\]|bg-black/);
    expect(root.getAttribute("style") ?? "").not.toMatch(/purple|#[0-9a-f]*c8f542/i);
  });
});
