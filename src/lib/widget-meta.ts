import {
  MessageCircle, Bug, Sparkles, BookOpen, Search, Lightbulb,
  HelpCircle, Headphones, Mail, Phone, Globe, FileText, Zap,
  CreditCard, ShoppingBag, Settings, Bell, Heart, Star,
  Calendar, MapPin, Wrench, Megaphone, type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  MessageCircle, Bug, Sparkles, BookOpen, Search, Lightbulb,
  HelpCircle, Headphones, Mail, Phone, Globe, FileText, Zap,
  CreditCard, ShoppingBag, Settings, Bell, Heart, Star,
  Calendar, MapPin, Wrench, Megaphone,
};

export const ICON_NAMES = Object.keys(ICONS);

export function getIcon(name: string): LucideIcon {
  return ICONS[name] ?? MessageCircle;
}

export const ACCENTS = {
  primary: { bg: "bg-primary/15", text: "text-primary" },
  blue:    { bg: "bg-blue-500/15", text: "text-blue-400" },
  red:     { bg: "bg-red-500/15", text: "text-red-400" },
  amber:   { bg: "bg-amber-500/15", text: "text-amber-400" },
  purple:  { bg: "bg-purple-500/15", text: "text-purple-400" },
  muted:   { bg: "bg-muted", text: "text-muted-foreground" },
} as const;

export type AccentKey = keyof typeof ACCENTS;

export const ACTION_LABELS: Record<string, string> = {
  open_chat:  "Abrir o chat",
  open_url:   "Abrir URL externa",
  switch_tab: "Ir pra outra aba",
  report_bug: "Reportar bug",
};

export const WEEKDAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const SUGGESTION_STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  planned: "Planejada",
  in_progress: "Em desenvolvimento",
  completed: "Concluída",
  declined: "Recusada",
};

/**
 * Moderação x status são eixos diferentes: a moderação decide se a ideia
 * aparece pro público, o status conta em que pé ela está. Os rótulos abaixo
 * evitam confundir a "Recusada" da moderação (nunca foi publicada) com a
 * "Recusada" do status (foi publicada e a equipe decidiu não fazer).
 */
export const SUGGESTION_MODERATION_LABEL: Record<string, string> = {
  pending: "Aguardando aprovação",
  approved: "Publicada",
  rejected: "Recusada na moderação",
};

export const SUGGESTION_MODERATION_VARIANT: Record<string, "default" | "muted" | "success" | "warning"> = {
  pending: "warning",
  approved: "success",
  rejected: "muted",
};

export const SUGGESTION_STATUS_VARIANT: Record<string, "default" | "muted" | "success" | "warning"> = {
  open: "muted",
  planned: "default",
  in_progress: "warning",
  completed: "success",
  declined: "muted",
};
