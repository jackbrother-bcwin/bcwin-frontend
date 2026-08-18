"use client";

import { asset } from "../../lib/cdn";
import React, { useEffect, useState } from "react";
import PageHeader from "../ui/PageHeader";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../lib/api";
import type { GiftHistoryItem } from "../../lib/api";
import { requireBankForCollect } from "../../lib/require-bank";
import EmptyState from "../promotion/shared/EmptyState";
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

export default function GiftsPage({ onBack, onNavigate }: Props) {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<GiftHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showWin, setShowWin] = useState(false);
  useSpaBackClose(showWin, () => setShowWin(false), "gift-win");
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
    void fetchHistory();
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
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base" role="img" aria-label="History">
              📙
            </span>
            <span className="text-sm font-bold text-[#FDE4BC]">History</span>
          </div>

          {historyLoading ? (
            <div className="py-12 text-center text-[#837064] text-xs">
              Loading…
            </div>
          ) : history.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6">
              <EmptyState label="No data" />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#181316] border border-[#3D363A]/50 rounded-lg p-3 flex justify-between items-center text-xs"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-[#FDE4BC]">
                      Code: {item.code}
                    </span>
                    <span className="text-[11px] text-[#837064]">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <span className="font-bold text-[#FED358] text-sm">
                    +{formatINR(item.amount, 0)}
                  </span>
                </div>
              ))}
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
