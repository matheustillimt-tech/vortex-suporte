// Mesmo limite por arquivo na seleção, autorização e publicação da mensagem.
// Configure em NEXT_PUBLIC_MAX_UPLOAD_MB (padrão 50, o limite do plano grátis do
// Supabase). No plano pago dá pra subir até 400 MB: aumente também o limite global
// em Supabase > Storage > Settings.
const MAX_MB_CAP = 400;
const configured = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB);
const MAX_MB = Number.isFinite(configured) && configured > 0 ? Math.min(Math.floor(configured), MAX_MB_CAP) : 50;

export const MAX_SUPPORT_FILE_BYTES = MAX_MB * 1024 * 1024;
export const SUPPORT_FILE_LIMIT_LABEL = `${MAX_MB} MB`;
export const SUPPORT_RESUMABLE_CHUNK_BYTES = 6 * 1024 * 1024;
