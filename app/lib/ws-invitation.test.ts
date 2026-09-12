import { afterEach, expect, mock, test } from "bun:test";
import { gameWs } from "./ws";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const originalWebSocket = Object.getOwnPropertyDescriptor(globalThis, "WebSocket");
let unsubscribe: (() => void) | undefined;

class TestSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static latest: TestSocket;
  readyState = 0;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: () => void;
  send = mock((message: string) => message);
  constructor() { TestSocket.latest = this; }
  close() { this.readyState = 3; this.onclose?.(); }
}

afterEach(() => {
  unsubscribe?.();
  gameWs.disconnect();
  for (const [name, descriptor] of [["window", originalWindow], ["WebSocket", originalWebSocket]] as const) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

test("private invitation updates reach the page subscription and stop after unsubscribe", () => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { hostname: "localhost", host: "localhost:3002", protocol: "http:" } } });
  Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: TestSocket });
  const handler = mock();
  unsubscribe = gameWs.subscribe("invitation-bonus-update", handler);
  gameWs.connect();
  const socket = TestSocket.latest;
  socket.readyState = TestSocket.OPEN;
  socket.onopen?.();
  expect(socket.send.mock.calls.some(([message]) => JSON.parse(message).topic === "invitation-bonus-update")).toBe(true);
  socket.onmessage?.({ data: JSON.stringify({ topic: "invitation-bonus-update:user-id", data: { createdCount: 1 } }) });
  expect(handler).toHaveBeenCalledWith({ createdCount: 1 }, "invitation-bonus-update:user-id");
  unsubscribe();
  socket.onmessage?.({ data: JSON.stringify({ topic: "invitation-bonus-update:user-id", data: { createdCount: 1 } }) });
  expect(handler).toHaveBeenCalledTimes(1);
});
