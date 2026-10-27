import "../../globals.css";

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground overflow-hidden">
      {children}
    </div>
  );
}
