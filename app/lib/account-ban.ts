export const ACCOUNT_BANNED_EVENT = "bcwin:account-banned";

/** Only the explicit ban response should end the local session. */
export function handleAccountBan(status: number, data: unknown): void {
  if (
    status === 403 &&
    data !== null &&
    typeof data === "object" &&
    "code" in data &&
    data.code === "ACCOUNT_BANNED" &&
    typeof window !== "undefined"
  ) {
    window.dispatchEvent(new Event(ACCOUNT_BANNED_EVENT));
  }
}
