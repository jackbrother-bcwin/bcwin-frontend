import { afterAll, afterEach, expect, spyOn, test } from "bun:test";
import { ACCOUNT_BANNED_EVENT } from "../app/lib/account-ban";
import { getUser } from "../app/lib/api";
import { getOverview } from "../app/lib/admin-api";

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
const fetchMock = spyOn(globalThis, "fetch");
afterAll(() => fetchMock.mockRestore());

afterEach(() => {
  fetchMock.mockReset();
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

for (const [name, request] of [["user", getUser], ["admin", getOverview]] as const) {
  test(`${name} API notifies auth on ban but not ordinary permission errors`, async () => {
    const browser = new EventTarget();
    Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
    let bans = 0;
    browser.addEventListener(ACCOUNT_BANNED_EVENT, () => bans++);

    fetchMock.mockResolvedValueOnce(Response.json({
      success: false, error: "Your account is banned", code: "ACCOUNT_BANNED",
    }, { status: 403 }));
    await expect(request()).rejects.toThrow("Your account is banned");
    expect(bans).toBe(1);

    fetchMock.mockResolvedValueOnce(Response.json({
      success: false, error: "Permission denied",
    }, { status: 403 }));
    await expect(request()).rejects.toThrow("Permission denied");
    expect(bans).toBe(1);
  });
}
