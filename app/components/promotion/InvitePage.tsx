"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { FaWhatsapp, FaTelegram, FaFacebookF, FaXTwitter } from "react-icons/fa6";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../ui/Toast";
import AgencyHeader from "./shared/AgencyHeader";

interface Props {
  onBack: () => void;
}

const POSTERS = [
  {
    id: "p1",
    title: "Full Odds Bonus Rate",
    tag1: "Fair and justice",
    tag2: "Open and transparent",
    highlight: "85%",
    bg: "linear-gradient(165deg,#4a90ff 0%,#2563eb 45%,#1e3a8a 100%)",
  },
  {
    id: "p2",
    title: "Invite & Earn Daily",
    tag1: "Safe platform",
    tag2: "Fast payout",
    highlight: "Daily",
    bg: "linear-gradient(165deg,#e8b84a 0%,#c8922a 45%,#6b4510 100%)",
  },
  {
    id: "p3",
    title: "Team Rewards",
    tag1: "6 levels",
    tag2: "Real-time",
    highlight: "BCWin",
    bg: "linear-gradient(165deg,#8b5cf6 0%,#5b21b6 45%,#2e1065 100%)",
  },
];

export default function InvitePage({ onBack }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [idx, setIdx] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const touchX = useRef<number | null>(null);
  const code = user?.referralCode ?? "";

  /** Opens app on Register with invite code prefilled */
  const inviteUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin;
    if (!code) return `${base}/?screen=register`;
    return `${base}/?screen=register&ref=${encodeURIComponent(code)}`;
  }, [code]);

  // Build scannable QR for the invite link
  useEffect(() => {
    if (!inviteUrl) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    setQrBusy(true);
    void QRCode.toDataURL(inviteUrl, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#110D14",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      })
      .finally(() => {
        if (!cancelled) setQrBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl || code);
      toast("Invitation link copied", "success");
    } catch {
      toast("Copy failed", "error");
    }
  };

  const downloadQr = () => {
    if (!qrDataUrl) {
      toast(code ? "QR not ready yet" : "No invitation code", "error");
      return;
    }
    try {
      const a = document.createElement("a");
      a.href = qrDataUrl;
      a.download = `bcwin-invite-${code || "qr"}.png`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast("QR code saved", "success");
    } catch {
      toast("Download failed", "error");
    }
  };

  const share = (app: "wa" | "tg" | "fb" | "x") => {
    const text = encodeURIComponent(`Join BCWin! ${inviteUrl}`);
    const u = encodeURIComponent(inviteUrl);
    const urls: Record<string, string> = {
      wa: `https://wa.me/?text=${text}`,
      tg: `https://t.me/share/url?url=${u}&text=${text}`,
      fb: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      x: `https://twitter.com/intent/tweet?text=${text}`,
    };
    window.open(urls[app], "_blank", "noopener,noreferrer");
  };

  const poster = POSTERS[idx] ?? POSTERS[0]!;

  return (
    <div className="agency-page">
      <AgencyHeader title="Invite" onBack={onBack} />
      <div className="agency-scroll agency-invite">
        <p className="agency-invite-hint">Please swipe left - right to choose your favorite poster</p>

        <div
          className="agency-poster-track"
          onTouchStart={(e) => {
            touchX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = touchX.current;
            const end = e.changedTouches[0]?.clientX;
            touchX.current = null;
            if (start == null || end == null) return;
            const dx = end - start;
            if (dx < -40) setIdx((i) => Math.min(POSTERS.length - 1, i + 1));
            if (dx > 40) setIdx((i) => Math.max(0, i - 1));
          }}
        >
          <div className="agency-poster" style={{ background: poster.bg }}>
            <div className="agency-poster-tags">
              <span>{poster.tag1}</span>
              <span>{poster.tag2}</span>
            </div>
            <h2 className="agency-poster-title">{poster.title}</h2>
            <div className="agency-poster-feats">
              <div>
                <span className="agency-poster-feat-ico" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6">
                    <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
                  </svg>
                </span>
                <p>Financial security</p>
              </div>
              <div>
                <span className="agency-poster-feat-ico" aria-hidden>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6">
                    <path d="M3 7h13l5 5v6H3V7zM16 7v5h5M7 17h2M15 17h2" />
                  </svg>
                </span>
                <p>Quick withdrawal</p>
              </div>
            </div>
            <p className="agency-poster-sub">Permanent commission up to</p>
            <p className="agency-poster-big">{poster.highlight}</p>

            <div className="agency-poster-gift">
              <div className="agency-poster-gift-box" aria-hidden>
                🎁
              </div>
              <div
                className="agency-qr-real"
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                  flexShrink: 0,
                }}
              >
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt="Invitation QR code"
                    width={88}
                    height={88}
                    style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
                    draggable={false}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#837064",
                      textAlign: "center",
                      padding: 6,
                    }}
                  >
                    {qrBusy ? "…" : "QR"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="agency-poster-dots">
          {POSTERS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={i === idx ? "agency-dot agency-dot--on" : "agency-dot"}
              onClick={() => setIdx(i)}
              aria-label={`Poster ${i + 1}`}
            />
          ))}
        </div>

        <p className="agency-invite-income">
          Invite friends · Income <span className="text-[#FED358] font-black">10 billion</span>{" "}
          Commission
        </p>

        {code ? (
          <p className="text-center text-[11px] text-white/40 mb-2 tabular-nums">
            Code · <span className="text-[#FED358] font-bold">{code}</span>
          </p>
        ) : null}

        <button
          type="button"
          className="agency-btn-primary"
          onClick={downloadQr}
          disabled={!qrDataUrl || qrBusy}
          style={{ opacity: !qrDataUrl || qrBusy ? 0.55 : 1 }}
        >
          {qrBusy ? "GENERATING QR…" : "DOWNLOAD QR CODE"}
        </button>
        <button type="button" className="agency-btn-outline" onClick={() => void copyLink()}>
          Copy invitation link
        </button>

        <p className="agency-share-label">Share to other apps to invite friend</p>
        <div className="agency-share-row">
          <button type="button" className="agency-share-btn" onClick={() => share("wa")}>
            <span className="agency-share-circle" style={{ background: "#25D366" }}>
              <FaWhatsapp size={26} color="#fff" aria-hidden />
            </span>
            WhatsApp
          </button>
          <button type="button" className="agency-share-btn" onClick={() => share("tg")}>
            <span className="agency-share-circle" style={{ background: "#2AABEE" }}>
              <FaTelegram size={24} color="#fff" aria-hidden />
            </span>
            Telegram
          </button>
          <button type="button" className="agency-share-btn" onClick={() => share("fb")}>
            <span className="agency-share-circle" style={{ background: "#1877F2" }}>
              <FaFacebookF size={22} color="#fff" aria-hidden />
            </span>
            Facebook
          </button>
          <button type="button" className="agency-share-btn" onClick={() => share("x")}>
            <span className="agency-share-circle" style={{ background: "#0f0f0f", border: "1px solid #333" }}>
              <FaXTwitter size={20} color="#fff" aria-hidden />
            </span>
            Twitter
          </button>
        </div>
      </div>
    </div>
  );
}
