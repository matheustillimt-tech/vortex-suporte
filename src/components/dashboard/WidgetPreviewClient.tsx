"use client";

import { useMemo, useRef, useState } from "react";
import {
  Monitor, RefreshCw, RotateCcw, Smartphone, Sun, Moon, Tablet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Device = "mobile" | "tablet" | "desktop" | "full";

const DEVICES: { id: Device; label: string; width: number; height: number; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "mobile",  label: "iPhone",   width: 390,  height: 844,  icon: Smartphone },
  { id: "tablet",  label: "iPad",     width: 820,  height: 1180, icon: Tablet },
  { id: "desktop", label: "Desktop",  width: 1280, height: 800,  icon: Monitor },
  { id: "full",    label: "Tela toda", width: 0,   height: 0,    icon: Monitor },
];

export function WidgetPreviewClient() {
  const [device, setDevice] = useState<Device>("desktop");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoOpen, setAutoOpen] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const current = useMemo(
    () => DEVICES.find((d) => d.id === device) ?? DEVICES[2],
    [device],
  );

  const isFull = device === "full";
  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      theme,
      autoOpen: autoOpen ? "true" : "false",
      _: String(refreshKey),
    });
    return `/preview-frame?${params.toString()}`;
  }, [theme, autoOpen, refreshKey]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-card px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">Preview do widget</h1>
          <p className="text-xs text-muted-foreground">
            Veja como o widget aparece num site real. Suas alterações em configurações, blocos e
            temas são refletidas aqui ao recarregar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Device toggle */}
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            {DEVICES.map(({ id, label, icon: Icon }) => {
              const active = device === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDevice(id)}
                  title={label}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Theme do site fake */}
          <div className="inline-flex rounded-md border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => setTheme("light")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
                theme === "light" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              title="Site claro"
            >
              <Sun className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Claro</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme("dark")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors",
                theme === "dark" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              title="Site escuro"
            >
              <Moon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Escuro</span>
            </button>
          </div>

          {/* Toggle auto-open */}
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1 text-xs">
            <input
              type="checkbox"
              checked={autoOpen}
              onChange={(e) => setAutoOpen(e.target.checked)}
              className="h-3 w-3 accent-primary"
            />
            Auto-abrir
          </label>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            title="Recarregar preview"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Recarregar
          </Button>
        </div>
      </header>

      {/* Stage */}
      <div className="flex flex-1 items-center justify-center overflow-auto scroll-thin bg-muted/30 p-4">
        {isFull ? (
          <iframe
            ref={iframeRef}
            key={refreshKey}
            src={iframeSrc}
            className="h-full w-full rounded-lg border border-border/40 bg-background shadow-lg"
            title="Preview"
          />
        ) : (
          <DeviceFrame device={device} width={current.width} height={current.height}>
            <iframe
              ref={iframeRef}
              key={refreshKey}
              src={iframeSrc}
              className="h-full w-full bg-background"
              title="Preview"
            />
          </DeviceFrame>
        )}
      </div>

      {/* Footer info */}
      <footer className="border-t border-border/40 bg-card/40 px-4 py-2 text-[11px] text-muted-foreground">
        {isFull ? (
          <span>Resolução: 100% × 100%</span>
        ) : (
          <span>
            Resolução: <span className="font-mono">{current.width} × {current.height}</span> px
            {" • "}
            Device: <span className="font-mono">{current.label}</span>
            {" • "}
            <span>
              Posição do widget: <span className="font-mono">canto inferior direito</span>
            </span>
          </span>
        )}
      </footer>
    </div>
  );
}

function DeviceFrame({
  device, width, height, children,
}: {
  device: Device;
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  // Calcula escala pra caber no container
  const isPhone = device === "mobile";
  const bezel = isPhone ? 14 : 18;
  const borderRadius = isPhone ? 36 : 22;

  return (
    <div
      className="relative shrink-0 border border-border/60 bg-zinc-900 shadow-2xl"
      style={{
        width: width + bezel * 2,
        height: height + bezel * 2,
        borderRadius,
        padding: bezel,
        maxHeight: "calc(100vh - 180px)",
      }}
    >
      {/* Notch decorativo no mobile */}
      {isPhone && (
        <div
          className="absolute left-1/2 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-zinc-950"
          style={{ top: bezel }}
        />
      )}
      <div
        className="h-full w-full overflow-hidden bg-background"
        style={{ borderRadius: borderRadius - 6 }}
      >
        {children}
      </div>
    </div>
  );
}
