import { MAX_SUPPORT_FILE_BYTES } from "@/lib/support-upload-limits";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/widget-token";
import { clientIp, rateLimit, rateLimitHeaders } from "@/lib/security/rate-limit";
import { widgetCorsHeaders, widgetCorsResponse } from "@/lib/security/cors";

export const runtime = "nodejs";

const ALLOWED = new Set([
  // imagens
  "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml",
  // áudio
  "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav",
  // vídeo
  "video/webm", "video/mp4", "video/quicktime", "video/ogg",
  // docs
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv", "text/plain",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const RL_MAX = 20;
const RL_WINDOW = 60;

const Body = z.object({
  mime: z.string().min(1).max(120),
  size: z.number().int().positive().max(MAX_SUPPORT_FILE_BYTES),
  filename: z.string().min(1).max(255),
});

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h || !h.toLowerCase().startsWith("bearer ")) return null;
  return h.slice(7).trim();
}

function safeName(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

function bucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || "support-attachments";
}

export function OPTIONS(req: Request) {
  return widgetCorsResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = widgetCorsHeaders(origin);

  const session = verifySession(bearer(req));
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });

  const ip = clientIp(req);
  const rl = rateLimit({ key: `upload:${session.contactId}:${ip}`, max: RL_MAX, windowSec: RL_WINDOW });
  const rlHeaders = rateLimitHeaders(rl, RL_MAX);
  if (rl.blocked) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { ...corsHeaders, ...rlHeaders, "Retry-After": String(RL_WINDOW) } },
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400, headers: { ...corsHeaders, ...rlHeaders } });
  }
  const { mime, size, filename } = parsed.data;

  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "mime_not_allowed", mime }, { status: 415, headers: { ...corsHeaders, ...rlHeaders } });
  }

  const supabase = createAdminClient();
  const path = `${session.contactId}/${crypto.randomUUID()}_${safeName(filename)}`;

  const { data, error } = await supabase.storage
    .from(bucket())
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[upload] storage error:", error?.message);
    return NextResponse.json({ error: "storage_error" }, { status: 500, headers: { ...corsHeaders, ...rlHeaders } });
  }

  const { data: pub } = supabase.storage.from(bucket()).getPublicUrl(path);

  const storageUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  if (/^[a-z0-9-]+\.supabase\.co$/.test(storageUrl.hostname)) {
    storageUrl.hostname = storageUrl.hostname.replace(".supabase.co", ".storage.supabase.co");
  }
  storageUrl.pathname = "/storage/v1/upload/resumable/sign";

  return NextResponse.json(
    {
      resumableUrl: storageUrl.toString(),
      bucket: bucket(),
      uploadUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl: pub.publicUrl,
      mime,
      size,
      name: filename,
    },
    { headers: { ...corsHeaders, ...rlHeaders } },
  );
}
