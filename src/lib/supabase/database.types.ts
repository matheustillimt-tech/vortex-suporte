/**
 * Schema mínimo escrito à mão (em vez de gerar com `supabase gen types`)
 * pra manter o setup sem CLI obrigatória.
 * Reflita aqui qualquer mudança em supabase/migrations/*.sql.
 */
import type {
  Agent,
  AgentRole,
  Attachment,
  AuthorType,
  BlockAccent,
  BlockAction,
  BugReport,
  BugStatus,
  BusinessHours,
  CloseReason,
  Contact,
  ContactNote,
  Conversation,
  ConversationEvent,
  ConversationEventType,
  ConversationStatus,
  Department,
  HomeBlock,
  Message,
  QuickReply,
  Suggestion,
  SuggestionModeration,
  SuggestionStatus,
  SupportTopic,
  Update,
  WidgetSettings,
} from "./types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      departments: {
        Row: Department;
        Insert: { id?: string; name: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      agents: {
        Row: Agent;
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: AgentRole;
          department_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: AgentRole;
          department_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: Contact;
        Insert: {
          id?: string;
          external_id?: string | null;
          email: string;
          name?: string | null;
          metadata?: Record<string, unknown>;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          external_id?: string | null;
          email?: string;
          name?: string | null;
          metadata?: Record<string, unknown>;
          first_seen_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: Conversation;
        Insert: {
          id?: string;
          contact_id: string;
          status?: ConversationStatus;
          assigned_agent_id?: string | null;
          department_id?: string | null;
          topic_id?: string | null;
          first_message_at?: string;
          last_message_at?: string;
          closed_at?: string | null;
          flagged_at?: string | null;
          flagged_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          contact_id?: string;
          status?: ConversationStatus;
          assigned_agent_id?: string | null;
          department_id?: string | null;
          topic_id?: string | null;
          first_message_at?: string;
          last_message_at?: string;
          closed_at?: string | null;
          flagged_at?: string | null;
          flagged_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      bug_reports: {
        Row: BugReport;
        Insert: {
          id?: string;
          project_key?: string;
          contact_id?: string | null;
          reporter_email?: string | null;
          reporter_name?: string | null;
          description: string;
          context?: Record<string, unknown>;
          attachments?: Attachment[];
          status?: BugStatus;
          assigned_agent_id?: string | null;
          resolution_note?: string | null;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
        };
        Update: Partial<BugReport>;
        Relationships: [];
      };
      support_topics: {
        Row: SupportTopic;
        Insert: {
          id?: string;
          project_key?: string;
          name: string;
          description?: string | null;
          icon?: string;
          icon_url?: string | null;
          department_id?: string | null;
          auto_message?: string | null;
          sort_order?: number;
          enabled?: boolean;
          created_at?: string;
        };
        Update: Partial<SupportTopic>;
        Relationships: [];
      };
      close_reasons: {
        Row: CloseReason;
        Insert: {
          id?: string;
          project_key?: string;
          label: string;
          sort_order?: number;
          enabled?: boolean;
          created_at?: string;
        };
        Update: Partial<CloseReason>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: {
          id?: string;
          conversation_id: string;
          author_type: AuthorType;
          author_id?: string | null;
          author_name?: string | null;
          body?: string | null;
          attachments?: Attachment[];
          reply_to_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          author_type?: AuthorType;
          author_id?: string | null;
          author_name?: string | null;
          body?: string | null;
          attachments?: Attachment[];
          reply_to_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contact_notes: {
        Row: ContactNote;
        Insert: {
          id?: string;
          contact_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<ContactNote>;
        Relationships: [];
      };
      conversation_events: {
        Row: ConversationEvent;
        Insert: {
          id?: string;
          conversation_id: string;
          type: ConversationEventType;
          actor_id?: string | null;
          data?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<ConversationEvent>;
        Relationships: [];
      };
      quick_replies: {
        Row: QuickReply;
        Insert: {
          id?: string;
          author_id?: string | null;
          title: string;
          shortcut?: string | null;
          body?: string | null;
          attachments?: Attachment[];
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<QuickReply>;
        Relationships: [];
      };
      widget_settings: {
        Row: WidgetSettings;
        Insert: Partial<WidgetSettings> & { project_key?: string };
        Update: Partial<WidgetSettings>;
        Relationships: [];
      };
      home_blocks: {
        Row: HomeBlock;
        Insert: {
          id?: string;
          project_key?: string;
          title: string;
          description?: string | null;
          icon?: string;
          icon_url?: string | null;
          accent?: BlockAccent;
          action_type: BlockAction;
          action_value?: string | null;
          sort_order?: number;
          enabled?: boolean;
          created_at?: string;
        };
        Update: Partial<HomeBlock>;
        Relationships: [];
      };
      updates: {
        Row: Update;
        Insert: {
          id?: string;
          project_key?: string;
          title: string;
          excerpt?: string | null;
          body?: string | null;
          cover_image_url?: string | null;
          pinned?: boolean;
          published?: boolean;
          published_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Update>;
        Relationships: [];
      };
      suggestions: {
        Row: Suggestion;
        Insert: {
          id?: string;
          project_key?: string;
          contact_id?: string | null;
          title: string;
          description?: string | null;
          status?: SuggestionStatus;
          moderation_status?: SuggestionModeration;
          moderated_at?: string | null;
          moderated_by?: string | null;
          vote_count?: number;
          created_at?: string;
        };
        Update: Partial<Suggestion>;
        Relationships: [];
      };
      suggestion_votes: {
        Row: { suggestion_id: string; contact_id: string; created_at: string };
        Insert: { suggestion_id: string; contact_id: string; created_at?: string };
        Update: never;
        Relationships: [];
      };
      business_hours: {
        Row: BusinessHours;
        Insert: {
          id?: string;
          department_id: string;
          weekday: number;
          start_time: string;
          end_time: string;
          created_at?: string;
        };
        Update: Partial<BusinessHours>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_any_dept_open: {
        Args: { at_ts?: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type {
  Agent,
  AgentRole,
  Attachment,
  AuthorType,
  BlockAccent,
  BlockAction,
  BugReport,
  BugStatus,
  BusinessHours,
  Contact,
  ContactNote,
  Conversation,
  ConversationEvent,
  ConversationEventType,
  ConversationStatus,
  Department,
  HomeBlock,
  Message,
  QuickReply,
  Suggestion,
  SuggestionModeration,
  SuggestionStatus,
  SupportTopic,
  Update,
  WidgetSettings,
};
