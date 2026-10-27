"use client";

import { Construction } from "lucide-react";

export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Construction className="h-8 w-8 text-muted-foreground" />
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs">{body}</p>
    </div>
  );
}
