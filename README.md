# Vórtex Suporte

Suporte ao cliente próprio: um botão de chat que você coloca em qualquer site ou app com uma linha de código, e um
painel onde a sua equipe responde em tempo real.

## O que ele faz

- **Widget flutuante:** um botão "Suporte" no canto da tela do seu site ou app. Ao clicar, abre uma janelinha com as
  abas **Início**, **Chat**, **Novidades** e **Sugestões** (você liga e desliga cada uma).
- **Instala com uma linha de código:** cole a tag `<script>` no seu site. O painel já mostra o código pronto, com o seu
  endereço e a sua cor.
- **Sabe quem é o cliente:** o seu site informa nome, e-mail e dados extras (plano, empresa...) e o atendente vê tudo
  no painel. Com a assinatura de segurança (opcional), ninguém consegue se passar por outro cliente.
- **Funciona também sem login:** se o seu site não informa quem é o cliente, o widget pede nome e e-mail antes do
  chat. O painel marca essas pessoas como "visitante" (e-mail não confirmado).
- **Escolha de assunto:** o cliente escolhe o tema (Suporte técnico, Financeiro, Comercial...) e cai no departamento
  certo, com uma mensagem automática de boas-vindas.
- **Fila justa:** a ordem é pela primeira mensagem e ninguém fura a fila. O cliente vê a posição dele em tempo real.
- **Horário de atendimento:** por departamento. Fora do horário, o widget avisa quando o suporte volta e guarda a
  mensagem. Sem nenhum horário cadastrado, o suporte fica sempre aberto.
- **Mensagens completas:** texto, foto, arquivo, áudio gravado no painel e vídeo. Dá pra responder uma mensagem
  específica, editar e apagar.
- **Painel do atendente em tempo real:** abas Aguardando, Em atendimento e Concluídos; assumir, transferir pra outra
  pessoa, finalizar com motivo e reabrir; aviso sonoro e contador na aba do navegador; funciona no celular.
- **Ficha do cliente:** dados que o seu site mandou, etiquetas coloridas, notas internas (o cliente não vê) e a linha
  do tempo do atendimento.
- **Respostas rápidas:** textos prontos (com anexo, se quiser) que qualquer atendente usa com um atalho.
- **Encerramento caprichado:** mensagem de despedida automática (liga e desliga) e, se você ligar o e-mail, o cliente
  recebe a conversa inteira na caixa de entrada.
- **Reportar bug:** formulário separado do chat, que já leva navegador, tela e idioma do cliente. A equipe acompanha
  numa lista própria, com status.
- **Novidades e sugestões:** publique as novidades do seu produto dentro do widget; os clientes mandam ideias e votam
  (cada ideia passa pela sua aprovação antes de aparecer).
- **Dashboard:** total de atendimentos, tempo médio na fila e de atendimento, motivos de encerramento e o movimento
  por dia.
- **Equipe com papéis:** administrador (configura tudo) e atendente (atende). O administrador cadastra e remove as
  pessoas pelo próprio painel.
- **Sua marca:** nome, logo e cor configuráveis.

## Como funciona

1. Você publica o sistema (o painel e o widget ficam no mesmo endereço, por exemplo `suporte.seu-dominio.com.br`).
2. Cola o código do widget no seu site. Quando o cliente faz login no seu site, o código informa quem ele é (sem
   login, o próprio widget pergunta nome e e-mail).
3. O cliente abre o chat, escolhe o assunto e manda a mensagem. Ela aparece na hora no painel, na fila "Aguardando".
4. Um atendente assume, conversa e finaliza com um motivo. O cliente recebe a despedida (e o resumo por e-mail, se
   ligado). Se ele escrever de novo, o atendimento volta pra fila.

Tudo fica guardado no seu banco de dados. As mensagens chegam dos dois lados sem precisar atualizar a página (o
"tempo real" do Supabase).

## Com o que é feito

- **Next.js 16** (React 19, TypeScript, Tailwind): o painel, o widget e a API, publicados na **Vercel**.
- **Supabase**: banco de dados (Postgres), login da equipe, tempo real (Realtime) e arquivos dos anexos (Storage).
- **Vite**: gera o `widget.js`, o arquivo pequeno que vai no seu site.
- **Resend** (opcional): e-mails de "esqueci minha senha" e o resumo do atendimento.
- **node:test**: testes automáticos que rodam sem internet (`npm test`).

## De quais contas você precisa

| Conta | Pra quê | Custo |
|---|---|---|
| GitHub | Guardar a sua cópia do código | Grátis |
| Supabase | Banco, login da equipe, tempo real e anexos | Tem plano grátis (anexos de até 50 MB por arquivo; o projeto grátis pausa depois de 7 dias sem uso) |
| Vercel | Colocar o sistema no ar | Tem plano grátis (Hobby, pra uso não comercial). Pra empresa, a Vercel pede o Pro |
| Resend (opcional) | E-mail de "esqueci minha senha" e resumo do atendimento | Tem plano grátis, com limite de envios. Precisa de um domínio seu |

Você também precisa de um site ou app onde colar o código do widget.

## Instalar com o Claude Code

Abra o Claude Code (aba **Code**) numa pasta vazia e cole o prompt abaixo. Ele confere os programas, baixa o código,
guia a criação de cada conta (uma de cada vez, esperando você), aplica o banco, publica, cria o seu administrador e
roda o checklist. Ele nunca pede pra você colar chave ou senha no chat.

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

Prefere fazer na mão? Siga o **[INSTALACAO.md](INSTALACAO.md)**.

## Estrutura de pastas

```
src/
  app/
    (auth)/            login, esqueci minha senha, nova senha
    (dashboard)/       painel: inbox, respostas rápidas e a área de administração (admin/)
    (widget)/widget/   a tela que abre dentro do widget (fica num iframe no seu site)
    preview-frame/     página de pré-visualização do widget
    api/               identificação, conversas, mensagens, anexos, widget, admin
  components/
    dashboard/         telas do painel (inbox/ = caixa de atendimento)
    widget/            telas do widget
    shared/, ui/       peças reaproveitadas (logo, balão de mensagem, botões...)
  lib/                 marca (brand.ts), Supabase, tempo real, segurança, e-mail, anexos
widget-sdk/            código do widget.js (o script que vai no seu site)
supabase/migrations/   o banco, aplicado em ordem com "supabase db push"
scripts/               bootstrap-admin.mjs (cria o primeiro administrador)
examples/demo.html     página de teste do widget no seu computador
tests/                 testes automáticos (npm test)
```

## Licença

MIT. Veja [LICENSE](LICENSE).

---

Feito pelo Grupo Vórtex · entregue na Plataforma Vórtex IA
