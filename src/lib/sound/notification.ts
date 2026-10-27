/**
 * Som de notificação gerado via Web Audio API (sem arquivo de áudio).
 * Toca um "ding" de 2 notas (E6 → G6) curto e agradável.
 *
 * IMPORTANTE — política de autoplay:
 *  Browsers bloqueiam reprodução de áudio até o usuário interagir com a página.
 *  Como o agente abre o painel e clica em coisas, o contexto vai ficar
 *  habilitado naturalmente. Antes disso, .resume() é chamado mas pode falhar
 *  silenciosamente — o próximo toque dará certo.
 */

type AnyAudioContext = AudioContext & {
  // Safari prefix
  webkitAudioContext?: AudioContext;
};

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext ?? w.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * Libera o áudio: cria/resume o AudioContext num gesto do usuário (clique/tecla).
 * Browsers só deixam tocar som depois de uma interação — chame isto uma vez,
 * cedo, pra garantir que o 1º "ping" de novo atendimento já saia.
 */
export function unlockAudio(): void {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  // Truque do buffer silencioso: destrava o áudio de vez no 1º gesto (Chrome/Safari/iOS).
  try {
    const buf = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

/** Toca um "ping" de 2 notas (~350ms total). */
export function playNotificationPing(volume = 0.18): void {
  const c = getCtx();
  if (!c) return;

  // Tenta resumir caso esteja suspenso (autoplay policy)
  if (c.state === "suspended") {
    c.resume().catch(() => {});
  }

  const now = c.currentTime;

  function playTone(freq: number, startOffset: number, duration: number) {
    const osc = (c as AnyAudioContext).createOscillator();
    const gain = (c as AnyAudioContext).createGain();
    osc.connect(gain);
    gain.connect((c as AnyAudioContext).destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    // envelope ADSR simples — sobe rápido, decai exponencial
    gain.gain.setValueAtTime(0.0001, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(volume, now + startOffset + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration + 0.02);
  }

  playTone(1318.51, 0,    0.18); // E6
  playTone(1567.98, 0.10, 0.25); // G6
}
