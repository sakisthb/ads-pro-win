import fs from "fs";
import path from "path";
import { BRAND, brandMetadata, inviteEmailCopy } from "@/lib/brand";

const repoRoot = path.join(__dirname, "../../..");

describe("Ads Pro Digital brand", () => {
  it("names the product Ads Pro Digital on adpd.gr", () => {
    expect(BRAND.name).toBe("Ads Pro Digital");
    expect(BRAND.domain).toBe("adpd.gr");
    expect(BRAND.siteUrl).toBe("https://adpd.gr");
    expect(BRAND.name).not.toMatch(/Enterprise/i);
    expect(BRAND.ink).toBe("#0A0A0A");
    expect(BRAND.charcoal).toBe("#121417");
    expect(BRAND.paper).toBe("#FFFFFF");
    expect(`${BRAND.ink}${BRAND.charcoal}${BRAND.paper}`).not.toMatch(
      /C8F542|3D6F9A|0B1F33/i,
    );
  });

  it("points chrome at the locked monochrome logo files", () => {
    expect(BRAND.assets.mark).toBe("/adpd-logo-mark.png");
    expect(BRAND.assets.wordmark).toBe("/adpd-logo-wordmark.png");
  });

  it("builds quiet metadata with favicon and apple-touch from the mark", () => {
    const meta = brandMetadata();
    expect(meta.title).toBe("Ads Pro Digital");
    expect(meta.openGraph.siteName).toBe("Ads Pro Digital");
    expect(meta.openGraph.title).toBe("Ads Pro Digital");
    expect(meta.authors).toEqual([{ name: "Ads Pro Digital" }]);
    expect(meta.icons.icon).toBe("/adpd-logo-mark.png");
    expect(meta.icons.apple).toBe("/adpd-logo-mark.png");
    expect(JSON.stringify(meta)).not.toMatch(/Enterprise/i);
  });

  it("ships logo files in public/", () => {
    expect(
      fs.existsSync(path.join(repoRoot, "public/adpd-logo-mark.png")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(repoRoot, "public/adpd-logo-wordmark.png")),
    ).toBe(true);
  });

  it("uses adpd.gr in production env examples and never apdm.gr", () => {
    const example = fs.readFileSync(path.join(repoRoot, ".env.example"), "utf8");
    const production = fs.readFileSync(
      path.join(repoRoot, ".env.production.example"),
      "utf8",
    );
    expect(example).toMatch(/NEXT_PUBLIC_SITE_URL=https:\/\/adpd\.gr/);
    expect(production).toMatch(/^DOMAIN=adpd\.gr$/m);
    expect(production).toMatch(/NEXT_PUBLIC_SITE_URL=https:\/\/adpd\.gr/);
    expect(example).not.toMatch(/apdm\.gr/);
    expect(production).not.toMatch(/apdm\.gr/);
  });

  it("brands invitation copy with Ads Pro Digital", () => {
    const copy = inviteEmailCopy({
      orgName: "BagToBag",
      inviterName: "Athanasios",
    });
    expect(copy.subject).toContain("Ads Pro Digital");
    expect(copy.fromName).toBe("Ads Pro Digital");
    expect(copy.body).toContain("Ads Pro Digital");
    expect(copy.body).toContain("BagToBag");
  });

  it("publishes one canonical GDPR URL on adpd.gr", () => {
    expect(BRAND.privacyPath).toBe("/prosopika-dedomena-gdpr");
    expect(BRAND.privacyUrl).toBe("https://adpd.gr/prosopika-dedomena-gdpr");
    expect(BRAND.privacyUrl).toBe(`${BRAND.siteUrl}${BRAND.privacyPath}`);
    expect(BRAND.privacyUrl).not.toMatch(/bagtobag\.com\.gr/i);
  });

  it("documents the canonical privacy URL for Google/Meta consent, never BagToBag WP GDPR", () => {
    const forbidden = "bagtobag.com.gr/prosopika-dedomena-gdpr";
    const docs = [
      ".env.example",
      ".env.production.example",
      "docs/oauth-branding.md",
    ].map((rel) => ({
      rel,
      text: fs.readFileSync(path.join(repoRoot, rel), "utf8"),
    }));
    const app = [
      "src/app/page.tsx",
      "src/app/auth/login/login-form.tsx",
      "src/app/auth/signup/page.tsx",
    ].map((rel) => ({
      rel,
      text: fs.readFileSync(path.join(repoRoot, rel), "utf8"),
    }));

    for (const file of app) {
      expect(`${file.rel}: ${file.text}`).not.toMatch(forbidden);
      expect(file.text).toMatch(/privacyPath|privacyUrl|\/prosopika-dedomena-gdpr/);
    }
    for (const file of docs) {
      expect(file.text).toContain("https://adpd.gr/prosopika-dedomena-gdpr");
      expect(file.text).not.toMatch(
        /(?:href|url|URL)\s*[:=].*bagtobag\.com\.gr\/prosopika-dedomena-gdpr/i,
      );
    }

    const home = app.find((f) => f.rel === "src/app/page.tsx")!.text;
    expect(home).not.toMatch(/href="#"[^>]*>Privacy</);
  });

  it("permanently aliases /privacy to the canonical GDPR path", async () => {
    const config = require(path.join(repoRoot, "next.config.js")) as {
      redirects?: () => Promise<Array<{ source: string; destination: string; permanent: boolean }>>;
    };
    expect(typeof config.redirects).toBe("function");
    const redirects = await config.redirects!();
    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/privacy",
          destination: "/prosopika-dedomena-gdpr",
          permanent: true,
        }),
      ]),
    );
  });
});
