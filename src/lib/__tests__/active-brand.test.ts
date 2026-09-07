import { pickActiveBrandId } from "@/lib/active-brand";

const shops = [
  { id: "rich-girl" },
  { id: "bagtobag" },
  { id: "another" },
];

describe("pickActiveBrandId", () => {
  it("does not pin BAGTOBAG when another shop is first", () => {
    expect(pickActiveBrandId(shops, null, null)).toBe("rich-girl");
  });

  it("honors the URL, then the saved chip", () => {
    expect(pickActiveBrandId(shops, "another", "bagtobag")).toBe("another");
    expect(pickActiveBrandId(shops, null, "bagtobag")).toBe("bagtobag");
  });
});
