import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { BRAND, hexToHslTriplet } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: `${BRAND.name} Suporte`,
  description: `Atendimento ao cliente de ${BRAND.name}`,
  icons: { icon: BRAND.logoUrl },
};

// Cor da marca (NEXT_PUBLIC_BRAND_COLOR) aplicada nas variáveis do tema.
const brandHsl = hexToHslTriplet(BRAND.color);
const brandCss = `:root,.light{--primary:${brandHsl};--ring:${brandHsl};--brand:${brandHsl};}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      </head>
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
