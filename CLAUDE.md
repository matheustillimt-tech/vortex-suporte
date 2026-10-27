# CLAUDE.md: Vórtex Suporte

Guia pro Claude Code mexer neste template. Quem usa normalmente é dono de negócio, não programador: explique em
português simples, faça uma coisa de cada vez e peça OK antes de publicar, apagar ou mexer no banco de produção.

## O que é

Sistema de suporte ao cliente: um widget de chat (`widget.js`) que vai em qualquer site por uma tag `<script>` e abre
um iframe com a tela `/widget`, e um painel do atendente em tempo real (`/inbox` + área `/admin`). Next.js 16 (App
Router) + Supabase (Postgres, Auth, Realtime, Storage), publicado na Vercel. E-mail opcional pelo Resend.

O cliente do widget **não tem login no Supabase**: o site chama `VortexSuporte.identify()`, a rota `/api/identify`
cria/acha o contato e devolve um token de sessão assinado (HMAC com a service role, `src/lib/widget-token.ts`). As
rotas do widget usam a service role no servidor. Quem tem login no Supabase Auth são só os atendentes (tabela
`agents`, papéis `agent` e `admin`).

## Onde está cada coisa

| O quê | Onde |
|---|---|
| Marca (nome, logo, cor, site) | `src/lib/brand.ts` (lê `NEXT_PUBLIC_BRAND_*`); logo padrão `public/logo.svg`; cor aplicada em `src/app/layout.tsx` |
| Script do widget (vai no site do cliente) | `widget-sdk/src/index.ts` → `npm run build:widget` gera `public/widget.js` (não versionado) |
| Telas do widget (dentro do iframe) | `src/app/(widget)/widget/` + `src/components/widget/` (`WidgetApp.tsx` orquestra tudo) |
| Painel do atendente | `src/app/(dashboard)/` + `src/components/dashboard/` (`inbox/` = lista, conversa, ficha do contato) |
| Área de administração | `src/app/(dashboard)/admin/*` (gate único em `admin/layout.tsx`) |
| Rotas do widget | `src/app/api/identify`, `conversations`, `messages`, `upload`, `bugs`, `widget/*` (CORS em `src/lib/security/cors.ts`) |
| Rotas do painel | `src/app/api/admin/*`, `src/app/api/auth/forgot-password` |
| Reabertura de atendimento | `src/lib/conversation-reopen.ts` (só com mensagem real do cliente) |
| Segurança | `src/lib/security/` (CORS, rate limit em memória, `userHash`), `src/middleware.ts` (rotas protegidas), CSP em `next.config.ts` |
| E-mails | `src/lib/email/resend.ts` (layout, senha) e `encerramento.ts` (resumo ao finalizar) |
| Anexos | `src/lib/support-upload*.ts` (limite em `NEXT_PUBLIC_MAX_UPLOAD_MB`), bucket `support-attachments` |
| Tempo real | `src/lib/realtime/` (Postgres Changes no painel; Broadcast `wc:<id>` + polling de 3 s no widget) |
| Tipos do banco | `src/lib/supabase/types.ts` e `database.types.ts` (escritos à mão; o build ignora erros de tipo, ver `next.config.ts`) |
| Banco | `supabase/migrations/` (0001 a 0028, em ordem; tudo no esquema `public`) |
| Primeiro admin | `scripts/bootstrap-admin.mjs` |
| Variáveis | `.env.example` (todas, com comentário) |
| Guias | `README.md`, `INSTALACAO.md`, `PROMPT-DE-INSTALACAO.md` |

## Como rodar

```bash
npm install
cp .env.example .env.local   # preencher (ver INSTALACAO.md)
npm run dev                  # http://localhost:3000 (painel em /login, widget avulso em /widget)
npm run dev:widget           # em outro terminal, se for mexer no widget-sdk
npm test                     # node:test, sem internet
npm run build                # gera o widget.js e o build do Next
```

O build precisa das 3 variáveis do Supabase (pode usar valores falsos só pra compilar).
`tests/pg/reabertura-concorrencia.cjs` é um teste à parte, num Postgres de verdade (instruções no topo do arquivo).

## Como personalizar

- **Nome, logo e cor:** `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_LOGO_URL`, `NEXT_PUBLIC_BRAND_COLOR`. A cor do
  widget e do botão flutuante também vem de `widget_settings.brand_color` (tela Configurações do widget): o iframe
  aplica e manda pro `widget.js` por `postMessage({ type: "brand" })`.
- **Textos do widget configuráveis no painel:** saudação, abas, mensagem de fora do horário, mensagem de
  encerramento, blocos da tela inicial, temas e mensagem automática de cada tema, novidades.
- **Textos fixos:** widget em `src/components/widget/*` (ex.: `WidgetHeader.tsx`, `IdentifyStep.tsx`), botão
  flutuante em `widget-sdk/src/index.ts` (`LABEL`, ou `data-label` no script), e-mails em `src/lib/email/`.
- **Tema do painel:** variáveis em `src/app/globals.css` (`:root` e `.panel-theme`).
- **Dados extras do cliente:** o que o site manda em `identify({ metadata })` aparece na ficha
  (`src/components/dashboard/inbox/ContactPanel.tsx`).

## Regras

- **Nunca** versionar `.env`, `.env.local` nem qualquer chave. Segredos só no `.env.local` e nas variáveis da Vercel.
  Nunca peça pra pessoa colar chave no chat: abra o `.env.local` pra ela ou use `npx vercel env add`.
- **Migração nova sempre no fim da fila:** arquivo novo em `supabase/migrations/` com número maior que o último
  (`0029_...sql`). Nunca edite uma migração que já foi aplicada no banco de alguém; crie outra. Aplicar:
  `npx supabase db push`. Tabela nova: ligue RLS e use `public.is_agent()` / `public.is_admin()` nas políticas; se o
  painel precisar dela em tempo real, adicione na publicação `supabase_realtime`. Reflita colunas novas em
  `src/lib/supabase/types.ts`.
- Rota do widget nova: confira o token com `verifySession`, aplique `rateLimit` e os cabeçalhos de CORS, e devolva só
  o necessário (ela roda com a service role).
- `widget.js` muda a API pública (`VortexSuporte.identify/open/close/reset`): mantenha compatível, porque o código já
  está colado nos sites das pessoas.
- `NEXT_PUBLIC_*` e `WIDGET_ALLOWED_ORIGINS` entram no build: mudou, publique de novo.
- **Push na `main` pode publicar** se o repositório estiver ligado na Vercel. Confirme com a pessoa antes de
  `git push` e antes de qualquer `npx vercel --prod`.
- Rode `npm test` e `npm run build` antes de dizer que terminou.
