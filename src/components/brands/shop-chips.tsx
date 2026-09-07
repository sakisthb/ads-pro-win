"use client";

type ShopChip = {
  id: string;
  name: string;
};

export function ShopChips({
  brands,
  brandId,
  onSelect,
}: {
  brands: ShopChip[];
  brandId: string;
  onSelect: (id: string) => void;
}) {
  if (brands.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {brands.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onSelect(b.id)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
            brandId === b.id
              ? "border-sky-400/40 bg-sky-400/15 text-sky-100"
              : "border-white/10 text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
