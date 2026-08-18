"use client";

import { asset } from "../../lib/cdn";
import React, { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  IoLockClosedOutline,
  IoPhonePortraitOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoShieldCheckmarkOutline,
} from "react-icons/io5";
import { useAuthState, useAuthActions } from "../../context/AuthContext";
import { useToast } from "../../components/ui/Toast";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isLoading, isLoggedIn } = useAuthState();
  const { login } = useAuthActions();
  const { toast } = useToast();

  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = params.get("next") || "/admin/dashboard";
  const forbidden = params.get("error") === "forbidden";

  useEffect(() => {
    if (isLoading) return;
    if (isLoggedIn && user && (user.role === "ADMIN" || user.role === "SUB_ADMIN")) {
      router.replace(next.startsWith("/admin") ? next : "/admin/dashboard");
    }
  }, [isLoading, isLoggedIn, user, router, next]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mobile.length !== 10 || !password) {
      setError("Enter 10-digit mobile and password");
      return;
    }
    setBusy(true);
    try {
      await login({
        mobileNumber: mobile,
        countryCode: "91",
        password,
      });
      // refresh user is inside login — read from next tick via getUser role check in effect
      // force check
      const { getUser } = await import("../../lib/api");
      const res = await getUser();
      if (res.user.role !== "ADMIN" && res.user.role !== "SUB_ADMIN") {
        setError("This account is not an admin. Access denied.");
        toast("Not an admin account", "error");
        const { logout } = await import("../../lib/api");
        await logout();
        return;
      }
      toast("Welcome back, Admin", "success");
      router.replace(next.startsWith("/admin") ? next : "/admin/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      toast(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-login-page flex min-h-dvh min-h-screen">
      <div
        className="relative hidden w-[45%] flex-col justify-between overflow-hidden p-10 text-white lg:flex"
        style={{
          background: "linear-gradient(145deg, #2563eb 0%, #1d4ed8 50%, #1e3a8a 100%)",
        }}
      >
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 -left-10 h-72 w-72 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow-md">
              <Image
                src={asset("/assets/png/bcwin.png")}
                alt="BCWin"
                width={44}
                height={44}
                className="object-contain p-0.5"
                priority
              />
            </div>
            <p className="text-sm font-bold tracking-[0.18em] text-white/90">BCWIN</p>
          </div>
          <h1 className="mt-6 text-4xl font-black leading-tight">
            BCWin
            <br />
            Admin Console
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
            Production control plane for games, finance, users, and platform configuration.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-2 text-sm text-white/70">
          <IoShieldCheckmarkOutline size={18} />
          Secured session · ADMIN / SUB_ADMIN only
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#f0f2f5] p-4 sm:p-6 safe-bottom">
        <form
          onSubmit={onSubmit}
          className="admin-surface admin-fade-up w-full max-w-md p-5 sm:p-8"
        >
          <div className="mb-6 text-center lg:text-left">
            <div className="mb-4 flex justify-center lg:justify-start">
              <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow border border-slate-100">
                <Image
                  src={asset("/assets/png/bcwin.png")}
                  alt="BCWin"
                  width={44}
                  height={44}
                  className="object-contain p-0.5"
                  priority
                />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">BCWin Admin</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sign in with your admin mobile credentials
            </p>
          </div>

          {forbidden && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Your account does not have admin privileges.
            </div>
          )}

          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <IoPhonePortraitOutline size={14} className="text-blue-600" />
            Mobile number
          </label>
          <input
            className="admin-input mb-4"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />

          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <IoLockClosedOutline size={14} className="text-blue-600" />
            Password
          </label>
          <div className="relative mb-4">
            <input
              className="admin-input pr-10"
              type={show ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {show ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={busy} className="admin-btn-primary h-11 w-full text-sm">
            {busy ? "Signing in…" : "Sign in to Admin"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-blue-100 border-t-blue-600" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
