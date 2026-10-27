# Instalação do Vórtex Suporte (passo a passo manual)

Este guia instala o Vórtex Suporte do zero, nas suas contas. Prefere que o Claude Code faça com você? Use o
[PROMPT-DE-INSTALACAO.md](PROMPT-DE-INSTALACAO.md). Os dois seguem a mesma ordem.

Tempo estimado: 1 hora na primeira vez.

---

## 1. Contas

| Conta | Pra quê | Tem plano grátis? |
|---|---|---|
| [GitHub](https://github.com) | Guardar a sua cópia do código | Sim |
| [Supabase](https://supabase.com) | Banco de dados, login da equipe, tempo real e anexos | Sim. No grátis: anexos de até 50 MB por arquivo e o projeto pausa depois de 7 dias sem uso. Pra uso diário de empresa, avalie o Pro |
| [Vercel](https://vercel.com) | Colocar o sistema no ar (hospedagem) | Sim (Hobby), mas o Hobby é pra uso não comercial. Pra empresa, a Vercel pede o Pro (pago) |
| [Resend](https://resend.com) (opcional) | E-mail de "esqueci minha senha" e o resumo da conversa que o cliente recebe ao encerrar | Sim, com limite de envios por mês. Precisa de um domínio seu (ex.: `seu-dominio.com.br`) |

Você também vai precisar, no computador: **Node.js 20 ou mais novo** ([nodejs.org](https://nodejs.org)) e **Git**
([git-scm.com](https://git-scm.com)). Os programas da Supabase e da Vercel rodam com `npx` (não precisa instalar).

> **Use um projeto do Supabase só pra este sistema.** As tabelas ficam no esquema `public` e os logins do Supabase
> Auth são os da sua equipe de atendimento. Não instale dentro do projeto de outro sistema seu.

---

## 2. Baixar o código

No terminal, numa pasta onde você guarda projetos:

```bash
git clone https://github.com/matheustillimt-tech/vortex-suporte.git
cd vortex-suporte
npm install
cp .env.example .env.local
```

O arquivo `.env.local` guarda as suas chaves. Ele **nunca** vai pro GitHub (o `.gitignore` já impede). Abra no seu
editor e vá preenchendo conforme os próximos passos.

Gere já o segredo da assinatura do widget (cole o resultado em `WIDGET_VERIFY_SECRET` no `.env.local`):

```bash
openssl rand -hex 32
```

---

## 3. Banco de dados (Supabase)

1. Em [supabase.com](https://supabase.com), **New project**. Escolha a região **South America (São Paulo)** e anote a
   senha do banco (você vai digitar no terminal).
2. Copie as chaves pro `.env.local`:
   - **Project URL** (no botão **Connect** ou em **Project Settings → Data API**) → `NEXT_PUBLIC_SUPABASE_URL`;
   - em **Project Settings → API Keys**: a chave pública (`anon`, na aba "Legacy API Keys", ou a `publishable`) →
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
   - a chave secreta (`service_role`, ou a `secret`) → `SUPABASE_SERVICE_ROLE_KEY`. Ela é **secreta**: dá acesso total
     ao banco. Nunca coloque no código do seu site.
3. Aplique o banco (as tabelas, regras de segurança, o bucket de anexos e o tempo real ficam em
   `supabase/migrations/`, aplicadas em ordem):

   ```bash
   npx supabase login
   npx supabase link --project-ref SEU-REF
   npx supabase db push
   ```

   O `SEU-REF` é o código do projeto: aparece no endereço do painel (`supabase.com/dashboard/project/SEU-REF`). O
   `link` pede a senha do banco: digite no terminal. O `db push` mostra as 28 migrações e pede confirmação.

   O banco já nasce com: 3 departamentos (Suporte, Financeiro, Comercial), 3 temas ligados a eles, 6 motivos de
   encerramento, 3 blocos na tela inicial do widget e a configuração do widget. Tudo editável no painel.
4. **Feche o cadastro aberto:** em **Authentication → Sign In / Providers**, desligue **"Allow new users to sign up"**.
   Quem entra no painel é só quem um administrador cadastra na tela Agentes. (O login por e-mail e senha continua
   ligado.)
5. Confira o **tempo real**: em **Database → Publications → supabase_realtime**, as tabelas `conversations`,
   `messages`, `contact_notes`, `conversation_events`, `bug_reports`, `labels` e `contact_labels` devem estar
   marcadas (as migrações já fazem isso). Em **Realtime → Settings**, deixe o acesso a canais públicos permitido
   (opção "private channels only" desligada, que é o padrão): é por eles que o widget recebe as respostas na hora.

Este sistema não usa Edge Functions, segredos do Supabase (`supabase secrets set`) nem o Vault: tudo roda na Vercel.

---

## 4. Variáveis de ambiente

Todas estão no `.env.example`, com comentário. Resumo:

| Variável | Pra que serve | Onde pegar | Obrigatória? |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Endereço do banco | Supabase → Connect / Data API | Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública do Supabase (`anon` ou `publishable`) | Supabase → API Keys | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta do Supabase (`service_role` ou `secret`). Também assina a sessão do widget | Supabase → API Keys | Sim |
| `NEXT_PUBLIC_APP_URL` | Endereço público deste sistema, sem barra no final (ex.: `https://suporte.seu-dominio.com.br`) | O endereço que a Vercel der (ou o seu domínio) | Sim, em produção |
| `WIDGET_ALLOWED_ORIGINS` | Sites que podem mostrar o widget, separados por vírgula (ex.: `https://seu-dominio.com.br,https://app.seu-dominio.com.br`). Vazio = qualquer site | Os endereços do seu site | Recomendada |
| `NEXT_PUBLIC_WIDGET_PROJECT_KEY` | Código do widget (o `data-project` do script). Deixe `principal` | — | Não |
| `NEXT_PUBLIC_BRAND_NAME` | Nome da sua empresa no painel, no widget e nos e-mails | Você escolhe | Não (padrão "Sua Empresa") |
| `NEXT_PUBLIC_BRAND_LOGO_URL` | Logo: arquivo em `public/` (ex.: `/logo.svg`) ou endereço `https://` | Você escolhe | Não |
| `NEXT_PUBLIC_BRAND_COLOR` | Cor principal (`#rrggbb`) | Você escolhe | Não (padrão `#7c3aed`) |
| `NEXT_PUBLIC_BRAND_SITE_URL` | Seu site/app. Vira o botão "Falar com o suporte" no e-mail de encerramento | O endereço do seu site | Não |
| `WIDGET_VERIFY_SECRET` | Segredo da assinatura do cliente (`userHash`). O mesmo valor vai no servidor do seu site | `openssl rand -hex 32` | Recomendada |
| `WIDGET_REQUIRE_USER_HASH` | `true` = recusa cliente sem assinatura válida (visitantes sem login continuam entrando, marcados como visitante) | — | Não (padrão `false`) |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | Tamanho máximo de cada anexo em MB (máx. 400) | — | Não (padrão 50) |
| `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET` / `SUPABASE_STORAGE_BUCKET` | Nome do bucket de anexos | — | Não (padrão `support-attachments`) |
| `RESEND_API_KEY` | Chave do Resend | resend.com → API Keys | Só se for usar e-mail |
| `RESEND_FROM_EMAIL` | Remetente, num domínio verificado no Resend (ex.: `suporte@seu-dominio.com.br`) | Você escolhe | Só se for usar e-mail |
| `RESEND_FROM_NAME` | Nome do remetente | Você escolhe | Não |

As que começam com `NEXT_PUBLIC_` e a `WIDGET_ALLOWED_ORIGINS` entram no sistema na hora da publicação: mudou, publique
de novo (na Vercel, **Deployments → ⋯ → Redeploy**).

---

## 5. Testar no seu computador (opcional, mas recomendado)

```bash
npm test         # testes automáticos (não precisam de internet)
npm run build    # confere se tudo compila
npm run dev      # abre em http://localhost:3000
```

Pra ver o widget num site de teste, abra o arquivo `examples/demo.html` (ele carrega o `widget.js` de
`http://localhost:3000`). Se o navegador bloquear, sirva a pasta com `npx serve examples` e abra o endereço que ele
mostrar.

---

## 6. Publicar na Vercel

**Pelo site (mais fácil):**

1. Suba o código pro seu GitHub (um repositório seu, pode ser privado).
2. Na [Vercel](https://vercel.com), **Add New → Project** e importe o repositório. O tipo (Next.js) é detectado
   sozinho; o comando de build (`npm run build`) já gera o `widget.js`.
3. Em **Environment Variables**, cadastre as variáveis do passo 4 (copie do seu `.env.local`).
4. **Deploy.** Quando terminar, copie o endereço (`https://seu-projeto.vercel.app` ou o seu domínio, em
   **Settings → Domains**).
5. Atualize `NEXT_PUBLIC_APP_URL` com esse endereço (sem barra no final) e confira `WIDGET_ALLOWED_ORIGINS`. Publique
   de novo (**Redeploy**).

**Pelo terminal:**

```bash
npx vercel link                              # cria/liga o projeto
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production   # repita pra cada variável (o valor é pedido no terminal)
npx vercel --prod                            # publica
```

O `vercel.json` já configura o cabeçalho do `widget.js` (pode ser carregado por qualquer site) e a região de São Paulo
(`gru1`). Não há rotinas agendadas (crons).

> Push na branch `main` publica sozinho se o repositório estiver ligado na Vercel.

---

## 7. Criar o primeiro administrador

**Jeito 1 (terminal, com o `.env.local` preenchido):**

```bash
node scripts/bootstrap-admin.mjs voce@exemplo.com "Seu Nome"
```

Ele pede a senha no terminal (o que você digita não aparece) e grava você como administrador. Pode rodar de novo
sem problema.

**Jeito 2 (pelo painel do Supabase):**

1. **Authentication → Users → Add user → Create new user**, com o seu e-mail, uma senha e **Auto Confirm User**
   marcado.
2. **SQL Editor**, troque o e-mail e o nome e rode:

   ```sql
   insert into public.agents (id, name, email, role)
   select id, 'Seu Nome', email, 'admin' from auth.users where email = 'voce@exemplo.com'
   on conflict (id) do update set role = 'admin';
   ```

Entre em `SEU-ENDERECO/login`. Os outros atendentes você cadastra no painel, em **Agentes** (nome, e-mail, senha
provisória e papel: atendente ou administrador).

---

## 8. Ligar as integrações

### 8.1 Widget no seu site

No painel, abra **Instalação**: o código já vem com o seu endereço e a sua cor. Cole antes do `</body>` das páginas
do seu site (o ideal é nas páginas em que o cliente já fez login):

```html
<script
  src="https://suporte.seu-dominio.com.br/widget.js"
  data-project="principal"
  data-host="https://suporte.seu-dominio.com.br"
  data-color="#7c3aed">
</script>
<script>
  // Depois do login do cliente no seu site:
  window.VortexSuporte.identify({
    email: "cliente@exemplo.com",   // obrigatório
    name: "Ana Souza",              // recomendado
    userId: "usuario_42",           // opcional: id do cliente no seu sistema
    metadata: { plano: "pro" },     // opcional: aparece pro atendente na ficha
    userHash: "..."                 // recomendado: assinatura (ver abaixo)
  });
</script>
```

- `VortexSuporte.open()` / `.close()` abrem e fecham a janela; `VortexSuporte.reset()` limpa a sessão (chame quando o
  cliente sair do seu site).
- Opcional: `data-label="Ajuda"` troca o texto do botão.
- **Site sem login:** se o seu site não chamar `identify()`, o widget pede nome e e-mail antes do chat. Esses contatos
  aparecem como "Visitante · fora do sistema" (o e-mail não foi confirmado: confira antes de mexer na conta de alguém).
- O endereço do seu site precisa estar em `WIDGET_ALLOWED_ORIGINS` (com `https://`, sem barra no final).

**Assinatura do cliente (`userHash`):** sem ela, alguém esperto poderia abrir o chat se passando pelo e-mail de outro
cliente. O `userHash` é calculado **no servidor do seu site** (nunca no navegador) com o mesmo `WIDGET_VERIFY_SECRET`:

```js
// Node.js
import crypto from "node:crypto";
const userHash = crypto
  .createHmac("sha256", process.env.WIDGET_VERIFY_SECRET)
  .update(email.trim().toLowerCase())
  .digest("hex");
```

```php
// PHP
$userHash = hash_hmac('sha256', strtolower(trim($email)), getenv('WIDGET_VERIFY_SECRET'));
```

Quando o seu site já estiver mandando o `userHash`, ligue `WIDGET_REQUIRE_USER_HASH=true` e publique de novo.

### 8.2 E-mail (Resend, opcional)

1. Crie a conta no [Resend](https://resend.com), em **Domains** adicione o seu domínio e crie os registros DNS que ele
   mostrar (no lugar onde você comprou o domínio). Espere ficar "Verified".
2. Em **API Keys**, crie uma chave com permissão de envio → `RESEND_API_KEY`.
3. Defina `RESEND_FROM_EMAIL` (ex.: `suporte@seu-dominio.com.br`) e, se quiser, `RESEND_FROM_NAME`.
4. Cadastre na Vercel e publique de novo.

Com o e-mail ligado: "Esqueci minha senha" funciona e, ao finalizar um atendimento, o cliente recebe a conversa
completa. Sem e-mail, o sistema funciona normalmente; a senha de um atendente você troca na tela **Agentes**. Pra logo
nos e-mails, use uma imagem PNG em `NEXT_PUBLIC_BRAND_LOGO_URL` (muitos programas de e-mail não mostram SVG).

### 8.3 Anexos maiores (opcional)

No plano grátis do Supabase cada arquivo vai até 50 MB. No plano pago dá pra chegar a 400 MB: aumente o limite em
**Storage → Settings** (Upload file size limit) e coloque o mesmo valor em `NEXT_PUBLIC_MAX_UPLOAD_MB`. Os anexos
ficam num bucket público com nome difícil de adivinhar (quem tem o link consegue abrir).

### 8.4 Sua marca

- Nome, logo e cor: variáveis `NEXT_PUBLIC_BRAND_*` (passo 4). Pra usar sua logo como arquivo, coloque em `public/`
  (ex.: `public/minha-logo.png`) e use `/minha-logo.png`.
- Cor do widget e do botão flutuante: **Configurações do widget → Cor da marca** (vale na hora, sem publicar de novo).
- Saudação, abas, mensagem de encerramento, blocos da tela inicial, temas, horários, motivos: tudo no painel.

---

## 9. Checklist de teste

- [ ] Entrar em `SEU-ENDERECO/login` com o administrador.
- [ ] **Configurações do widget:** trocar a saudação e a cor e salvar.
- [ ] **Preview:** o botão aparece no canto; abrir, escolher um tema e mandar uma mensagem como cliente.
- [ ] **Inbox:** a conversa aparece em "Aguardando" sem atualizar a página (com aviso sonoro).
- [ ] Assumir, responder (texto e uma imagem). A resposta aparece no widget na hora.
- [ ] Finalizar com um motivo. O widget mostra a mensagem de encerramento.
- [ ] Mandar outra mensagem pelo widget: o atendimento volta pra "Aguardando".
- [ ] **Agentes:** cadastrar um atendente e entrar com ele numa janela anônima (ele não vê a área de administração).
- [ ] **Horário de atendimento:** cadastrar um horário que já passou hoje e conferir o aviso de fora do horário no
      widget (depois ajuste os horários de verdade).
- [ ] Colar o código no seu site e testar com um cliente de verdade (logado e, se houver, sem login).
- [ ] Se ligou o e-mail: "Esqueci minha senha" chega, e o resumo chega pro cliente ao finalizar.

---

## 10. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| `db push` reclama que tabela já existe | O projeto do Supabase não estava vazio. Use um projeto novo, só pra este sistema |
| Login diz "Invalid login credentials" | Confira e-mail e senha. Se criou pelo painel do Supabase, marque "Auto Confirm User" |
| Entro, mas o painel dá erro de permissão ou fica vazio | O seu usuário não está na tabela `agents`. Refaça o passo 7 |
| O widget não aparece no meu site | Confira o `src` do script, e se o endereço do seu site está em `WIDGET_ALLOWED_ORIGINS` exatamente igual (com `https://`, sem barra no final). Mudou a variável: publique de novo |
| O chat fica em "Conectando…" | O `identify()` foi chamado sem e-mail, ou o servidor recusou: `data-project` diferente de `NEXT_PUBLIC_WIDGET_PROJECT_KEY`, ou `WIDGET_REQUIRE_USER_HASH=true` sem `userHash` certo. Veja a aba Network do navegador (rota `/api/identify`) |
| O widget diz que está fora do horário | Em **Horário de atendimento**, confira os horários e o fuso. Sem nenhum horário cadastrado, fica sempre aberto |
| O painel não atualiza sozinho | Confira o passo 3.5 (publicação `supabase_realtime`). O widget tem uma conferência automática a cada 3 segundos, então ele continua recebendo mesmo com o tempo real falhando |
| Anexo grande não sobe | Passou do limite (50 MB no plano grátis). Veja o passo 8.3 |
| "Esqueci minha senha" não chega | O e-mail (Resend) não está configurado ou o domínio não foi verificado. Enquanto isso, o administrador troca a senha em **Agentes** |
| A cor ou o nome não mudaram | As variáveis `NEXT_PUBLIC_*` só valem depois de publicar de novo. A cor do widget também é salva no painel (**Configurações do widget**) |
| O projeto do Supabase "pausou" | No plano grátis ele pausa depois de 7 dias sem uso. Entre no painel do Supabase e clique em **Restore** |
