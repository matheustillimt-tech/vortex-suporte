"use client";

import { useState } from "react";
import { AlertCircle, Check, Code, Copy, ExternalLink, Globe, KeyRound, Lightbulb, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = { host: string; projectKey: string; color: string };

export function InstallSnippets({ host, projectKey, color }: Props) {
  const scriptTag = `<script
  src="${host}/widget.js"
  data-project="${projectKey}"
  data-host="${host}"
  data-color="${color}">
</script>`;

  const identifyJs = `<script>
  // Chame logo depois que o cliente fizer login no seu site ou app.
  // Troque os {{...}} pelos dados do cliente logado (cada sistema tem o seu jeito).
  window.VortexSuporte.identify({
    email:  '{{cliente.email}}',   // obrigatório
    name:   '{{cliente.nome}}',    // recomendado
    userId: '{{cliente.id}}',      // opcional: id do cliente no seu sistema
    metadata: {                    // opcional: o atendente vê no painel
      plano: '{{cliente.plano}}'
    }
  });
</script>`;

  const allInOne = `<!-- Vórtex Suporte — cole antes do </body> das páginas com login -->
${scriptTag}
${identifyJs}`;

  const apiSnippet = `// Métodos disponíveis no objeto global VortexSuporte
VortexSuporte.identify({ email, name, userId, metadata, userHash });
VortexSuporte.open();    // abre o painel do widget
VortexSuporte.close();   // fecha o painel do widget
VortexSuporte.reset();   // limpa a sessão (chame quando o cliente sair do seu site)`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Instalação do widget</h1>
        <p className="text-sm text-muted-foreground">
          Cole este código no seu site ou app (nas páginas em que o cliente já fez login) para ativar o suporte flutuante.
        </p>
      </header>

      <Step icon={Code} title="1. Cole o código completo" subtitle="Tag de script + identificação do cliente em um bloco só.">
        <CodeBlock code={allInOne} highlight />
      </Step>

      <Step icon={KeyRound} title="2. Configurações importantes">
        <ConfigGrid
          rows={[
            { icon: Globe, label: "URL pública do widget", value: `${host}/widget.js` },
            { icon: KeyRound, label: "Project key", value: projectKey },
            { icon: Send, label: "Endpoint de identificação", value: `${host}/api/identify` },
          ]}
        />
      </Step>

      <Step icon={Lightbulb} title="3. API JS exposta" subtitle="Disponível na window depois que o widget.js carregar.">
        <CodeBlock code={apiSnippet} language="js" />
      </Step>

      <Step icon={AlertCircle} title="Dicas">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Coloque o código só em páginas com login — assim o widget já sabe quem é o cliente.</li>
          <li>• Mudou algum dado do cliente (plano, por exemplo)? Basta chamar <code className="rounded bg-muted px-1.5 py-0.5 text-xs">identify()</code> de novo.</li>
          <li>• Quando o cliente sair do seu site, chame <code className="rounded bg-muted px-1.5 py-0.5 text-xs">VortexSuporte.reset()</code> para limpar a sessão.</li>
          <li>• Só os endereços listados em <code className="rounded bg-muted px-1.5 py-0.5 text-xs">WIDGET_ALLOWED_ORIGINS</code> conseguem mostrar o widget.</li>
          <li>• Pra ninguém se passar por outro cliente, mande também o <code className="rounded bg-muted px-1.5 py-0.5 text-xs">userHash</code> (veja o INSTALACAO.md).</li>
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`${host}/widget?email=teste@exemplo.com&name=Teste`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir widget standalone
          </a>
        </div>
      </Step>
    </div>
  );
}

function Step({
  icon: Icon, title, subtitle, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="ml-9">{children}</div>
    </section>
  );
}

function CodeBlock({ code, highlight = false, language = "html" }: { code: string; highlight?: boolean; language?: "html" | "js" }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      alert("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <div className={cn("group relative overflow-hidden rounded-lg border", highlight ? "border-primary/30" : "")}>
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{language}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={copy}
          className="h-7 gap-1.5 text-xs"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copiado!" : "Copiar"}
        </Button>
      </div>
      <pre className="overflow-x-auto scroll-thin bg-background px-4 py-3 text-xs leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

function ConfigGrid({
  rows,
}: {
  rows: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }[];
}) {
  return (
    <dl className="overflow-hidden rounded-lg border bg-background divide-y text-sm">
      {rows.map(({ icon: Icon, label, value }) => (
        <div key={label} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="truncate font-mono text-xs">{value}</dd>
          </div>
          <CopyIconButton value={value} />
        </div>
      ))}
    </dl>
  );
}

function CopyIconButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* ignore */
        }
      }}
      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      aria-label="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
