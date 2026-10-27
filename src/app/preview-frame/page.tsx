"use client";

/**
 * Página pública usada APENAS dentro de iframes do painel admin para
 * pré-visualizar o widget. Carrega o widget.js exatamente como o seu site
 * faria, com um conteúdo "fake" simulando uma página real.
 *
 * Aceita ?theme=light|dark e ?plan=pro|free por query pra simular variações.
 */

import { useEffect, useState } from "react";
import { PROJECT_KEY } from "@/lib/widget-project";
import { BRAND } from "@/lib/brand";

declare global {
  interface Window {
    VortexSuporte?: {
      identify: (p: Record<string, unknown>) => void;
      open: () => void;
      close: () => void;
      reset: () => void;
    };
  }
}

export default function PreviewFrame() {
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTheme(params.get("theme") === "dark" ? "dark" : "light");

    const script = document.createElement("script");
    script.src = "/widget.js?cb=" + Date.now(); // cache-bust pra hot reload
    script.dataset.project = PROJECT_KEY;
    script.dataset.host = window.location.origin;
    script.async = true;
    script.onload = () => {
      window.VortexSuporte?.identify({
        email: "preview@exemplo.com",
        name: "Cliente de Teste",
        userId: "preview_user",
        metadata: { plano: params.get("plan") ?? "pro" },
      });
      // Abre automaticamente pra economizar 1 clique
      if (params.get("autoOpen") !== "false") {
        setTimeout(() => window.VortexSuporte?.open(), 300);
      }
      setLoaded(true);
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup pro hot-reload do iframe
      window.VortexSuporte?.reset();
      const btn = document.getElementById("__vortex_suporte_launcher");
      const frame = document.getElementById("__vortex_suporte_frame");
      btn?.remove();
      frame?.remove();
      script.remove();
    };
  }, []);

  const isDark = theme === "dark";

  return (
    <div
      className={`min-h-screen ${
        isDark ? "bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"
      }`}
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      {/* Fake header */}
      <header
        className={`flex items-center justify-between border-b px-6 py-4 ${
          isDark ? "border-white/10 bg-zinc-900" : "border-zinc-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-emerald-500" />
          <span className="font-bold">{BRAND.name}</span>
        </div>
        <nav className="hidden gap-5 text-sm md:flex">
          <a className="opacity-70 hover:opacity-100">Início</a>
          <a className="opacity-70 hover:opacity-100">Planos</a>
          <a className="opacity-70 hover:opacity-100">Recursos</a>
          <a className="opacity-70 hover:opacity-100">Suporte</a>
        </nav>
        <button
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
          type="button"
        >
          Entrar
        </button>
      </header>

      {/* Fake hero */}
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600">
            ✨ Preview
          </span>
          <h1 className="text-2xl font-bold leading-tight md:text-3xl">
            Esta é uma simulação do site do cliente
          </h1>
          <p className={`${isDark ? "text-zinc-400" : "text-zinc-600"} text-sm leading-relaxed`}>
            O botão flutuante no canto inferior direito é o widget de suporte exatamente como
            aparece no seu site ou app. Clique para interagir.
          </p>
        </div>

        <div
          className={`rounded-xl border p-5 ${
            isDark ? "border-white/10 bg-zinc-900/50" : "border-zinc-200 bg-white"
          }`}
        >
          <div className="space-y-2.5">
            <div className={`h-3 w-3/4 rounded ${isDark ? "bg-white/10" : "bg-zinc-200"}`} />
            <div className={`h-3 w-full rounded ${isDark ? "bg-white/10" : "bg-zinc-200"}`} />
            <div className={`h-3 w-5/6 rounded ${isDark ? "bg-white/10" : "bg-zinc-200"}`} />
            <div className={`h-3 w-2/3 rounded ${isDark ? "bg-white/10" : "bg-zinc-200"}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={`aspect-square rounded-lg ${
                isDark ? "bg-white/5" : "bg-white shadow-sm border border-zinc-200"
              }`}
            />
          ))}
        </div>

        <div className={`pt-2 text-center text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
          {loaded ? "✓ Widget carregado" : "Carregando widget…"}
        </div>
      </main>
    </div>
  );
}
