"use client";

import { MAX_SUPPORT_FILE_BYTES, SUPPORT_FILE_LIMIT_LABEL, SUPPORT_RESUMABLE_CHUNK_BYTES } from "./support-upload-limits";

export type SignedSupportUpload = {
  uploadUrl: string;
  publicUrl: string;
  resumableUrl: string;
  token: string;
  path: string;
  bucket: string;
};

/** O arquivo vai direto ao Storage. A API Next recebe apenas metadados. */
export async function uploadSupportFile(file: File, sign: SignedSupportUpload, onProgress: (percent: number) => void): Promise<void> {
  if (file.size > MAX_SUPPORT_FILE_BYTES) throw new Error(`O arquivo excede ${SUPPORT_FILE_LIMIT_LABEL}.`);
  if (file.size <= SUPPORT_RESUMABLE_CHUNK_BYTES) {
    const response = await fetch(sign.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!response.ok) throw new Error(`Falha ao enviar o arquivo (${response.status}).`);
    onProgress(100);
    return;
  }
  const { Upload } = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: sign.resumableUrl,
      headers: { "x-signature": sign.token, ...(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } : {}) },
      chunkSize: SUPPORT_RESUMABLE_CHUNK_BYTES,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      uploadDataDuringCreation: true,
      // Retoma falhas desta tentativa; não mistura arquivos/assinaturas de
      // outra conversa ou sessão em um registro persistente no navegador.
      storeFingerprintForResuming: false,
      metadata: { bucketName: sign.bucket, objectName: sign.path, contentType: file.type, cacheControl: "3600" },
      onProgress: (sent, total) => onProgress(total ? Math.round(sent / total * 100) : 0),
      onError: (error) => {
        const status = "originalResponse" in error ? error.originalResponse?.getStatus() : undefined;
        const responseBody = "originalResponse" in error ? error.originalResponse?.getBody() ?? "" : "";
        // Não registra o erro TUS completo: ele inclui URL e assinatura.
        const diagnostic = responseBody
          .replace(/https?:\/\/\S+|[A-Za-z0-9_=-]{40,}|[\w.+-]+@[\w.-]+/g, "[redacted]")
          .slice(0, 200);
        console.error("[support-upload] Storage recusou envio", JSON.stringify({ status, diagnostic }));
        if (status === 413 || /maximum.*size|size.*limit|exceeded.*size/i.test(responseBody)) {
          reject(new Error("O armazenamento recusou o tamanho do arquivo. Entre em contato com o suporte; seu arquivo continua selecionado."));
        } else {
          reject(new Error(`O envio foi interrompido${status ? ` (código ${status})` : ""}. Confira sua conexão e tente novamente; o arquivo continua selecionado.`));
        }
      },
      onSuccess: () => { onProgress(100); resolve(); },
    });
    upload.start();
  });
}
