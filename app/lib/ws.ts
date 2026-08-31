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
type ConnectionHandler = (open: boolean) => void;

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
  private connectionHandlers = new Set<ConnectionHandler>();
  private subscribed = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;
  private reconnectAttempt = 0;
  private lastPongAt = 0;

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
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
      this.ws = socket;
    } catch {
      this.scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      if (this.ws !== socket) return;
      this.reconnectAttempt = 0;
      this.lastPongAt = Date.now();
      // re-subscribe
      for (const topic of this.subscribed) {
        this.send({ action: "subscribe", topic });
      }
      this.startPing();
      this.notifyConnection(true);
    };

    socket.onmessage = (ev) => {
      if (this.ws !== socket) return;
      const raw = ev.data?.toString?.() ?? "";
      if (raw === "pong") {
        this.lastPongAt = Date.now();
        return;
      }
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

    socket.onclose = () => {
      if (this.ws !== socket) return;
      this.stopPing();
      this.ws = null;
      this.notifyConnection(false);
      if (!this.intentionalClose) this.scheduleReconnect();
    };

    socket.onerror = () => {
      // Force half-open/error sockets through close → reconnect.
      try {
        socket.close();
      } catch {
        // onclose/watchdog will recover
      }
    };
  }

  disconnect() {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopPing();
    const socket = this.ws;
    this.ws = null;
    socket?.close();
    this.notifyConnection(false);
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

  /** Observe socket recovery so screens can immediately reconcile missed events. */
  onConnectionChange(handler: ConnectionHandler) {
    this.connectionHandlers.add(handler);
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  private send(payload: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      const socket = this.ws;
      if (socket?.readyState !== WebSocket.OPEN) return;
      // Browsers can retain OPEN for a dead mobile/Wi-Fi connection.
      if (Date.now() - this.lastPongAt > 45_000) {
        socket.close(4000, "Heartbeat timeout");
        return;
      }
      try {
        socket.send("ping");
      } catch {
        socket.close();
      }
    }, 25000);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private notifyConnection(open: boolean) {
    for (const handler of this.connectionHandlers) {
      try {
        handler(open);
      } catch {
        // A screen callback must never break reconnect handling.
      }
    }
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
