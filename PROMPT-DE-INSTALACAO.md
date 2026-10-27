# Prompt de instalação (Claude Code)

Abra o Claude Code (aba **Code**) numa **pasta vazia** do seu computador e cole o texto abaixo inteiro. O Claude vai
instalar o Vórtex Suporte com você, passo a passo, esperando você em cada conta que precisar criar.

```text
Você vai instalar o Vórtex Suporte pra mim, do zero, nesta pasta vazia. O Vórtex Suporte é um sistema de suporte ao
cliente: um widget de chat que vai no meu site (por uma tag <script>) e um painel onde a minha equipe responde em
tempo real (Next.js + Supabase). Código: https://github.com/matheustillimt-tech/vortex-suporte

Eu não sou programador. Fale comigo em português simples, explique cada termo técnico na primeira vez e faça uma
coisa de cada vez, esperando eu responder antes de seguir.

REGRAS (siga sempre):
1. Nunca me peça pra colar chave, senha ou token aqui no chat. Quando precisar de um segredo, abra o arquivo
   .env.local pra mim no editor e diga em qual linha colar, ou rode no meu terminal um comando que me pede o valor
   (por exemplo "npx vercel env add NOME production"). Se eu colar um segredo no chat por engano, me avise pra gerar
   outro no serviço e trocar.
2. Uma conta de cada vez: diga qual conta criar, o link, onde clicar, e espere eu dizer "pronto".
3. Antes de qualquer comando que publica, apaga ou pode gerar cobrança, explique o que vai acontecer e peça meu OK.
4. Use o arquivo INSTALACAO.md do repositório como roteiro e consulte ele quando tiver dúvida.
5. Nunca coloque o .env.local no git.

PASSOS:
1. Pré-requisitos: confira se tenho Node.js 20 ou mais novo, Git e o terminal funcionando. Instale o que faltar (no
   Mac, pelo Homebrew; no Windows, pelo instalador oficial), explicando o que é cada coisa. Os programas da Supabase e
   da Vercel a gente usa por "npx supabase" e "npx vercel" (não precisa instalar à parte).
2. Baixe o código nesta pasta: git clone https://github.com/matheustillimt-tech/vortex-suporte.git . e depois
   npm install.
3. Contas, uma por vez, me esperando em cada uma: GitHub, Supabase e Vercel. Me diga o que cada uma faz, se tem plano
   grátis e o que pode custar (ver a seção "Contas" do INSTALACAO.md). Pergunte se eu quero ligar agora o e-mail
   (Resend, precisa de um domínio meu) ou se deixo pra depois.
4. Copie .env.example para .env.local e abra pra mim. Pergunte o nome da minha empresa, a cor da marca e o endereço
   do meu site e escreva você mesmo NEXT_PUBLIC_BRAND_NAME, NEXT_PUBLIC_BRAND_COLOR e NEXT_PUBLIC_BRAND_SITE_URL (não
   são segredos). Gere você mesmo o WIDGET_VERIFY_SECRET com "openssl rand -hex 32" escrevendo direto no arquivo
   (sem mostrar o valor no chat). Me guie a preencher as chaves do Supabase, uma por vez, dizendo onde pegar cada uma.
5. Banco: me ajude a criar o projeto no Supabase (região São Paulo). Depois rode "npx supabase login",
   "npx supabase link --project-ref <ref>" (o ref aparece no endereço do projeto e não é segredo; a senha do banco eu
   digito no terminal) e "npx supabase db push". Confira se as 28 migrações subiram.
6. Segurança do login: me guie a desligar o cadastro aberto no Supabase (Authentication > Sign In / Providers >
   "Allow new users to sign up" desligado). Quem entra no painel é só quem o administrador cadastrar.
7. Teste local: rode "npm test" e "npm run build" e diga se passou.
8. Publicar na Vercel: rode "npx vercel link" (cria o projeto), cadastre cada variável do .env.local com
   "npx vercel env add NOME production" (eu colo o valor no terminal) e publique com "npx vercel --prod". Com o
   endereço final (o .vercel.app ou o meu domínio), atualize NEXT_PUBLIC_APP_URL no .env.local e na Vercel; pergunte
   em quais endereços fica o meu site e preencha WIDGET_ALLOWED_ORIGINS; publique de novo.
9. Primeiro administrador: rode no meu terminal "node scripts/bootstrap-admin.mjs <meu e-mail> "<meu nome>"" (ele
   pede a senha no terminal e eu digito lá).
10. Se eu quis o e-mail: me guie a criar a conta no Resend, verificar o meu domínio e criar a chave; cadastre
    RESEND_API_KEY e RESEND_FROM_EMAIL no .env.local e na Vercel e publique de novo.
11. Me ajude a colocar o widget no meu site: abra no painel a tela Instalação, me explique o código e, se o meu site
    tiver login, como mandar o e-mail e o nome do cliente (e o userHash, ver INSTALACAO.md). Se for um site sem login,
    explique que o widget vai pedir nome e e-mail.
12. Rode comigo o checklist de teste do INSTALACAO.md: entrar no painel, configurar o widget, abrir a
    pré-visualização, mandar uma mensagem como cliente, responder como atendente e finalizar.
13. No fim, me mostre um resumo: endereço do painel, o que ficou ligado, o que ficou pra depois (e-mail, horários,
    assinatura de segurança) e onde está cada guia.
```
