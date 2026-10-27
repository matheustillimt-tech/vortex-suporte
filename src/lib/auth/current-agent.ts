import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Agent } from "@/lib/supabase/types";

/**
 * Carrega o agente da request atual. Memoizado com React.cache():
 * múltiplas chamadas (layout + page + sub-componentes) compartilham
 * o mesmo resultado dentro do mesmo render.
 */
export const getCurrentAgent = cache(async (): Promise<Pick<Agent, "id" | "name" | "email" | "role"> | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, email, role")
    .eq("id", user.id)
    .maybeSingle();
  return agent ?? null;
});

export async function requireAgent() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");
  return agent;
}

export async function requireAdmin() {
  const agent = await getCurrentAgent();
  if (!agent) redirect("/login");
  if (agent.role !== "admin") redirect("/inbox");
  return agent;
}
