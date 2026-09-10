"use client";

import { asset } from "../../lib/cdn";
import React, { useEffect, useState } from "react";
import PageHeader from "../ui/PageHeader";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../lib/api";
import type { GiftHistoryItem } from "../../lib/api";
import { requireBankForCollect } from "../../lib/require-bank";
import { formatINR } from "../../lib/format";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
}

function GiftBanner() {
  return (
    <div className="relative w-full h-44 overflow-hidden bg-gradient-to-b from-[#fcd34d] via-[#f59e0b] to-[#b45309] flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#fef08a]/60 via-[#f59e0b]/40 to-transparent" />

      <svg viewBox="0 0 400 180" className="w-full h-full object-cover relative z-10" fill="none">
        <circle cx="200" cy="90" r="75" fill="#fef08a" opacity="0.3" />
        <circle cx="330" cy="45" r="7" fill="#fef08a" opacity="0.8" />
        <circle cx="80" cy="40" r="5" fill="#fef08a" opacity="0.7" />
        <path d="M340 100l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff" opacity="0.9" />
        <path d="M60 110l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" opacity="0.8" />

        {/* Gift Box Base */}
        <path
          d="M140 90 L260 90 L245 155 L155 155 Z"
          fill="#ea580c"
          stroke="#9a3412"
          strokeWidth="2"
        />
        <path d="M145 92 L255 92 L250 110 L150 110 Z" fill="#c2410c" />
        <path d="M192 90 L208 90 L205 155 L195 155 Z" fill="#fcd34d" />
        <path d="M140 120 L260 120 L257 128 L143 128 Z" fill="#fbbf24" opacity="0.4" />

        {/* Gold Ribbon */}
        <path
          d="M175 90 C 130 65, 110 95, 150 92 Z"
          fill="#fcd34d"
          stroke="#d97706"
          strokeWidth="1.5"
        />
        <path
          d="M225 90 C 270 65, 290 95, 250 92 Z"
          fill="#fcd34d"
          stroke="#d97706"
          strokeWidth="1.5"
        />

        {/* Voucher Scroll */}
        <path
          d="M165 50 C165 40 175 35 190 35 H220 C230 35 235 42 235 50 V100 H165 Z"
          fill="#fff"
          stroke="#e2e8f0"
          strokeWidth="2"
        />
        <path d="M175 48 H215 M175 58 H210 M175 68 H205 M175 78 H215" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="215" cy="55" r="8" fill="#ef4444" />
        <text x="215" y="58" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">9</text>

        {/* Lottery Balls */}
        <circle cx="110" cy="55" r="13" fill="url(#ballGreen)" />
        <circle cx="110" cy="55" r="6" fill="#fff" opacity="0.9" />
        <text x="110" y="58" textAnchor="middle" fill="#15803d" fontSize="9" fontWeight="bold">4</text>

        <circle cx="260" cy="45" r="15" fill="url(#ballRed)" />
        <circle cx="260" cy="45" r="7" fill="#fff" opacity="0.9" />
        <text x="260" y="48" textAnchor="middle" fill="#b91c1c" fontSize="10" fontWeight="bold">9</text>

        <circle cx="310" cy="75" r="14" fill="url(#ballBlue)" />
        <circle cx="310" cy="75" r="6.5" fill="#fff" opacity="0.9" />
        <text x="310" y="78" textAnchor="middle" fill="#1d4ed8" fontSize="9" fontWeight="bold">8</text>

        <circle cx="230" cy="70" r="12" fill="url(#ballPurple)" />
        <circle cx="230" cy="70" r="5.5" fill="#fff" opacity="0.9" />
        <text x="230" y="73" textAnchor="middle" fill="#6b21a8" fontSize="8" fontWeight="bold">3</text>

        <defs>
          <radialGradient id="ballGreen" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="60%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </radialGradient>
          <radialGradient id="ballRed" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fca5a5" />
            <stop offset="60%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#b91c1c" />
          </radialGradient>
          <radialGradient id="ballBlue" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="60%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </radialGradient>
          <radialGradient id="ballPurple" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#d8b4fe" />
            <stop offset="60%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6b21a8" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatHistoryTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function HistoryBookIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M15 12.0769C15 13.1282 15.8139 14 16.8498 14C17.8857 14 18.6996 13.1282 18.6996 12.0513V7H29.3005V12.0769C29.3005 13.1282 30.1144 14 31.1502 14C32.1861 14 33 13.1282 33 12.0513V7H33.24C34.5191 7 35.7856 7.25193 36.9673 7.74141C38.149 8.23089 39.2228 8.94834 40.1272 9.85278C41.0317 10.7572 41.7491 11.831 42.2386 13.0127C42.7281 14.1944 42.98 15.4609 42.98 16.74V34.26C42.98 35.5391 42.7281 36.8056 42.2386 37.9873C41.7491 39.169 41.0317 40.2428 40.1272 41.1472C39.2228 42.0517 38.149 42.7691 36.9673 43.2586C35.7856 43.7481 34.5191 44 33.24 44H14.74C9.36 44 5 39.64 5 34.24V16.74C5 14.1568 6.02618 11.6794 7.85278 9.85278C9.67938 8.02618 12.1568 7 14.74 7H15V12.0769Z"
        fill="#FED358"
      />
      <path
        d="M16.8438 13.6396C16.0038 13.6396 15.3438 12.9596 15.3438 12.1396V6.55957C15.3438 6.16175 15.5018 5.78021 15.7831 5.49891C16.0644 5.21761 16.4459 5.05957 16.8438 5.05957C17.2416 5.05957 17.6231 5.21761 17.9044 5.49891C18.1857 5.78021 18.3438 6.16175 18.3438 6.55957V12.1196C18.3438 12.9596 17.6837 13.6396 16.8438 13.6396Z"
        fill="#FED358"
      />
      <path
        d="M31.1406 13.5956C30.3006 13.5956 29.6406 12.9156 29.6406 12.0956V6.51562C29.6406 6.1178 29.7987 5.73627 30.08 5.45496C30.3613 5.17366 30.7428 5.01563 31.1406 5.01562C31.5384 5.01562 31.92 5.17366 32.2013 5.45496C32.4826 5.73627 32.6406 6.1178 32.6406 6.51562V12.0756C32.6406 12.9156 31.9806 13.5956 31.1406 13.5956Z"
        fill="#FED358"
      />
      <path
        d="M29.5588 27.4199H14.7188C14.3209 27.4199 13.9394 27.2619 13.6581 26.9806C13.3768 26.6993 13.2188 26.3177 13.2188 25.9199C13.2188 25.5221 13.3768 25.1406 13.6581 24.8593C13.9394 24.578 14.3209 24.4199 14.7188 24.4199H29.5588C29.9566 24.4199 30.3381 24.578 30.6194 24.8593C30.9007 25.1406 31.0588 25.5221 31.0588 25.9199C31.0588 26.3177 30.9007 26.6993 30.6194 26.9806C30.3381 27.2619 29.9566 27.4199 29.5588 27.4199ZM23.9987 34.8439H14.7188C14.3209 34.8439 13.9394 34.6859 13.6581 34.4046C13.3768 34.1233 13.2188 33.7417 13.2188 33.3439C13.2188 32.9461 13.3768 32.5646 13.6581 32.2833C13.9394 32.002 14.3209 31.8439 14.7188 31.8439H23.9987C24.3966 31.8439 24.7781 32.002 25.0594 32.2833C25.3407 32.5646 25.4987 32.9461 25.4987 33.3439C25.4987 33.7417 25.3407 34.1233 25.0594 34.4046C24.7781 34.6859 24.3966 34.8439 23.9987 34.8439Z"
        fill="#241E22"
      />
    </svg>
  );
}

function WalletIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 31 31"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        opacity="0.6"
        d="M18.0625 5.07519L18.0625 17.5977H7.325C4.7375 17.5977 2.625 19.7102 2.625 22.2977V9.93769C2.625 8.45019 3.5375 7.12519 4.925 6.60019L14.85 2.85019C16.4 2.27519 18.0625 3.41269 18.0625 5.07519ZM27.6987 17.5977V20.1727C27.6987 20.8602 27.1487 21.4227 26.4487 21.4477H23.9987C22.6487 21.4477 21.4112 20.4602 21.2987 19.1117C21.2237 18.3227 21.5237 17.5852 22.0487 17.0727C22.5112 16.5977 23.1487 16.3227 23.8487 16.3227H26.4487C27.1487 16.3477 27.6987 16.9102 27.6987 17.5977Z"
        fill="#FED358"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M21.3 19.1117C21.225 18.3242 21.525 17.5867 22.05 17.0742C22.5125 16.5992 23.15 16.3242 23.85 16.3242H26.375V14.5242C26.375 11.9367 24.2625 9.82422 21.675 9.82422H7.325C4.7375 9.82422 2.625 11.9367 2.625 14.5242V22.9367C2.625 25.5242 4.7375 27.6367 7.325 27.6367H21.675C24.2625 27.6367 26.375 25.5242 26.375 22.9367V21.4492H24C22.65 21.4492 21.4125 20.4617 21.3 19.1117ZM16.3145 17.0122H7.56445C7.05195 17.0122 6.62695 16.5872 6.62695 16.0747C6.62695 15.5622 7.05195 15.1372 7.56445 15.1372H16.3145C16.827 15.1372 17.252 15.5622 17.252 16.0747C17.252 16.5872 16.827 17.0122 16.3145 17.0122Z"
        fill="#FED358"
      />
    </svg>
  );
}

export default function GiftsPage({ onBack, onNavigate }: Props) {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<GiftHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showWin, setShowWin] = useState(false);
  useSpaBackClose(showWin, () => setShowWin(false), "gift-win", {
    history: false,
  });
  const [winAmount, setWinAmount] = useState<number | null>(null);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getGiftHistory();
      if (res.success && Array.isArray(res.data)) {
        setHistory(res.data);
      }
    } catch {
      // ignore
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    void api
      .getGiftHistory()
      .then((res) => {
        if (!active) return;
        if (res.success && Array.isArray(res.data)) {
          setHistory(res.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleRedeem = async () => {
    if (!code.trim()) {
      toast("Enter a gift code", "error");
      return;
    }
    setLoading(true);
    try {
      const bank = await requireBankForCollect();
      if (!bank.ok) {
        toast(
          bank.message ??
            "Please add your bank details before collecting rewards",
          "error"
        );
        onNavigate?.("bank");
        return;
      }
      const res = await api.redeemGift(code.trim());
      await refreshUser();
      await fetchHistory();
      setCode("");
      if (typeof res.amount === "number" && res.amount > 0) {
        setWinAmount(res.amount);
        setShowWin(true);
      } else {
        toast("Gift redeemed successfully!", "success");
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Redeem failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#110D14] text-[#FDE4BC]">
      <PageHeader title="Gift" onBack={onBack} />

      {/* Hero Banner */}
      <GiftBanner />

      <div className="px-3 pt-3 pb-8 flex flex-col gap-3">
        {/* Gift Code Form Card */}
        <div className="bg-[#241E22] border border-[#3D363A]/60 rounded-xl p-4 shadow-md flex flex-col">
          <p className="text-sm font-semibold text-[#FDE4BC] mb-1">Hi</p>
          <p className="text-xs text-[#837064] mb-4">We have a gift for you</p>
          <p className="text-[11px] text-[#837064] mb-3">
            Up to 3 gift codes per day. Come back tomorrow after that.
          </p>

          <label className="text-xs font-semibold text-[#FDE4BC] mb-2">
            Please enter the gift code below
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleRedeem()}
            placeholder="Please enter gift code"
            className="w-full h-11 bg-[#181316] text-[#FDE4BC] placeholder-[#837064] text-xs px-4 rounded-full border border-[#3D363A]/60 focus:outline-none focus:border-[#FED358]/60 transition-colors mb-4"
          />
          <button
            disabled={loading}
            onClick={handleRedeem}
            className="w-full h-11 rounded-full text-xs font-bold text-[#5c3a08] bg-gradient-to-b from-[#FFE9A8] via-[#FED358] to-[#E8A84A] shadow-md shadow-[#FED358]/20 cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {loading ? "Receiving…" : "Receive"}
          </button>
        </div>

        {/* History Section Card */}
        <div className="bg-[#241E22] border border-[#3D363A]/60 rounded-xl p-4 shadow-md flex flex-col min-h-[220px]">
          <div className="flex items-center gap-2 mb-4">
            <HistoryBookIcon className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold text-white">History</span>
          </div>

          {historyLoading ? (
            <div className="py-12 text-center text-[#8e8e93] text-xs">
              Loading…
            </div>
          ) : history.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10">
              <p className="text-xs text-[#8e8e93]">No more</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="font-medium text-[#28C76F] text-[13px] leading-tight">
                      Successfully received
                    </span>
                    <span className="text-[12px] text-[#8e8e93] leading-tight">
                      {formatHistoryTime(item.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2.5 min-w-[78px] h-7 px-2.5 rounded-lg border border-[#84663B]/70 bg-[#1D171A]/80 shrink-0">
                    <WalletIcon className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-semibold text-[#FED358] text-xs">
                      {item.amount}
                    </span>
                  </div>
                </div>
              ))}
              <p className="text-center text-xs text-[#8e8e93] pt-4 pb-1">
                No more
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Winning Modal Popup ── */}
      {showWin && winAmount != null && (
        <div
          className="iw__modal"
          role="dialog"
          aria-modal="true"
          aria-label="Gift claimed result"
          onClick={() => setShowWin(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset("/assets/invitewheel/animate.gif")}
            alt=""
            className="iw__modal-fx"
            draggable={false}
            aria-hidden
          />
          <div className="iw__modal-card" onClick={(e) => e.stopPropagation()}>
            <p className="iw__modal-kicker">Congratulations</p>
            <p className="iw__modal-title">Gift Claimed!</p>
            <p className="iw__modal-amt">{formatINR(winAmount)}</p>
            <p className="iw__modal-sub">Credited to your balance</p>
            <button
              type="button"
              className="iw__modal-btn"
              onClick={() => setShowWin(false)}
            >
              Collect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
