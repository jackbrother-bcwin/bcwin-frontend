"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IoArrowBack as ArrowLeft, IoRefresh as RotateCw } from "react-icons/io5";
import Image from "next/image";
import type { TrxEntryState } from "../lib/api";
import { acceptTrxQuote, readTrxEntry } from "../lib/trx-entry";

const money = (value = 0) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(value);

export default function TrxEntryGate({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  const [entry, setEntry] = useState<TrxEntryState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const mounted = useRef(false);
  const accepting = useRef(false);

  useEffect(() => {
    mounted.current = true;
    let live = true;
    let fetching = false;
    const refresh = async () => {
      if (fetching || accepting.current) return;
      fetching = true;
      try {
        const data = await readTrxEntry();
        if (live) setEntry(data);
      } catch (e) {
        if (live) {
          setEntry(null);
          setError(e instanceof Error ? e.message : "Unable to load TRX entry.");
        }
      } finally { fetching = false; }
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    window.addEventListener("focus", refresh);
    return () => {
      live = false;
      mounted.current = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [retry]);

  async function accept() {
    if (!entry?.quote || accepting.current) return;
    accepting.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await acceptTrxQuote(entry.quote);
      if (mounted.current) setEntry(data);
    } catch (e) {
      if (mounted.current) {
        setEntry(null);
        setError(e instanceof Error ? e.message : "Unable to accept TRX entry.");
      }
      try {
        const data = await readTrxEntry();
        if (mounted.current) setEntry(data);
      } catch { /* Keep the original failure and explicit retry. */ }
    } finally {
      accepting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (entry && (!entry.available || entry.active)) return children;

  return (
    <section className="min-h-dvh bg-[#171819] text-white">
      <header className="flex h-14 items-center gap-3 border-b border-white/10 px-4">
        <button type="button" onClick={onBack} aria-label="Back" title="Back" className="flex h-10 w-10 shrink-0 items-center justify-center">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-lg font-semibold">TRX WinGo</h1>
      </header>
      <div className="mx-auto max-w-lg space-y-5 px-5 py-6">
        <Image src="/assets/png/games/trxwingo.png" alt="TRX WinGo" width={80} height={80} className="h-20 w-20 object-contain" />
        <h2 className="text-xl font-semibold">TRX entry wager</h2>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {!entry ? (
          <div className="flex items-center gap-3 text-sm text-white/70">
            {error ? "Entry unavailable" : "Loading wager amount..."}
            {error && <button type="button" aria-label="Retry" title="Retry" onClick={() => { setError(""); setRetry((n) => n + 1); }} className="flex h-10 w-10 items-center justify-center"><RotateCw size={18} /></button>}
          </div>
        ) : (
          <>
            <p className="text-sm leading-6 text-white/75">Entering TRX sets your remaining TRX wager to 5x your entire current wallet balance, or keeps your existing TRX wager if it is higher. This is additional to deposit, reward and penalty wagering.</p>
            <dl className="divide-y divide-white/10 border-y border-white/10 text-sm">
              {([
                ["Wallet balance", entry.balance],
                ["Current TRX need to bet", entry.remainingBefore],
                ["New TRX need to bet", entry.remainingAfter],
                ["Additional wager", entry.addedWager],
                ["Total need to bet after entry", entry.totalAfter],
              ] as const).map(([label, value]) => (
                <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4 py-3">
                  <dt className="text-white/65">{label}</dt><dd className="break-words text-right font-semibold tabular-nums">{money(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm leading-6 text-white/65">Eligible first-party bets clear wagers oldest first. Third-party bets do not count. Leaving TRX ends this visit on all devices; re-entry requires fresh consent and can raise your remaining wager again, even without a balance increase. A submitted withdrawal also ends the visit.</p>
            {entry.zeroWagerEnabled && <p className="text-sm leading-6 text-amber-200">Zero wager is currently enabled. Your displayed need to bet stays 0 for one withdrawal request; the underlying wager above is not erased.</p>}
            <button type="button" disabled={busy || !entry.quote} onClick={() => void accept()} className="min-h-12 w-full rounded-lg bg-[#24b67a] px-4 py-3 font-semibold text-black disabled:opacity-50">{busy ? "Accepting..." : "Accept wager & enter"}</button>
            <button type="button" onClick={onBack} className="min-h-11 w-full text-sm text-white/70">Cancel</button>
          </>
        )}
      </div>
    </section>
  );
}
