import * as api from "./api";

let visitId: string | undefined;
let queue: Promise<unknown> = Promise.resolve();
const PENDING_EXIT = "bcwin:trx-pending-exit";

function serial<T>(operation: () => Promise<T>): Promise<T> {
  const next = queue.then(operation, operation);
  queue = next.catch(() => undefined);
  return next;
}

async function flushExit() {
  const pending = sessionStorage.getItem(PENDING_EXIT);
  if (!pending) return;
  await api.exitTrxEntry(pending);
  sessionStorage.removeItem(PENDING_EXIT);
}

export function readTrxEntry() {
  return serial(async () => {
    await flushExit();
    const { data } = await api.getTrxEntry();
    visitId = data.visitId;
    return data;
  });
}

export function acceptTrxQuote(quote: string) {
  return serial(async () => {
    await flushExit();
    const { data } = await api.acceptTrxEntry(quote);
    visitId = data.visitId;
    return data;
  });
}

/** Navigation calls this; unmount/refresh must not end an account-wide visit. */
export function leaveTrxVisit() {
  return serial(async () => {
    await flushExit();
    if (!visitId) return;
    sessionStorage.setItem(PENDING_EXIT, visitId);
    visitId = undefined;
    await flushExit();
  });
}
