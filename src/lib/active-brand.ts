/** URL, then this session's chip, then the first shop — never pin one brand. */
export function pickActiveBrandId(
  brands: Array<{ id: string }>,
  fromUrl: string | null | undefined,
  saved: string | null | undefined,
): string {
  if (fromUrl && brands.some((b) => b.id === fromUrl)) return fromUrl;
  if (saved && brands.some((b) => b.id === saved)) return saved;
  return brands[0]?.id ?? "";
}
