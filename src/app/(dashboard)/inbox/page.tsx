import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupportInbox } from "@/components/dashboard/inbox/SupportInbox";
import type { Agent, ConversationWithContact } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: agent }, { data }] = await Promise.all([
    supabase.from("agents").select("id, name, email, role").eq("id", user.id).single(),
    supabase
      .from("conversations")
      .select(`
        *,
        contact:contacts(*),
        assigned_agent:agents!conversations_assigned_agent_id_fkey(id, name, email),
        last_message:messages(body, attachments, author_type, deleted_at, created_at)
      `)
      .order("last_message_at", { ascending: false })
      .order("created_at", { referencedTable: "last_message", ascending: false })
      .limit(1, { referencedTable: "last_message" })
      .limit(200),
  ]);

  const conversations = (data ?? []) as unknown as ConversationWithContact[];

  return (
    <SupportInbox
      agent={agent as Pick<Agent, "id" | "name" | "email" | "role">}
      initial={conversations}
    />
  );
}
