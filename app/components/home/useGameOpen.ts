"use client";

import { useCallback, useRef, useState } from "react";
import type { GameDef } from "../../lib/home-catalog";
import * as api from "../../lib/api";
import { getTotalSuccessfulDeposit } from "../../lib/deposit-total";
import { isSafeHttpUrl, sanitizeErrorMessage } from "../../lib/safe";
import { useAuthState } from "../../context/AuthContext";
import { useToast } from "../ui/Toast";
import {
  MIN_LIFETIME_DEPOSIT_TO_PLAY,
} from "../../lib/play-deposit-gate";
import type { ThirdPartyGameSession } from "./ThirdPartyGameShell";

export type InoutDepositGateState = {
  open: boolean;
  gameName?: string;
  totalDeposit: number;
};

/**
 * Shared game open handler for home grids.
 * Inout launch requires lifetime SUCCESS recharge ≥ MIN_LIFETIME_DEPOSIT_TO_PLAY.
 * First-party lottery screens open freely; the bet confirm path is gated.
 * Third-party URLs open in an in-app iframe shell (not a new browser tab).
 */
export function useGameOpen(onOpenSpa?: (screen: string) => void) {
  const { toast } = useToast();
  const { isLoggedIn, user } = useAuthState();
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [depositGate, setDepositGate] = useState<InoutDepositGateState>({
    open: false,
    totalDeposit: 0,
  });
  const [gameSession, setGameSession] = useState<ThirdPartyGameSession | null>(
    null
  );
  const inflight = useRef(false);

  const closeDepositGate = useCallback(() => {
    setDepositGate((g) => ({ ...g, open: false }));
  }, []);

  const closeGameSession = useCallback(() => {
    setGameSession(null);
  }, []);

  /**
   * Lifetime ₹100 SUCCESS recharge.
   * Demo: lottery allowed; Inout still blocked.
   */
  const ensureDepositAllowed = useCallback(
    async (
      gameName: string,
      opts?: { blockDemo?: boolean }
    ): Promise<boolean> => {
      if (!isLoggedIn) {
        toast("Please log in to play", "error");
        onOpenSpa?.("login");
        return false;
      }
      if (opts?.blockDemo && user?.isDemo) {
        toast("Demo accounts cannot play third-party games", "error");
        return false;
      }
      if (user?.isDemo) return true;
      try {
        const total = await getTotalSuccessfulDeposit();
        if (total < MIN_LIFETIME_DEPOSIT_TO_PLAY) {
          setDepositGate({
            open: true,
            gameName,
            totalDeposit: total,
          });
          return false;
        }
        return true;
      } catch {
        toast("Could not verify deposit status. Try again.", "error");
        return false;
      }
    },
    [isLoggedIn, user?.isDemo, onOpenSpa, toast]
  );

  const openGame = useCallback(
    async (game: GameDef) => {
      const { action } = game;

      if (action.type === "spa") {
        onOpenSpa?.(action.screen);
        return;
      }
      if (action.type === "soon") {
        toast("Coming soon", "info");
        return;
      }
      if (inflight.current) return;

      if (action.type === "inout" || action.type === "inout-search") {
        inflight.current = true;
        setLaunchingId(game.id);
        try {
          const ok = await ensureDepositAllowed(game.name, { blockDemo: true });
          if (!ok) return;

          toast(`Launching ${game.name}…`, "info");

          let gameMode: string | undefined;
          if (action.type === "inout") {
            gameMode = action.gameMode;
          } else {
            const res = await api.getInoutGames({
              search: action.search,
              limit: 20,
            });
            const list = res.data ?? [];
            const q = action.search.toLowerCase();
            const exact = list.find(
              (g) =>
                g.title.toLowerCase() === q ||
                g.gameMode.toLowerCase() === q ||
                g.title.toLowerCase().includes(q) ||
                g.gameMode.toLowerCase().includes(q)
            );
            gameMode = (exact ?? list[0])?.gameMode;
            if (!gameMode) {
              toast(`${game.name} is unavailable right now`, "error");
              return;
            }
          }

          const launch = await api.launchInout(gameMode);
          const url = launch.gameUrl;
          if (!url || url === "testing") {
            toast(
              `${game.name} launch URL is not ready yet. Try again later.`,
              "error"
            );
            return;
          }
          if (!isSafeHttpUrl(url)) {
            toast(`${game.name} returned an unsafe or missing URL`, "error");
            return;
          }
          // Stay inside the app (Android WebView / PWA) — no new browser tab
          setGameSession({ url, title: game.name });
        } catch (e: unknown) {
          toast(
            sanitizeErrorMessage(e, `${game.name} is unavailable right now`),
            "error"
          );
        } finally {
          inflight.current = false;
          setLaunchingId(null);
        }
      }
    },
    [ensureDepositAllowed, onOpenSpa, toast]
  );

  return {
    openGame,
    launchingId,
    depositGate,
    closeDepositGate,
    gameSession,
    closeGameSession,
  };
}
