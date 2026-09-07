/**
 * Store-side tracking playbook. Ads Pro reads pixel / till / GA4 — it cannot
 * replace Events Manager, DebugView, or Woo tax settings.
 */

export type TrackingWorkstreamId =
  | "capi-emq"
  | "ga4-mp"
  | "ga4-unassigned"
  | "google-ads-api"
  | "woo-vat";

export interface TrackingWorkstream {
  id: TrackingWorkstreamId;
  title: string;
  owner: string;
  gap: string;
  doNot: string;
  steps: string[];
  verify: string;
  docs: { label: string; href: string }[];
}

export const TRACKING_WORKSTREAMS: TrackingWorkstream[] = [
  {
    id: "capi-emq",
    title: "CAPI + Event Match Quality (pixel vs till)",
    owner: "WP / Meta Events Manager",
    gap: "Pixel conversions lag store orders because Purchase is browser-only, blocked, or unmatched.",
    doNot: "Do not install two CAPI stacks (Facebook for WooCommerce + PixelYourSite + GTM) — that doubles Purchase unless event_id matches. Do not scale Advantage+ off Store MER.",
    steps: [
      "Pick one stack: Facebook for WooCommerce, PixelYourSite Pro, or sGTM/CAPI Gateway — not two.",
      "Set event_id to the Woo order id (string) on both fbq eventID and CAPI event_id. Same event_name: Purchase.",
      "On CAPI Purchase send hashed em + ph (E.164 with country code, SHA-256 once), plus unhashed fbp, fbc (from fbclid), client_ip_address, client_user_agent, event_source_url, action_source=website.",
      "Add external_id = Woo customer id or hashed email. Capture fbclid on landing and persist _fbc 90 days so CAPI still matches when the Pixel is blocked.",
      "Greece/EU: fire Pixel only after consent; CAPI Purchase from the paid order still sends hashed billing PII from Woo.",
    ],
    verify:
      "Events Manager → Test Events: browser + server share event_id; one is dropped as duplicate. Dedup ≥90%. Purchase EMQ ≥6, aim 8+ (email ~+4, phone ~+3).",
    docs: [
      {
        label: "Meta: Pixel + CAPI dedup",
        href: "https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events/",
      },
      {
        label: "Meta: customer_information params",
        href: "https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters/",
      },
    ],
  },
  {
    id: "ga4-mp",
    title: "GA4 purchase vs Woo orders",
    owner: "WP / GA4 DebugView",
    gap: "Thank-you JS never fires on blocked browsers, declined consent, or payment-redirect drop-offs. Woo already has the order.",
    doNot: "Do not treat sGTM-only as the fix — it only forwards events the browser already sent. Do not add GA4 purchases to pixel or till.",
    steps: [
      "Keep client-side GA4 ecommerce for behaviour. Add a second send from woocommerce_payment_complete (card/PayPal) and paid-status for BACS/COD.",
      "POST Measurement Protocol purchase with transaction_id = Woo order id so thank-you refreshes do not double-count.",
      "Stitch client_id + session_id (first-party cookie) and gclid/gbraid/wbraid onto the MP hit or the purchase stays Unassigned.",
      "Set _ga4_tracked order meta after a 2xx so hooks do not fire twice.",
    ],
    verify:
      "A test paid order appears in GA4 DebugView with the same transaction_id as Woo. Gap vs till should shrink from ~12% toward mid-single digits; remaining is consent/modeled.",
    docs: [
      {
        label: "Why Woo orders miss GA4",
        href: "https://clickport.io/blog/woocommerce-missing-orders",
      },
    ],
  },
  {
    id: "ga4-unassigned",
    title: "GA4 Unassigned sessions",
    owner: "GTM / consent / ads UTMs",
    gap: "Unassigned is traffic GA4 could not map to any default channel — including Direct. It is not a bid channel.",
    doNot: "Do not buy Unassigned. Do not stamp a persistent server FPID onto consent-denied cookieless pings (that inflates Unassigned).",
    steps: [
      "Require utm_source + utm_medium + utm_campaign on every paid, email, and affiliate link. Medium must match GA4 default-channel rules (cpc, email, social — not mail).",
      "Preserve query strings through Cloudflare, language redirects, and payment hops. Auto-tag Google Ads (gclid).",
      "Exclude payment gateways from referral. Cross-domain linker if checkout leaves bagtobag.com.gr.",
      "Consent Mode v2 Advanced. Measurement Protocol events must include session_id or they land Unassigned.",
    ],
    verify:
      "GA4 Explore: Unassigned share of sessions. Target well under 8% of sessions; leftover after consent is a floor, not a campaign.",
    docs: [
      {
        label: "GA4 Unassigned causes",
        href: "https://www.analyticsmania.com/post/unassigned-in-google-analytics-4/",
      },
    ],
  },
  {
    id: "google-ads-api",
    title: "Google Ads spend sync",
    owner: "Ads Pro Connections + MCC",
    gap: "Woo last-click Google is till, not spend. Pixel ROAS stays Meta-only until DailyMetric google rows exist.",
    doNot: "Do not treat Woo last-click Google or GA4 Organic Search as Google Ads spend. Do not pick an MCC as the spend account.",
    steps: [
      "Developer token lives in Ads API Center on an MCC: https://ads.google.com/aw/apicenter. OAuth can reuse GOOGLE_ANALYTICS_CLIENT_*.",
      "Google Cloud: enable Google Ads API. Redirect {SITE_URL}/api/auth/google-ads/callback. Scope https://www.googleapis.com/auth/adwords.",
      "On Connections pick the BAGTOBAG spend account (not the MCC). Switching shops here mixes another brand's spend into Pixel ROAS.",
      "Optional GOOGLE_ADS_LOGIN_CUSTOMER_ID = MCC digits when the spend account is under a manager. Then Sync Now until DailyMetric google rows appear.",
      "If Sync Now says the developer token is test-only, apply for Basic Access in Ads API Center — OAuth connected with 0 rows is not Google Ads spend.",
    ],
    verify: "Connections → Google Ads → Sync Now writes campaign rows. Reports paid spend includes Google, not only Meta. A failed sync with 0 records is not Woo last-click Google.",
    docs: [
      {
        label: "Google Ads API developer token",
        href: "https://developers.google.com/google-ads/api/docs/get-started/dev-token",
      },
      {
        label: "Search & SearchStream REST",
        href: "https://developers.google.com/google-ads/api/rest/common/search",
      },
    ],
  },
  {
    id: "woo-vat",
    title: "Woo REST tax is 0",
    owner: "WooCommerce → Settings → Tax",
    gap: "If total_tax and cart_tax are 0, Ads Pro Net ex VAT equals store net. That is the store, not a display bug.",
    doNot: "Do not invent 24% ΦΠΑ in Ads Pro. Enable tax in Woo so REST returns it.",
    steps: [
      "WooCommerce → Settings → General → Enable taxes. Tax → Standard rates → GR 24% (and reduced if you sell those SKUs).",
      "Prices inclusive of tax if that is how the catalog is entered. Place a test order and confirm total_tax > 0 in REST (cart_tax + shipping_tax if total_tax is empty).",
      "Re-sync Woo in Connections. Net ex VAT and merExVat then subtract real ΦΠΑ.",
    ],
    verify: "A new paid order in Ads Pro Customers / MER strip shows tax > 0. Historical rows stay 0 until re-synced after tax was on.",
    docs: [
      {
        label: "Woo Orders REST tax fields",
        href: "https://developer.woocommerce.com/docs/apis/rest-api/v3/orders",
      },
    ],
  },
];

export function trackingWorkstream(id: TrackingWorkstreamId): TrackingWorkstream {
  const row = TRACKING_WORKSTREAMS.find((w) => w.id === id);
  if (!row) throw new Error(`Unknown tracking workstream ${id}`);
  return row;
}
