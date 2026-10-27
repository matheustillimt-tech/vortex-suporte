import { Logo } from "@/components/shared/Logo";
import { BRAND } from "@/lib/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen auth-bg">
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="mb-8">
          <Logo size={36} textClassName="text-base" />
        </div>
        {children}
        <p className="mt-8 text-[11px] text-muted-foreground/70">
          © {new Date().getFullYear()} {BRAND.name}
        </p>
      </main>
    </div>
  );
}
