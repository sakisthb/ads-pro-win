import { SAKI_PLAYBOOKS } from "@/lib/saki-playbooks";

describe("SAKI_PLAYBOOKS", () => {
  it("does not ask the operator to blend clocks or invent auction intel", () => {
    const blob = SAKI_PLAYBOOKS.map((p) => `${p.id} ${p.label} ${p.prompt}`).join("\n");
    expect(blob).not.toMatch(/blended ROAS/i);
    expect(blob).not.toMatch(/typical ecommerce benchmarks/i);
    expect(blob).toMatch(/five clocks/i);
    expect(blob).toMatch(/will not invent them|Basic Access/i);
    expect(blob).toMatch(/Woo last-click Google is till/);
  });
});
