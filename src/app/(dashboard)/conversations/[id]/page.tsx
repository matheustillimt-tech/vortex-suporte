import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

// Mantém URLs antigas funcionando: redireciona pro inbox com a conversa selecionada.
export default async function LegacyConversationPage({ params }: Params) {
  const { id } = await params;
  redirect(`/inbox?c=${id}`);
}
