"use client";

import React, { useState, useEffect } from "react";
import { formatINR } from "../lib/format";

interface Winner {
  id: number;
  user: string;
  amount: string;
  game: string;
}

const INITIAL_WINNERS: Winner[] = [
  { id: 1, user: "Mem***92", amount: "₹420.00", game: "Win Go 1Min" },
  { id: 2, user: "Pl***05", amount: "₹1,850.00", game: "TRX WinGo" },
  { id: 3, user: "Tas***88", amount: "₹80.00", game: "K3 Lot 3Min" },
  { id: 4, user: "Win***31", amount: "₹6,320.00", game: "5D Lottery" },
  { id: 5, user: "Pl***67", amount: "₹120.00", game: "Moto Racing" },
];

export default function WinnersTicker() {
  const [winners, setWinners] = useState<Winner[]>(INITIAL_WINNERS);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate new winner arrival — BCWin lottery only
      const names = ["Raj***", "Man***", "Ami***", "Kab***", "Sur***", "Dee***"];
      const games = [
        "Win Go 1Min",
        "Win Go 30sec",
        "K3 Lot 3Min",
        "5D Lottery",
        "TRX WinGo",
        "Moto Racing",
      ];
      const amounts = [120, 240, 500, 1250, 4800, 12000];

      const name = names[Math.floor(Math.random() * names.length)] ?? "User***";
      const amount = amounts[Math.floor(Math.random() * amounts.length)] ?? 100;
      const game = games[Math.floor(Math.random() * games.length)] ?? "Win Go";
      const newWinner: Winner = {
        id: Date.now(),
        user: name + Math.floor(10 + Math.random() * 90),
        amount: formatINR(amount),
        game,
      };

      setWinners((prev) => [newWinner, ...prev.slice(0, 4)]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-4 mb-6 bg-bg-level-3 rounded-lg p-4 border border-bg-level-3/30">
      {/* Title */}
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1.5 h-4 bg-brand-gold rounded-full shadow-gold-glow" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-level-3">
          Latest Winners
        </h3>
      </div>

      {/* List wrapper */}
      <div className="flex flex-col gap-2 relative h-[140px] overflow-hidden">
        {winners.map((winner, idx) => (
          <div
            key={winner.id}
            className={`flex items-center justify-between p-2 rounded bg-bg-level-4/50 text-[11px] transition-all duration-500 ease-in-out ${
              idx === 0 ? "animate-fadeIn" : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-level-4">{winner.user}</span>
              <span className="text-text-level-5">won in</span>
              <span className="text-brand-gold font-medium">{winner.game}</span>
            </div>
            <div className="font-bold text-brand-green">{winner.amount}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
