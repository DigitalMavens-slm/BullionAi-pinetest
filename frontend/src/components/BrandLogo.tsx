type BrandLogoProps = {
  variant?: "lockup" | "mark";
  className?: string;
  alt?: string;
};

export function BrandLogo({
  variant = "lockup",
  className = "h-12 w-16",
  alt = "BullionAI",
}: BrandLogoProps) {
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      <img
        src={variant === "mark" ? "/bullionai-logo-mark-v2.png" : "/bullionai-logo-v2.png"}
        alt={alt}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
