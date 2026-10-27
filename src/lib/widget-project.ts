/**
 * Identificador do widget (o `data-project` da tag <script>).
 * Não é segredo: só confere que o widget foi instalado com o código certo.
 * O padrão "principal" já vem cadastrado no banco (migrações). Se trocar, cadastre
 * as configurações do widget de novo no painel (Widget > Configurações).
 */
export const PROJECT_KEY = process.env.NEXT_PUBLIC_WIDGET_PROJECT_KEY?.trim() || "principal";

export function getExpectedProjectKey(): string {
  return PROJECT_KEY;
}

export function isProjectKeyValid(key: unknown): key is string {
  return typeof key === "string" && key === getExpectedProjectKey();
}
