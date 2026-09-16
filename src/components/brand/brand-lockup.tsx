import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLockupProps = {
  variant?: "mark" | "wordmark";
  invert?: boolean;
  className?: string;
};

export function BrandLockup({
  variant = "wordmark",
  invert = true,
  className,
}: BrandLockupProps) {
  const src = variant === "mark" ? BRAND.assets.mark : BRAND.assets.wordmark;
  return (
    <img
      src={src}
      alt={BRAND.name}
      className={cn(
        "object-contain object-left",
        variant === "wordmark" ? "h-7 w-auto max-w-[220px]" : "h-8 w-8",
        invert && "invert",
        className,
      )}
    />
  );
}
