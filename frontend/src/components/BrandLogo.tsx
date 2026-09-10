type BrandLogoProps = {
  variant?: "full" | "compact" | "symbol";
  className?: string;
  alt?: string;
};

export function BrandLogo({
  variant = "full",
  className = "h-12 w-36",
  alt = "BullionAI",
}: BrandLogoProps) {
  if (variant === "symbol") {
    return (
      <span className={`relative inline-block shrink-0 ${className}`}>
        <img src="/bullionai-symbol.png" alt={alt} className="h-full w-full object-contain" />
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <span className={`inline-flex shrink-0 items-center gap-2 ${className}`}>
        <img src="/bullionai-symbol.png" alt="" className="h-8 w-auto shrink-0 object-contain" />
        <span className="font-display text-[20px] font-bold leading-none tracking-tight text-[#0A2540]">
          BULLION<span className="text-[#B8860B]">AI</span>
        </span>
      </span>
    );
  }

  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <img src="/bullionai-logo-v2.png" alt={alt} className="h-full w-full object-contain" />
    </span>
  );
}