"use client";

import React from "react";
import PageHeader from "../ui/PageHeader";
import { useAuth } from "../../context/AuthContext";
import { formatINR } from "../../lib/format";

interface Props {
  onBack: () => void;
  onNavigate: (screen: string) => void;
}

export default function WalletPage({ onBack, onNavigate }: Props) {
  const { user, refreshUser } = useAuth();

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-20" style={{ background: "#110D14" }}>
      <PageHeader title="Wallet" onBack={onBack} />

      <div className="mx-3 mt-4 rounded-[12px] p-5 text-center"
        style={{ background: "linear-gradient(160deg, #382E35 0%, #241E22 100%)", border: "1px solid rgba(254,211,88,0.22)" }}>
        <p className="text-[13px] text-white/50 mb-1">Total balance</p>
        <div className="flex items-center justify-center gap-2">
          <span className="text-[30px] font-black text-white">{formatINR(user?.balance)}</span>
          <button onClick={() => refreshUser()} className="p-1.5 text-white/50 active:text-brand-gold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mx-3 mt-4 grid grid-cols-2 gap-3">
        {[
          { id: "deposit", label: "Deposit", color: "#17B15E", desc: "Add funds" },
          { id: "withdraw", label: "Withdraw", color: "#5088D3", desc: "Cash out" },
          { id: "deposit-history", label: "Deposit history", color: "#FED358", desc: "Past deposits" },
          { id: "withdraw-history", label: "Withdraw history", color: "#FED358", desc: "Past withdrawals" },
          { id: "bank", label: "Bank details", color: "#FFB472", desc: "Account info" },
          { id: "game-history", label: "Game history", color: "#9B48DB", desc: "All bets" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="rounded-[10px] p-3.5 text-left active:scale-[0.98] transition-transform"
            style={{ background: "#241E22", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="w-8 h-8 rounded-full mb-2 flex items-center justify-center"
              style={{ background: `${item.color}22`, border: `1px solid ${item.color}44` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
            </div>
            <p className="text-[14px] font-bold text-white">{item.label}</p>
            <p className="text-[12px] text-white/40 mt-0.5">{item.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
