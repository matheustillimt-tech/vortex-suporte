"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  children?: React.ReactNode;
  className?: string;
  title?: string;
};

export function LogoutButton({ children, className, title }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function handleLogout() {
    start(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      title={title}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50",
        className,
      )}
    >
      {children ?? "Sair"}
    </button>
  );
}
