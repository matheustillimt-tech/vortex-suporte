import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  showText?: boolean;
  className?: string;
  textClassName?: string;
};

/** Só a imagem da logo (configurável em NEXT_PUBLIC_BRAND_LOGO_URL). */
export function BrandLogo({ size = 28, className, alt = BRAND.name }: { size?: number; className?: string; alt?: string }) {
  return (
    // <img> simples: aceita arquivo local e URL externa sem configurar domínios no Next.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND.logoUrl}
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-md object-contain", className)}
    />
  );
}

export function Logo({ size = 28, showText = true, className, textClassName }: Props) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandLogo size={size} />
      {showText && (
        <span className={cn("text-sm font-semibold tracking-tight", textClassName)}>
          {BRAND.name} <span className="text-muted-foreground font-normal">Suporte</span>
        </span>
      )}
    </div>
  );
}
