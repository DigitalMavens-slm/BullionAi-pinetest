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
    <span className={`relative inline-block shrink-0 overflow-hidden ${className}`}>
      <img
        src="/bullionai-logo.png"
        alt={alt}
        className={
          variant === "mark"
            ? "absolute -left-[45%] -top-[25%] h-[190%] w-[190%] max-w-none"
            : "absolute -left-[7%] -top-[25%] h-[155%] w-auto max-w-none"
        }
      />
    </span>
  );
}
