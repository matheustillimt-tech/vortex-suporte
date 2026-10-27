-- =====================================================================
-- Mensagem padrão de finalização do atendimento.
-- Editável em /admin/widget → "Mensagem de encerramento".
-- Quando o agente clica Finalizar, esta msg é enviada como bot pro cliente.
-- =====================================================================
alter table public.widget_settings
  add column if not exists closing_message text;

update public.widget_settings
   set closing_message = 'Foi um prazer ajudar você! 🙂 Se precisar de mais alguma coisa, é só nos chamar novamente.'
 where project_key = 'principal' and closing_message is null;
