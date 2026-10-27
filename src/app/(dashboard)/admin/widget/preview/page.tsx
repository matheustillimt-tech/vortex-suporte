import { WidgetPreviewClient } from "@/components/dashboard/WidgetPreviewClient";

// Sem queries — só renderiza o iframe. Auth via admin layout.
export default function WidgetPreviewPage() {
  return <WidgetPreviewClient />;
}
