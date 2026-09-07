/** Human labels for Meta Ads Manager result / action types. Safe for client bundles. */

export function labelMetaResultType(type: string | null | undefined): string {
  if (!type) return "Results";
  const key = type.replace(/^actions:/, "");
  switch (key) {
    case "omni_purchase":
    case "purchase":
    case "offsite_conversion.fb_pixel_purchase":
      return "Purchases";
    case "omni_add_to_cart":
    case "add_to_cart":
    case "offsite_conversion.fb_pixel_add_to_cart":
      return "Add to cart";
    case "omni_landing_page_view":
    case "landing_page_view":
      return "Landing views";
    case "link_click":
      return "Link clicks";
    case "estimated_ad_recallers":
      return "Est. ad recall";
    case "reach":
      return "Reach";
    case "lead":
    case "offsite_conversion.fb_pixel_lead":
      return "Leads";
    case "post_engagement":
      return "Post engagement";
    default:
      return key.replace(/_/g, " ");
  }
}
