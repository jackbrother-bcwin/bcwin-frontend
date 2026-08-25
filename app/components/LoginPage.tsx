"use client";

import { asset } from "../lib/cdn";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import {
  IoChevronBack,
  IoPhonePortraitOutline,
  IoMailOutline,
  IoEyeOutline,
  IoEyeOffOutline,
  IoLockClosedOutline,
  IoHeadsetOutline,
  IoGlobeOutline,
  IoClose,
} from "react-icons/io5";
import { useAuthActions } from "../context/AuthContext";
import { openSafeUrl, sanitizeErrorMessage } from "../lib/safe";
import { OFFICIAL_TELEGRAM_URL } from "../lib/official-hosts";
import { persistLocale, type AppLocale } from "../lib/i18n";
import PuzzleCaptcha, {
  preloadNatureScene,
  type PuzzleCaptchaResult,
} from "./ui/PuzzleCaptcha";
import CountryCodeSelect from "./ui/CountryCodeSelect";
import { useSpaBackClose } from "../hooks/useSpaBackClose";
import {
  getCountryOption,
  type CountryCode,
} from "../lib/countryPhone";

interface LoginPageProps {
  onBack: () => void;
  onRegisterClick: () => void;
  onForgotClick?: () => void;
  onSuccess?: () => void;
}

export default function LoginPage({
  onBack,
  onRegisterClick,
  onForgotClick,
  onSuccess,
}: LoginPageProps) {
  const { t, i18n } = useTranslation();
  const { login } = useAuthActions();
  const [loginMethod, setLoginMethod] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>("91");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  /** Credentials stored after field validation, used when captcha passes */
  const pendingCredsRef = useRef<
    | { kind: "phone"; mobileNumber: string; countryCode: string; password: string }
    | { kind: "email"; email: string; password: string }
    | null
  >(null);
  const countryMeta = getCountryOption(countryCode);
  /** Scene warmed on login-page entry — served instantly when modal opens */
  const [preloadedScene, setPreloadedScene] = useState<string | null>(null);
  /** Extra scene kept ready for refresh / failed attempt */
  const standbySceneRef = useRef<string | null>(null);
  const warmGenRef = useRef(0);

  const refillStandby = useCallback(() => {
    const gen = warmGenRef.current;
    void preloadNatureScene().then((url) => {
      if (gen !== warmGenRef.current) return;
      standbySceneRef.current = url;
    });
  }, []);

  /** Promote standby → active, kick off another warm in background */
  const advanceScene = useCallback(async (): Promise<string> => {
    const fromStandby = standbySceneRef.current;
    standbySceneRef.current = null;
    if (fromStandby) {
      setPreloadedScene(fromStandby);
      refillStandby();
      return fromStandby;
    }
    const url = await preloadNatureScene();
    setPreloadedScene(url);
    refillStandby();
    return url;
  }, [refillStandby]);

  // Warm primary + standby as soon as login page mounts (new photo each visit)
  useEffect(() => {
    const gen = ++warmGenRef.current;
    standbySceneRef.current = null;
    setPreloadedScene(null);

    void (async () => {
      const primary = await preloadNatureScene();
      if (gen !== warmGenRef.current) return;
      setPreloadedScene(primary);
      const standby = await preloadNatureScene();
      if (gen !== warmGenRef.current) return;
      standbySceneRef.current = standby;
    })();

    return () => {
      warmGenRef.current += 1;
    };
  }, []);

  const resolveScene = useCallback(async () => {
    return advanceScene();
  }, [advanceScene]);

  /**
   * Secure login flow:
   * 1) Validate fields (no API call yet)
   * 2) Show captcha puzzle
   * 3) On captcha solved → fire login API with stored credentials
   * 4) On login success → navigate into app
   * 5) On login failure → show error, dismiss captcha
   * No session is created until captcha passes.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Please fill in all fields");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (loginMethod === "phone") {
      if (phone.length !== countryMeta.maxLen) {
        setError(
          `Enter a valid ${countryMeta.maxLen}-digit phone for ${countryMeta.name}`
        );
        return;
      }
      pendingCredsRef.current = {
        kind: "phone",
        mobileNumber: phone,
        countryCode,
        password,
      };
    } else {
      const em = email.trim().toLowerCase();
      if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        setError("Enter a valid email address");
        return;
      }
      pendingCredsRef.current = {
        kind: "email",
        email: em,
        password,
      };
    }

    // Store credentials and open captcha — NO API call yet
    setCaptchaToken(null);
    setShowCaptcha(true);
  };

  const handleCaptchaVerified = async (r: PuzzleCaptchaResult) => {
    setCaptchaToken(r.token);
    setError(null);
    const creds = pendingCredsRef.current;
    if (!creds) return;

    // Now that captcha is solved, fire the actual login API
    setIsLoading(true);
    try {
      if (creds.kind === "email") {
        await login({ email: creds.email, password: creds.password });
      } else {
        await login({
          mobileNumber: creds.mobileNumber,
          password: creds.password,
          countryCode: creds.countryCode,
        });
      }
      // Brief success beat, then enter the app
      window.setTimeout(() => {
        setShowCaptcha(false);
        pendingCredsRef.current = null;
        onSuccess?.();
      }, 350);
    } catch (err: unknown) {
      setError(sanitizeErrorMessage(err, "Login failed. Please try again."));
      setShowCaptcha(false);
      setCaptchaToken(null);
      setCaptchaReset((n) => n + 1);
    } finally {
      setIsLoading(false);
    }
  };

  const closeCaptcha = () => {
    setShowCaptcha(false);
    setCaptchaToken(null);
    pendingCredsRef.current = null;
  };
  useSpaBackClose(showCaptcha, closeCaptcha, "login-captcha");

  return (
    <div className="ts-page w-full max-w-full pb-8">
      <header className="app-page-header app-page-header--lg app-fixed-chrome fixed top-0 z-50">
        <div className="app-page-header-inner gap-2">
        <button
          type="button"
          onClick={onBack}
          className="home-icon-btn shrink-0 text-[#FDE4BC]"
          aria-label="Back"
          style={{
            background: "rgba(254,211,88,0.1)",
            borderColor: "rgba(254,211,88,0.25)",
          }}
        >
          <IoChevronBack size={20} />
        </button>
        <div className="relative h-8 w-[96px] min-w-0 shrink sm:w-[120px]">
          <Image
            src={asset("/assets/png/bcwin.png")}
            alt="BCWin"
            fill
            sizes="120px"
            className="object-contain"
            priority
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const next: AppLocale = i18n.language === "hi" ? "en" : "hi";
            void i18n.changeLanguage(next);
            persistLocale(next);
          }}
          className="flex h-7 min-h-7 max-h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[13px] font-bold text-[#FDE4BC]"
          style={{
            background: "rgba(254,211,88,0.1)",
            border: "1px solid rgba(254,211,88,0.25)",
          }}
          aria-label={t("common.language")}
        >
          <IoGlobeOutline size={12} color="#FED358" />
          {i18n.language === "hi" ? "HI" : "EN"}
        </button>
        </div>
      </header>
      <div className="app-page-header-spacer app-page-header-spacer--lg" aria-hidden />

      <div className="flex w-full min-w-0 max-w-full flex-1 flex-col px-3.5 pt-5 sm:px-5">
        <h1 className="text-[24px] font-bold text-[#FDE4BC] mb-1.5 tracking-wide">
          {t("login.title")}
        </h1>
        <p className="text-[14px] text-[#B79C8B] leading-relaxed whitespace-pre-line">
          {t("login.subtitle")}
        </p>

        {/* Method tabs — short labels for narrow devices */}
        <div
          className="mb-5 mt-6 flex w-full min-w-0"
          style={{ borderBottom: "1.5px solid #3D363A" }}
        >
          {(
            [
              { id: "phone" as const, label: t("login.phone"), Icon: IoPhonePortraitOutline },
              { id: "email" as const, label: t("login.email"), Icon: IoMailOutline },
            ] as const
          ).map((m) => {
            const active = loginMethod === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setLoginMethod(m.id)}
                className="relative flex min-w-0 flex-1 items-center justify-center gap-1 pb-2.5 text-[14px] font-bold transition-colors sm:text-[15px]"
                style={{ color: active ? "#FED358" : "#837064" }}
              >
                <m.Icon size={14} className="shrink-0" />
                <span className="truncate">{m.label}</span>
                {active && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded"
                    style={{ background: "#FED358" }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex w-full min-w-0 max-w-full flex-col gap-3.5">
          {loginMethod === "phone" ? (
            <div>
              <label className="text-[13px] text-[#B79C8B] mb-1.5 flex items-center gap-1.5">
                <IoPhonePortraitOutline size={12} color="#FED358" />
                {t("login.phoneNumber")}
              </label>
              <div className="flex gap-2">
                <CountryCodeSelect
                  value={countryCode}
                  onChange={(code) => {
                    setCountryCode(code);
                    setPhone("");
                    setError(null);
                  }}
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  name="username"
                  autoComplete="username tel"
                  value={phone}
                  onChange={(e) =>
                    setPhone(
                      e.target.value
                        .replace(/\D/g, "")
                        .slice(0, countryMeta.maxLen)
                    )
                  }
                  placeholder={countryMeta.placeholder}
                  className="ts-input flex-1"
                  aria-label={t("login.phoneNumber")}
                  maxLength={countryMeta.maxLen}
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[13px] text-[#B79C8B] mb-1.5 flex items-center gap-1.5">
                <IoMailOutline size={12} color="#FED358" />
                {t("login.email")}
              </label>
              <input
                type="email"
                name="email"
                autoComplete="username email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("login.emailPlaceholder")}
                className="ts-input"
                aria-label={t("login.email")}
              />
            </div>
          )}

          <div>
            <label className="text-[13px] text-[#B79C8B] mb-1.5 flex items-center gap-1.5">
              <IoLockClosedOutline size={12} color="#FED358" />
              {t("login.password")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("login.passwordPlaceholder")}
                className="ts-input pr-11"
                aria-label={t("login.password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#837064]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <IoEyeOffOutline size={18} /> : <IoEyeOutline size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <button
              type="button"
              onClick={() => setRememberPassword(!rememberPassword)}
              className="w-[18px] h-[18px] rounded-full flex items-center justify-center border transition-all"
              style={{
                background: rememberPassword ? "#FED358" : "transparent",
                borderColor: rememberPassword ? "#FED358" : "#837064",
              }}
            >
              {rememberPassword && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#110D14" strokeWidth="4">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
            <span
              className="text-[14px] text-[#B79C8B] font-medium select-none"
              onClick={() => setRememberPassword(!rememberPassword)}
            >
              {t("login.remember")}
            </span>
          </div>

          {error && (
            <div
              className="px-3 py-2.5 rounded-lg text-[14px] font-medium"
              style={{
                background: "rgba(218,55,53,0.12)",
                border: "1px solid rgba(218,55,53,0.35)",
                color: "#FD565C",
              }}
            >
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 mt-3">
            <button
              type="submit"
              disabled={isLoading}
              className="ts-btn-gold w-full h-[44px] text-[16px] disabled:opacity-60"
            >
              {isLoading ? t("login.loggingIn") : t("login.submit")}
            </button>
            <button
              type="button"
              onClick={onRegisterClick}
              className="ts-btn-outline w-full h-[44px] text-[16px]"
            >
              {t("login.register")}
            </button>
          </div>
        </form>

        <div className="mt-10 flex justify-center gap-14">
          <button
            type="button"
            onClick={() => onForgotClick?.()}
            className="flex flex-col items-center gap-1.5 text-[14px] text-[#B79C8B] font-bold active:text-[#FED358]"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(254,211,88,0.1)",
                border: "1px solid rgba(254,211,88,0.25)",
              }}
            >
              <IoLockClosedOutline size={18} color="#FED358" />
            </div>
            <span>{t("login.forgot")}</span>
          </button>
          <button
            type="button"
            onClick={() => openSafeUrl(OFFICIAL_TELEGRAM_URL)}
            className="flex flex-col items-center gap-1.5 text-[14px] text-[#B79C8B] font-bold active:text-[#FED358]"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{
                background: "rgba(254,211,88,0.1)",
                border: "1px solid rgba(254,211,88,0.25)",
              }}
            >
              <IoHeadsetOutline size={18} color="#FED358" />
            </div>
            <span>Customer Service</span>
          </button>
        </div>
      </div>

      {/* Captcha modal — only after Log in click */}
      {showCaptcha && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="captcha-dialog-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
            aria-label="Close verification"
            onClick={closeCaptcha}
            disabled={isLoading}
          />
          <div
            className="relative z-10 w-full max-w-[400px] rounded-[16px] p-4 shadow-2xl sm:p-5"
            style={{
              background: "linear-gradient(180deg,#2A2228 0%,#1A1418 100%)",
              border: "1px solid #3D363A",
            }}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2
                  id="captcha-dialog-title"
                  className="text-[17px] font-bold text-[#FDE4BC]"
                >
                  Security check
                </h2>
                <p className="mt-0.5 text-[13px] text-[#B79C8B]">
                  Slide the puzzle piece to finish signing in
                </p>
              </div>
              <button
                type="button"
                onClick={closeCaptcha}
                disabled={isLoading}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#B79C8B] active:bg-white/5 disabled:opacity-40"
                aria-label="Close"
              >
                <IoClose size={20} />
              </button>
            </div>

            <PuzzleCaptcha
              resetKey={captchaReset}
              preloadedScene={preloadedScene}
              resolveScene={resolveScene}
              onVerified={handleCaptchaVerified}
              onReset={() => setCaptchaToken(null)}
            />

            {!isLoading && (
              <p className="mt-3 text-center text-[13px] text-[#B79C8B]">
                Complete the puzzle to sign in
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
