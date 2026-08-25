"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sanitizeErrorMessage } from "../../lib/safe";

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    const safe = sanitizeErrorMessage(message, kind === "error" ? "Error" : "Notice");
    setItems((prev) => {
      // Cap stack to avoid runaway UI if something loops
      const next = [...prev, { id, message: safe, kind }];
      return next.slice(-5);
    });
    const t = setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
      timers.current.delete(id);
    }, 2800);
    timers.current.set(id, t);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="app-fixed-chrome fixed top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-[200] px-3 pointer-events-none flex flex-col gap-2"
        role="status"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto px-4 py-2.5 rounded-xl text-[14px] font-semibold text-center shadow-lg animate-[fadeIn_0.25s_ease]"
            style={{
              background:
                t.kind === "success"
                  ? "linear-gradient(180deg, #241E22 0%, #110D14 100%)"
                  : t.kind === "error"
                    ? "linear-gradient(180deg, #241E22 0%, #110D14 100%)"
                    : "linear-gradient(180deg, #382E35 0%, #241E22 100%)",
              border: `1px solid ${
                t.kind === "success"
                  ? "rgba(33,192,100,0.45)"
                  : t.kind === "error"
                    ? "rgba(229,56,59,0.45)"
                    : "rgba(254,211,88,0.35)"
              }`,
              color:
                t.kind === "success" ? "#40AD72" : t.kind === "error" ? "#FD565C" : "#FED358",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (message) => {
        if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
          console.log("[toast]", message);
        }
      },
    };
  }
  return ctx;
}
