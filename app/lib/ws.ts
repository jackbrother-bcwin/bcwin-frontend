/**
 * Lightweight WebSocket client for BCWin backend.
 *
 * Real path is `/api/v1/ws` (publicApp mounted at /api/v1 in registerRoutes).
 * Next rewrites only proxy HTTP `/api/v1/*` — not WebSocket upgrades.
 * Production must set NEXT_PUBLIC_WS_URL at build time, e.g.:
 *   wss://api.bcwin.club/api/v1/ws
 *
 * Topics: wingo/k3/5d/moto/trx-wingo period-creation & results, account-balance, bet-settlement.
 */

import { isOfficialWebHost, OFFICIAL_WS_URL } from "./official-hosts";

/** Path on the Bun API (not bare `/ws`) */
export const WS_PATH = "/api/v1/ws";

export type WsTopic =
  | "account-balance"
  | "bet-settlement"
  | "wingo-period-creation"
  | "wingo-results"
  | "5d-period-creation"
  | "5d-results"
  | "k3-period-creation"
  | "k3-results"
  | "moto-period-creation"
  | "moto-results"
  | "trx-wingo-period-creation"
  | "trx-wingo-results";

type Handler = (data: unknown, topic: string) => void;

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function resolveWsUrl(clientId: string): string {
  const env = process.env.NEXT_PUBLIC_WS_URL;
  if (env) {
    const base = env.replace(/\/$/, "");
    return `${base}${base.includes("?") ? "&" : "?"}id=${clientId}`;
  }
  if (typeof window === "undefined") {
    return `ws://localhost:3000${WS_PATH}?id=${clientId}`;
  }
  // Official sites: Next cannot upgrade WS. Hit the API host unless Traefik
  // routes /api/v1/ws on the same host (still fine to use api.bcwin.club).
  if (isOfficialWebHost(window.location.hostname)) {
    return `${OFFICIAL_WS_URL}?id=${clientId}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.host;
  let wsHost = host;
  // Frontend dev on :3002 → API on :3000
  if (host.includes("localhost:3002") || host.includes("127.0.0.1:3002")) {
    wsHost = host.replace("3002", "3000");
  }
  // Same-host only works if reverse proxy upgrades WS to Bun (Next does not).
  return `${proto}//${wsHost}${WS_PATH}?id=${clientId}`;
}

class GameWebSocket {
  private ws: WebSocket | null = null;
  private clientId = uuid();
  private handlers = new Map<string, Set<Handler>>();
  private subscribed = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;
  private reconnectAttempt = 0;

  isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.intentionalClose = false;
    const url = resolveWsUrl(this.clientId);
    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      // re-subscribe
      for (const topic of this.subscribed) {
        this.send({ action: "subscribe", topic });
      }
      this.startPing();
    };

    this.ws.onmessage = (ev) => {
      const raw = ev.data?.toString?.() ?? "";
      if (raw === "pong") return;
      try {
        const msg = JSON.parse(raw) as { topic?: string; data?: unknown };
        if (msg.topic) {
          const set = this.handlers.get(msg.topic);
          set?.forEach((h) => h(msg.data, msg.topic!));
          // also fire wildcard
          this.handlers.get("*")?.forEach((h) => h(msg.data, msg.topic!));
        }
      } catch {
        // ignore non-json
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      this.ws = null;
      if (!this.intentionalClose) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire
    };
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.stopPing();
    this.ws?.close();
    this.ws = null;
  }

  subscribe(topic: WsTopic | string, handler: Handler) {
    if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
    this.handlers.get(topic)!.add(handler);
    this.subscribed.add(topic);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ action: "subscribe", topic });
    } else {
      this.connect();
    }
    return () => this.unsubscribe(topic, handler);
  }

  unsubscribe(topic: string, handler: Handler) {
    this.handlers.get(topic)?.delete(handler);
    if ((this.handlers.get(topic)?.size ?? 0) === 0) {
      this.handlers.delete(topic);
      this.subscribed.delete(topic);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ action: "unsubscribe", topic });
      }
    }
  }

  private send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send("ping");
    }, 25000);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}

/** Singleton for the app */
export const gameWs = new GameWebSocket();
