"use client";

import { useState, useMemo } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_KEY } from "@/lib/widget-project";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WidgetSettings } from "@/lib/supabase/types";

const DEFAULTS: WidgetSettings = {
  project_key: PROJECT_KEY,
  greeting_title: "Olá 👋",
  greeting_subtitle: "Como podemos ajudar você hoje?",
  show_home: true,
  show_chat: true,
  show_updates: true,
  show_suggestions: true,
  offline_message: "⚠️ No momento estamos fora do horário de atendimento. Deixe sua mensagem que respondemos assim que possível.",
  closing_message: "Foi um prazer ajudar você! 🙂 Se precisar de mais alguma coisa, é só nos chamar novamente.",
  closing_message_enabled: true,
  brand_color: BRAND.color,
  timezone: "America/Sao_Paulo",
  updated_at: new Date().toISOString(),
};

export function WidgetSettingsForm({ initial }: { initial: WidgetSettings | null }) {
  const supabase = useMemo(() => createClient(), []);
  // Espalha sobre os DEFAULTS: coluna nova que ainda não veio do banco cai no
  // padrão em vez de virar undefined e quebrar o toggle.
  const [s, setS] = useState<WidgetSettings>({ ...DEFAULTS, ...(initial ?? {}) });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function update<K extends keyof WidgetSettings>(key: K, value: WidgetSettings[K]) {
    setS((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    const { error } = await supabase
      .from("widget_settings")
      .upsert({
        project_key: s.project_key,
        greeting_title: s.greeting_title,
        greeting_subtitle: s.greeting_subtitle,
        show_home: s.show_home,
        show_chat: s.show_chat,
        show_updates: s.show_updates,
        show_suggestions: s.show_suggestions,
        closing_message: s.closing_message,
        closing_message_enabled: s.closing_message_enabled,
        brand_color: s.brand_color,
        updated_at: new Date().toISOString(),
      });
    setBusy(false);
    if (error) return alert(error.message);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Configurações do widget</h1>
          <p className="text-sm text-muted-foreground">
            Personalize aparência, mensagens e quais abas aparecem.
          </p>
        </div>
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "Salvo" : "Salvar"}
        </Button>
      </header>

      <Section title="Hero da página inicial">
        <Field label="Saudação">
          <Input value={s.greeting_title} onChange={(e) => update("greeting_title", e.target.value)} />
        </Field>
        <Field label="Subtítulo">
          <Input value={s.greeting_subtitle} onChange={(e) => update("greeting_subtitle", e.target.value)} />
        </Field>
      </Section>

      <Section title="Abas visíveis no widget" subtitle="Desmarque pra esconder do cliente.">
        <Toggle label="Início"       checked={s.show_home}        onChange={(v) => update("show_home", v)} />
        <Toggle label="Chat"          checked={s.show_chat}        onChange={(v) => update("show_chat", v)} />
        <Toggle label="Atualizações"  checked={s.show_updates}     onChange={(v) => update("show_updates", v)} />
        <Toggle label="Sugestões"     checked={s.show_suggestions} onChange={(v) => update("show_suggestions", v)} />
      </Section>

      <Section title="Aparência">
        <Field label="Cor da marca (hex)">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={s.brand_color}
              onChange={(e) => update("brand_color", e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background"
            />
            <Input
              value={s.brand_color}
              onChange={(e) => update("brand_color", e.target.value)}
              className="font-mono"
            />
          </div>
        </Field>
      </Section>

      <Section
        title="Mensagem de encerramento"
        subtitle={`Enviada como mensagem de ${BRAND.name} quando o atendente clica em Finalizar. Desligue a chave pra não enviar nada — o texto fica guardado pra quando quiser religar.`}
      >
        <div className="space-y-3">
          <Toggle
            label="Enviar mensagem ao finalizar"
            checked={s.closing_message_enabled}
            onChange={(v) => update("closing_message_enabled", v)}
          />
          <Field label="Mensagem">
            <textarea
              value={s.closing_message ?? ""}
              onChange={(e) => update("closing_message", e.target.value)}
              rows={3}
              disabled={!s.closing_message_enabled}
              placeholder="Ex: Foi um prazer ajudar você. Se precisar de mais alguma coisa, é só chamar."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </Field>
          {!s.closing_message_enabled && (
            <p className="text-xs text-muted-foreground">
              Desligado: ao finalizar, o atendimento termina no aviso de conclusão e o
              cliente não recebe mais a mensagem de despedida.
            </p>
          )}
        </div>
      </Section>


    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md border border-border/60 px-3 py-2.5 hover:bg-muted/30">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}
