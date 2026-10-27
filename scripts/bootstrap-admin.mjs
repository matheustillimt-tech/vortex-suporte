/**
 * Cria o PRIMEIRO administrador do painel:
 *   1) cria o usuário de login no Supabase Auth (com a chave service_role / secret)
 *   2) grava esse usuário na tabela public.agents com papel "admin"
 *
 * Uso (no terminal, dentro da pasta do projeto, com o .env.local preenchido):
 *   node scripts/bootstrap-admin.mjs voce@exemplo.com "Seu Nome"
 *
 * A senha é pedida no terminal (não aparece na tela e não fica no histórico).
 * Pode rodar de novo sem problema: se o e-mail já existe, só garante que é admin
 * (e NÃO troca a senha de quem já existe).
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import readline from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
if (!existsSync(envPath)) {
  console.error("Não achei o arquivo .env.local. Copie o .env.example pra .env.local e preencha antes.");
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.argv[2];
const NAME = process.argv[3] ?? "Admin";

if (!EMAIL) {
  console.error('Uso: node scripts/bootstrap-admin.mjs <email> ["Seu Nome"]');
  process.exit(1);
}
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local");
  process.exit(1);
}

/** Pergunta a senha sem mostrar o que é digitado. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    // Enquanto a pessoa digita, não escreve nada na tela.
    rl._writeToOutput = (s) => {
      if (!rl.stdoutMuted) rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    rl.stdoutMuted = true;
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  db: { schema: "public" },
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`> Procurando o usuário ${EMAIL}...`);
let user = null;
for (let page = 1; page <= 20 && !user; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) {
    console.error("Não consegui listar os usuários:", error.message);
    process.exit(1);
  }
  user = data.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase()) ?? null;
  if (data.users.length < 1000) break;
}

if (user) {
  console.log("  Já existe. Mantenho a senha atual e só garanto que é admin.");
} else {
  const password = await askHidden("  Escolha uma senha pro painel (mínimo 6 caracteres): ");
  if (!password || password.length < 6) {
    console.error("  Senha curta demais. Rode de novo.");
    process.exit(1);
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    console.error("  Não consegui criar o usuário:", error?.message);
    process.exit(1);
  }
  user = data.user;
  console.log("  Usuário criado.");
}

console.log("> Gravando como administrador...");
const { data: agent, error: agentErr } = await admin
  .from("agents")
  .upsert({ id: user.id, name: NAME, email: EMAIL, role: "admin" }, { onConflict: "id" })
  .select()
  .single();

if (agentErr) {
  console.error("  Não consegui gravar o administrador:", agentErr.message);
  console.error("  Confira se o banco foi aplicado (supabase db push).");
  process.exit(1);
}

const appUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
console.log("\nAdministrador pronto!");
console.log(`   Nome:  ${agent.name}`);
console.log(`   E-mail: ${agent.email}`);
console.log(`   Entrar: ${appUrl.replace(/\/$/, "")}/login\n`);
