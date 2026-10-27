"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PROJECT_KEY } from "@/lib/widget-project";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { WidgetSettings } from "@/lib/supabase/types";

type Settings = Pick<WidgetSettings, "project_key" | "offline_message" | "timezone">;

export function OfflineSettingsForm({ initial }: { initial: Settings | null }) {
  const supabase = useMemo(() => createClient(), []);
  const [message, setMessage] = useState(initial ? (initial.offline_message ?? "") : "⚠️ No momento estamos fora do horário de atendimento. Deixe sua mensagem que respondemos assim que possível.");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "America/Sao_Paulo");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setSaved(false);
    setError(null);
    try {
      // Salva apenas os campos desta seção para não sobrescrever o widget
      // quando as duas telas estão abertas ao mesmo tempo.
      const { error } = await supabase.from("widget_settings").upsert({
        project_key: initial?.project_key ?? PROJECT_KEY,
        offline_message: message,
        timezone,
        updated_at: new Date().toISOString(),
      }, { onConflict: "project_key" }).select("project_key").single();
      if (error) throw error;
      setSaved(true);
    } catch {
      setError("Não foi possível salvar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto mt-6 max-w-3xl space-y-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="text-sm font-semibold">Fora do horário de atendimento</h2>
        <p className="text-xs text-muted-foreground">Mensagem exibida ao abrir o chat e enviada automaticamente a cada mensagem do cliente fora dos horários definidos acima, inclusive em atendimentos abertos. A mensagem e o fuso horário valem para todos os departamentos.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="offline-message">Mensagem</Label>
        <textarea id="offline-message" value={message} disabled={busy}
          onChange={e => { setMessage(e.target.value); setSaved(false); }} rows={5}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="business-timezone">Fuso horário</Label>
        <select id="business-timezone" value={timezone} disabled={busy}
          onChange={e => { setTimezone(e.target.value); setSaved(false); }}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          <option value="America/Sao_Paulo">America/Sao_Paulo (Brasília)</option>
          <option value="America/Manaus">America/Manaus</option>
          <option value="America/Belem">America/Belem</option>
          <option value="America/Recife">America/Recife</option>
          <option value="UTC">UTC</option>
        </select>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button onClick={save} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saved ? "Salvo" : "Salvar mensagem e fuso"}
      </Button>
    </section>
  );
}
