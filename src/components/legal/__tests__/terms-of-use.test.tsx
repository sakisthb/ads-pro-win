import { render, screen } from "@testing-library/react";
import { TermsOfUse } from "@/components/legal/terms-of-use";
import { BRAND } from "@/lib/brand";

describe("TermsOfUse", () => {
  it("is a public Ads Pro Digital Terms of Use notice in Greek", () => {
    render(<TermsOfUse />);

    expect(
      screen.getByRole("heading", { name: /όροι χρήσης/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(BRAND.name)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(BRAND.termsUrl).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: BRAND.name })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: /gdpr|προσωπικά δεδομένα/i })).toHaveAttribute(
      "href",
      BRAND.privacyPath,
    );
  });

  it("does not invent a legal entity and never uses a BagToBag shop ToS URL", () => {
    render(<TermsOfUse />);

    expect(screen.getByTestId("controller-unknown")).toHaveTextContent(
      /\[UNKNOWN/i,
    );
    expect(document.body.textContent).not.toMatch(
      /bagtobag\.com\.gr\/oroi-chrisis/i,
    );
    expect(document.body.textContent).not.toMatch(/apdm\.gr/i);
    expect(document.body.textContent).toMatch(/Ads Pro Digital/);
    expect(document.body.textContent).toMatch(/όροι χρήσης/i);
  });

  it("uses quiet black / white / charcoal chrome", () => {
    const { container } = render(<TermsOfUse />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/bg-\[#0A0A0A\]|bg-black/);
    expect(root.getAttribute("style") ?? "").not.toMatch(/purple|#[0-9a-f]*c8f542/i);
  });
});
