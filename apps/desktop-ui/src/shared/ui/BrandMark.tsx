import brandMark from "../assets/brand/chillclaw-logo-simple-1-640.webp";

interface BrandMarkProps {
  alt?: string;
  className?: string;
  decorative?: boolean;
}

export function BrandMark({ alt = "ChillClaw", className = "", decorative = false }: BrandMarkProps) {
  return (
    <img
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? "true" : undefined}
      className={`brand-mark ${className}`.trim()}
      src={brandMark}
    />
  );
}
