import { playNotificationPing, unlockAudio } from "../../src/lib/sound/notification";
/**
 * Vórtex Suporte — script do widget (o botão flutuante que vai no seu site ou app)
 *
 * Uso:
 *   <script src="https://suporte.seu-dominio.com.br/widget.js"
 *           data-project="principal"
 *           data-host="https://suporte.seu-dominio.com.br"
 *           data-color="#7c3aed"></script>
 *   <script>
 *     VortexSuporte.identify({
 *       userId: 'usuario_42',          // id do cliente no seu sistema (opcional)
 *       email:  'cliente@exemplo.com', // obrigatório
 *       name:   'Ana Souza',           // recomendado
 *       metadata: { plano: 'pro' }     // opcional: aparece pro atendente
 *     });
 *   </script>
 */

type IdentifyInput = {
  userId?: string | null;
  email: string;
  name?: string | null;
  /** Dados extras do cliente (plano, empresa, cidade...). O atendente vê no painel. */
  metadata?: Record<string, unknown>;
  /** HMAC-SHA256(email, WIDGET_VERIFY_SECRET).hex — calcule no servidor do seu site
   *  pra ninguém se passar por outro cliente. Quando WIDGET_REQUIRE_USER_HASH=true
   *  no servidor, é obrigatório. */
  userHash?: string;
  [key: string]: unknown;
};

interface SDK {
  identify: (input: IdentifyInput) => void;
  open: () => void;
  close: () => void;
  reset: () => void;
}

const STYLE_ID = "__vortex_suporte_styles";
const THEME_ID = "__vortex_suporte_theme";
const NOTICE_ID = "__vortex_suporte_notice";
const BUTTON_ID = "__vortex_suporte_launcher";
const FRAME_ID = "__vortex_suporte_frame";
const DEFAULT_COLOR = "#7c3aed";

const CSS = `
#${NOTICE_ID} { position:fixed;right:20px;bottom:48px;z-index:2147483640;max-width:calc(100vw - 40px);border:1px solid var(--vxs-bg, ${DEFAULT_COLOR});border-radius:12px;padding:12px 16px;background:#fff;color:#111827;box-shadow:0 4px 20px #0002;cursor:pointer;font:600 13px system-ui;}
#${NOTICE_ID}[hidden] {display:none;}
@media(max-width:480px){#${NOTICE_ID}{right:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 70px);max-width:calc(100vw - 28px);}}

#${BUTTON_ID} {
  position: fixed; right: 20px; bottom: 0; z-index: 2147483640;
  height: 35px; padding: 0 14px 0 11px; margin: 0;
  border-radius: 12px 12px 0 0;
  background: var(--vxs-bg, ${DEFAULT_COLOR});
  color: var(--vxs-fg, #ffffff);
  border: 0;
  border-bottom: 0;
  cursor: pointer;
  box-shadow: 0 -5px 18px rgba(0,0,0,.18), 0 -1px 3px rgba(0,0,0,.08);
  display: inline-flex; align-items: center; gap: 7px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 13px; font-weight: 600; letter-spacing: -.01em;
  transition: transform .18s ease, box-shadow .18s ease, background .18s ease;
}
#${BUTTON_ID}:hover { transform: translateY(-2px); box-shadow: 0 -9px 26px rgba(0,0,0,.24), 0 -2px 5px rgba(0,0,0,.10); }
#${BUTTON_ID} svg { width: 16px; height: 16px; flex-shrink: 0; }
#${BUTTON_ID} .__gc_label { line-height: 1; }
#${BUTTON_ID} .__gc_badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  border-radius: 9999px;
  background: #ffffff; color: #111827;
  font-size: 11px; font-weight: 700; line-height: 1;
  margin-left: 2px;
  box-shadow: 0 0 0 2px var(--vxs-bg, ${DEFAULT_COLOR});
  animation: __gc_pop .25s ease-out;
}
@keyframes __gc_pop {
  0% { transform: scale(0.6); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

#${FRAME_ID} {
  position: fixed; right: 20px; bottom: 35px; z-index: 2147483641;
  width: 380px; height: 600px; max-height: calc(100vh - 55px);
  border: 0; border-radius: 18px 18px 0 0;
  box-shadow: 0 20px 56px rgba(0,0,0,.28), 0 4px 12px rgba(0,0,0,.10);
  background: #0a0a0a; opacity: 0; transform: translateY(8px);
  transition: opacity .2s ease, transform .2s ease;
  pointer-events: none;
}
#${FRAME_ID}.open { opacity: 1; transform: translateY(0); pointer-events: auto; }

@media (max-width: 480px) {
  /* No mobile o launcher vira um botão REDONDO compacto só com o ícone —
     menos intrusivo que a pílula com texto. Respeita a área segura do iPhone. */
  #${BUTTON_ID} {
    right: 14px; bottom: calc(env(safe-area-inset-bottom, 0px) + 14px);
    height: 46px; width: 46px; padding: 0; gap: 0;
    border-radius: 9999px; justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,.22), 0 1px 3px rgba(0,0,0,.12);
  }
  #${BUTTON_ID}:hover { transform: none; }
  #${BUTTON_ID} .__gc_label { display: none; }
  #${BUTTON_ID} svg { width: 20px; height: 20px; }
  #${BUTTON_ID} .__gc_badge {
    position: absolute; top: -3px; right: -3px; margin: 0;
    box-shadow: 0 0 0 2px #ffffff;
  }
  #${FRAME_ID} {
    right: 0; left: 0; bottom: 0; width: 100vw; height: 100vh;
    max-height: 100vh; border-radius: 0;
  }
}
`;

// Balão de chat com 3 pontinhos
const ICON_CHAT = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C6.486 3 2 6.916 2 11.5c0 2.04.901 3.97 2.532 5.515-.215 1.024-.762 2.36-1.83 3.61a.62.62 0 0 0 .538 1.024c2.087-.273 3.654-.93 4.749-1.626A11.85 11.85 0 0 0 12 20c5.514 0 10-3.916 10-8.5S17.514 3 12 3Zm-4.5 9.75a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm4.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm4.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
let LABEL = "Suporte";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Aceita só cor hexadecimal (#abc ou #aabbcc). */
function safeColor(value: unknown): string | null {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : null;
}

/** Texto branco ou escuro, o que contrastar melhor com a cor do botão. */
function readableText(hex: string): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? "#111827" : "#ffffff";
}

/** Aplica a cor da marca no botão e no aviso (via variáveis CSS). */
function applyColor(value: unknown): void {
  const color = safeColor(value);
  if (!color) return;
  let el = document.getElementById(THEME_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = THEME_ID;
    document.head.appendChild(el);
  }
  el.textContent = `#${BUTTON_ID},#${NOTICE_ID}{--vxs-bg:${color};--vxs-fg:${readableText(color)};}`;
}

function buttonContent(open: boolean, unread = 0): string {
  const label = open ? "Fechar" : unread > 0 ? "Nova resposta do suporte" : escapeHtml(LABEL);
  const icon = open ? ICON_CLOSE : ICON_CHAT;
  const badge =
    !open && unread > 0
      ? `<span class="__gc_badge">${unread > 99 ? "99+" : String(unread)}</span>`
      : "";
  return `${icon}<span class="__gc_label">${label}</span>${badge}`;
}

function getScriptTag(): HTMLScriptElement | null {
  if (document.currentScript instanceof HTMLScriptElement) return document.currentScript;
  const found = document.querySelector('script[src*="widget.js"]');
  return (found as HTMLScriptElement) ?? null;
}

function resolveHost(scriptTag: HTMLScriptElement | null): string {
  const explicit = scriptTag?.dataset?.host;
  if (explicit) return explicit.replace(/\/$/, "");
  if (scriptTag?.src) {
    try {
      const u = new URL(scriptTag.src);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* ignore */
    }
  }
  return "";
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}

interface InternalState {
  host: string;
  projectKey: string;
  identity: IdentifyInput | null;
  iframe: HTMLIFrameElement | null;
  button: HTMLButtonElement | null;
  isReady: boolean;
  isOpen: boolean;
  unread: number;
  pendingIdentify: IdentifyInput | null;
}

const state: InternalState = {
  host: "",
  projectKey: "",
  identity: null,
  iframe: null,
  button: null,
  isReady: false,
  isOpen: false,
  unread: 0,
  pendingIdentify: null,
};

function ensureIframe(): HTMLIFrameElement {
  if (state.iframe) return state.iframe;
  const iframe = document.createElement("iframe");
  iframe.id = FRAME_ID;
  iframe.src = `${state.host}/widget?project=${encodeURIComponent(state.projectKey)}`;
  iframe.allow = "clipboard-write; autoplay";
  iframe.setAttribute("title", "Suporte");
  document.body.appendChild(iframe);
  state.iframe = iframe;
  return iframe;
}

function postToFrame(msg: unknown): void {
  if (!state.iframe?.contentWindow) return;
  state.iframe.contentWindow.postMessage(msg, "*");
}

function sendIdentify(): void {
  if (!state.identity || !state.isReady) return;
  postToFrame({ type: "identify", payload: state.identity });
}

function openWidget(): void {
  ensureIframe();
  requestAnimationFrame(() => {
    state.iframe?.classList.add("open");
  });
  state.isOpen = true;
  if (state.isReady) {
    if (state.unread > 0) postToFrame({ type: "open-chat" });
    postToFrame({ type: "widget-opened" });
  }
  // O iframe confirma a leitura quando a conversa estiver visível.
  refreshButton();
}

function closeWidget(): void {
  state.iframe?.classList.remove("open");
  state.isOpen = false;
  if (state.isReady) postToFrame({ type: "widget-closed" });
  refreshButton();
}

function refreshButton(): void {
  if (!state.button) return;
  state.button.innerHTML = buttonContent(state.isOpen, state.unread);
  let notice = document.getElementById(NOTICE_ID) as HTMLButtonElement | null;
  if (!notice) {
    notice = document.createElement("button"); notice.id = NOTICE_ID; notice.type = "button";
    notice.setAttribute("aria-live", "polite"); notice.addEventListener("click", openWidget); document.body.appendChild(notice);
  }
  notice.hidden = state.isOpen || state.unread === 0;
  notice.textContent = state.unread > 0 ? "O suporte respondeu. Toque para ler." : "";
  state.button.setAttribute(
    "aria-label",
    state.isOpen
      ? "Fechar suporte"
      : state.unread > 0
        ? `Abrir suporte (${state.unread} ${state.unread === 1 ? "mensagem" : "mensagens"} não lida${state.unread === 1 ? "" : "s"})`
        : "Abrir suporte",
  );
}

function toggleWidget(): void {
  if (state.isOpen) closeWidget();
  else openWidget();
}

function setupButton(): void {
  if (document.getElementById(BUTTON_ID)) return;
  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.type = "button";
  btn.setAttribute("aria-label", "Abrir suporte");
  btn.innerHTML = buttonContent(false, 0);
  btn.addEventListener("click", () => {
    unlockAudio();
    toggleWidget();
    refreshButton();
  });
  document.body.appendChild(btn);
  state.button = btn;
}

function listenForFrame(): void {
  window.addEventListener("message", (e) => {
    if (!state.iframe || e.source !== state.iframe.contentWindow || e.origin !== state.host) return;
    const msg = e.data as { type?: string; count?: number; color?: string };
    if (msg?.type === "ready") {
      state.isReady = true;
      if (state.identity) sendIdentify();
      // Informa o estado atual do widget assim que o iframe estiver pronto
      postToFrame({ type: state.isOpen ? "widget-opened" : "widget-closed" });
      postToFrame({ type: "page-visibility", visible: !document.hidden });
    } else if (msg?.type === "brand") {
      // Cor definida no painel (Widget > Configurações > Cor da marca).
      applyColor(msg.color);
    } else if (msg?.type === "requestClose") {
      closeWidget();
    } else if (msg?.type === "unread") {
      const n = Math.max(0, Math.floor(msg.count ?? 0));
      if (n !== state.unread) {
        if (n > state.unread && (!state.isOpen || document.hidden)) playNotificationPing(0.18);
        state.unread = n;
        refreshButton();
      }
    }
  });
}

function boot(): void {
  const tag = getScriptTag();
  state.host = resolveHost(tag);
  state.projectKey = tag?.dataset?.project || "principal";
  if (tag?.dataset?.label) LABEL = tag.dataset.label.slice(0, 40);

  injectStyles();
  applyColor(tag?.dataset?.color);

  const start = () => {
    setupButton();
    document.addEventListener("pointerdown", unlockAudio, { once: true });
    document.addEventListener("keydown", unlockAudio, { once: true });
    document.addEventListener("visibilitychange", () => postToFrame({ type: "page-visibility", visible: !document.hidden }));
    // pré-cria iframe pra deixar pronto (carregamento em background)
    ensureIframe();
    listenForFrame();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

const sdk: SDK = {
  identify(input) {
    if (!input || !input.email) {
      console.warn("[VortexSuporte] identify(): email é obrigatório.");
      return;
    }
    const { userId, name, email, ...rest } = input;
    state.identity = {
      ...rest,
      email,
      name: name ?? null,
      userId: userId ?? null,
    };
    sendIdentify();
  },
  open: openWidget,
  close: closeWidget,
  reset() {
    state.identity = null;
    state.unread = 0;
    refreshButton();
    if (state.isReady) postToFrame({ type: "reset" });
  },
};

boot();

declare global {
  interface Window {
    VortexSuporte: SDK;
  }
}

(window as unknown as { VortexSuporte: SDK }).VortexSuporte = sdk;

export default sdk;
