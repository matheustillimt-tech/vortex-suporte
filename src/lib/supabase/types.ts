export type ConversationStatus = "waiting" | "in_progress" | "closed";
export type AuthorType = "contact" | "agent" | "system" | "bot";
export type AgentRole = "agent" | "admin";

export type Attachment = {
  url: string;
  mime: string;
  name: string;
  size: number;
};

export type Department = {
  id: string;
  name: string;
  created_at: string;
};

export type Agent = {
  id: string;
  name: string;
  email: string;
  role: AgentRole;
  department_id: string | null;
  created_at: string;
};

export type Contact = {
  id: string;
  external_id: string | null;
  email: string;
  name: string | null;
  metadata: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
};

export type Conversation = {
  id: string;
  contact_id: string;
  status: ConversationStatus;
  assigned_agent_id: string | null;
  department_id: string | null;
  first_message_at: string;
  last_message_at: string;
  closed_at: string | null;
  close_reason_id: string | null;
  close_reason_label: string | null;
  close_reason_note: string | null;
  last_author_type: string | null; // 'contact' | 'agent' — quem mandou a última msg
  /** Marcada como prioridade / "voltar nesse caso". Null = não marcada. */
  flagged_at: string | null;
  flagged_by: string | null;
  created_at: string;
};

export type CloseReason = {
  id: string;
  project_key: string;
  label: string;
  sort_order: number;
  enabled: boolean;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  author_type: AuthorType;
  author_id: string | null;
  /** Nome denormalizado do autor (atendente ou contato), preenchido por trigger. */
  author_name: string | null;
  body: string | null;
  attachments: Attachment[];
  /** Mensagem que está sendo respondida (como nos apps de mensagem). Null = mensagem solta. */
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  deleted_by_type: "agent" | "contact" | null;
  deleted_by_id: string | null;
  deleted_by_name: string | null;
};

export type ConversationWithContact = Conversation & {
  contact: Contact;
  assigned_agent?: Pick<Agent, "id" | "name" | "email"> | null;
  /** Última mensagem (embed limitado a 1) — pra prévia na lista, como nos apps de mensagem. */
  last_message?: Pick<Message, "body" | "attachments" | "author_type" | "deleted_at">[];
};

export type ContactNote = {
  id: string;
  contact_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type ConversationEventType =
  | "created" | "assigned" | "transferred" | "closed" | "reopened" | "note";

export type ConversationEvent = {
  id: string;
  conversation_id: string;
  type: ConversationEventType;
  actor_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

export type SupportTopic = {
  id: string;
  project_key: string;
  name: string;
  description: string | null;
  icon: string;
  icon_url: string | null;
  department_id: string | null;
  auto_message: string | null;
  sort_order: number;
  enabled: boolean;
  created_at: string;
};

export type BugStatus = "open" | "investigating" | "fixed" | "wont_fix" | "duplicate";

export type BugReport = {
  id: string;
  project_key: string;
  contact_id: string | null;
  reporter_email: string | null;
  reporter_name: string | null;
  description: string;
  context: Record<string, unknown>;
  attachments: Attachment[];
  status: BugStatus;
  assigned_agent_id: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type QuickReply = {
  id: string;
  author_id: string | null;
  title: string;
  shortcut: string | null;
  body: string | null;
  attachments: Attachment[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ---------- Widget CMS ------------------------------------------------

export type WidgetSettings = {
  project_key: string;
  greeting_title: string;
  greeting_subtitle: string;
  show_home: boolean;
  show_chat: boolean;
  show_updates: boolean;
  show_suggestions: boolean;
  offline_message: string | null;
  closing_message: string | null;
  /** Desligado, o bot não manda a despedida ao finalizar — o texto fica guardado. */
  closing_message_enabled: boolean;
  brand_color: string;
  timezone: string;
  updated_at: string;
};

export type BlockAction = "open_chat" | "open_url" | "switch_tab" | "report_bug";
export type BlockAccent = "primary" | "blue" | "red" | "amber" | "purple" | "muted";

export type HomeBlock = {
  id: string;
  project_key: string;
  title: string;
  description: string | null;
  icon: string;          // nome do Lucide (fallback)
  icon_url: string | null; // imagem custom — quando setada, tem prioridade
  accent: BlockAccent;
  action_type: BlockAction;
  action_value: string | null;
  sort_order: number;
  enabled: boolean;
  created_at: string;
};

export type Update = {
  id: string;
  project_key: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_image_url: string | null;
  pinned: boolean;
  published: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
};

/** Andamento da ideia — só faz sentido depois que ela foi aprovada. */
export type SuggestionStatus = "open" | "planned" | "in_progress" | "completed" | "declined";

/** Decide se a sugestão aparece publicamente. Independente do andamento. */
export type SuggestionModeration = "pending" | "approved" | "rejected";

export type Suggestion = {
  id: string;
  project_key: string;
  contact_id: string | null;
  title: string;
  description: string | null;
  status: SuggestionStatus;
  moderation_status: SuggestionModeration;
  moderated_at: string | null;
  moderated_by: string | null;
  vote_count: number;
  created_at: string;
};

export type BusinessHours = {
  id: string;
  department_id: string;
  weekday: number; // 0=domingo, 6=sábado
  start_time: string; // "HH:MM:SS"
  end_time: string;
  created_at: string;
};
