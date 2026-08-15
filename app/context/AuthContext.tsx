"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import * as api from "../lib/api";
import type { User } from "../lib/api";
import { gameWs } from "../lib/ws";
import { clearDailyPromoHide } from "../lib/promo-storage";

// ─── Split contexts: state changes often; actions are stable ─────────────────

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
}

interface AuthActions {
  login: (opts: api.LoginOpts) => Promise<void>;
  register: (opts: {
    username: string;
    password: string;
    mobileNumber: string;
    otp: string;
    countryCode?: string;
    email?: string;
    referredBy: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  applyBalance: (balance: number) => void;
}

/** Combined shape for backward-compatible useAuth() */
export type AuthContextValue = AuthState & AuthActions;

const AuthStateContext = createContext<AuthState | null>(null);
const AuthActionsContext = createContext<AuthActions | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.getUser();
      setUser(res.user);
    } catch {
      setUser(null);
    }
  }, []);

  const applyBalance = useCallback((balance: number) => {
    setUser((u) => {
      if (!u || u.balance === balance) return u;
      return { ...u, balance };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    // Don't hold BrandSplash forever if API is slow/unreachable
    const hardStop = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 5_000);
    refreshUser().finally(() => {
      if (!cancelled) setIsLoading(false);
      clearTimeout(hardStop);
    });
    return () => {
      cancelled = true;
      clearTimeout(hardStop);
    };
  }, [refreshUser]);

  // WebSocket: only when authenticated user id present
  useEffect(() => {
    if (!user?.id) {
      gameWs.disconnect();
      return;
    }
    gameWs.connect();
    const unsub = gameWs.subscribe("account-balance", (data) => {
      const bal = (data as { balance?: number } | null)?.balance;
      if (typeof bal === "number") applyBalance(bal);
    });
    return () => {
      unsub();
    };
  }, [user?.id, applyBalance]);

  const login = useCallback(
    async (opts: api.LoginOpts) => {
      await api.login(opts);
      // Always show daily promo after a fresh login (HomePopups may be unmounted)
      clearDailyPromoHide();
      await refreshUser();
    },
    [refreshUser]
  );

  const register = useCallback(
    async (opts: {
      username: string;
      password: string;
      mobileNumber: string;
      otp: string;
      countryCode?: string;
      email?: string;
      referredBy: string;
    }) => {
      await api.register(opts);
      clearDailyPromoHide();
      await refreshUser();
    },
    [refreshUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      // Must clear here — logout is usually from Account, not Home
      clearDailyPromoHide();
      gameWs.disconnect();
      setUser(null);
    }
  }, []);

  const state = useMemo<AuthState>(
    () => ({
      user,
      isLoggedIn: user !== null,
      isLoading,
    }),
    [user, isLoading]
  );

  // Stable — only recreated if callbacks change (they rarely do)
  const actions = useMemo<AuthActions>(
    () => ({
      login,
      register,
      logout,
      refreshUser,
      applyBalance,
    }),
    [login, register, logout, refreshUser, applyBalance]
  );

  return (
    <AuthStateContext.Provider value={state}>
      <AuthActionsContext.Provider value={actions}>
        {children}
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

/** Full auth (state + actions). Prefer useAuthState / useAuthActions when possible. */
export function useAuth(): AuthContextValue {
  const state = useContext(AuthStateContext);
  const actions = useContext(AuthActionsContext);
  if (!state || !actions) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}

/** Subscribe only to user / loading — avoids re-render when only callers need actions */
export function useAuthState(): AuthState {
  const state = useContext(AuthStateContext);
  if (!state) throw new Error("useAuthState must be used inside <AuthProvider>");
  return state;
}

/** Stable action refs — components using only this rarely re-render on balance updates */
export function useAuthActions(): AuthActions {
  const actions = useContext(AuthActionsContext);
  if (!actions) throw new Error("useAuthActions must be used inside <AuthProvider>");
  return actions;
}
