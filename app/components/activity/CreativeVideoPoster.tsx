"use client";

/**
 * Creative video event rules — CSS/Tailwind stand-in for the old
 * TashanWin JPG (ik.imagekit.io/BCwin/20260801_211315.jpg).
 */

import React from "react";
import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import { asset } from "../../lib/cdn";

const TIERS: { viewers: string; bonus: string }[] = [
  { viewers: "1,000+", bonus: "₹700" },
  { viewers: "2,500+", bonus: "₹1,500" },
  { viewers: "5,000+", bonus: "₹2,000" },
  { viewers: "10,000+", bonus: "₹5,000" },
  { viewers: "100,000+", bonus: "₹25,000" },
];

const PLATFORMS: {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge: string;
  side: "left" | "right";
}[] = [
  {
    id: "youtube",
    label: "YouTube",
    icon: <FaYoutube className="text-[22px] text-white" />,
    badge: "bg-[#ff0000]",
    side: "left",
  },
  {
    id: "facebook",
    label: "Facebook",
    icon: <FaFacebookF className="text-[18px] text-white" />,
    badge: "bg-[#1877f2]",
    side: "left",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: <FaInstagram className="text-[20px] text-white" />,
    badge: "bg-[linear-gradient(135deg,#f9ce34_0%,#ee2a7b_50%,#6228d7_100%)]",
    side: "right",
  },
];

function Ribbon({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="relative mx-1 my-3">
      <div
        className="px-4 py-2 text-center"
        style={{
          background: "linear-gradient(180deg, #1f7a22 0%, #0f4a14 100%)",
          clipPath:
            "polygon(10px 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0 50%)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
        }}
      >
        <p className="text-[13px] font-black uppercase leading-tight tracking-wide text-[#FDE4BC] sm:text-[14px]">
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-white/85 sm:text-[12px]">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PlatformTable({
  icon,
  badge,
  side,
  label,
}: {
  icon: React.ReactNode;
  badge: string;
  side: "left" | "right";
  label: string;
}) {
  return (
    <div className="relative mb-3">
      <div
        className={`absolute z-10 flex h-11 w-11 items-center justify-center rounded-[12px] shadow-lg ${badge} ${
          side === "left" ? "-left-1 top-10" : "-right-1 top-10"
        }`}
        aria-hidden
      >
        {icon}
      </div>
      <div
        className="overflow-hidden rounded-[12px]"
        style={{
          border: "1.5px solid rgba(254,211,88,0.55)",
          background: "linear-gradient(180deg, #1a120c 0%, #0c0806 100%)",
        }}
      >
        <div
          className="grid grid-cols-2 text-center text-[13px] font-black uppercase tracking-wide text-[#FED358] sm:text-[14px]"
          style={{
            background: "linear-gradient(180deg, #3a2a10 0%, #1c1408 100%)",
          }}
        >
          <div className="border-r border-[#FED358]/25 py-2">Viewers</div>
          <div className="py-2">Income bonus</div>
        </div>
        {TIERS.map((row) => (
          <div
            key={`${label}-${row.viewers}`}
            className="grid grid-cols-2 border-t border-white/10 text-center text-[14px] font-bold tabular-nums"
          >
            <div className="border-r border-white/10 py-1.5 text-[#FDE4BC]">
              {row.viewers}
            </div>
            <div className="py-1.5 text-[#4ade80]">{row.bonus}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CreativeVideoPoster() {
  return (
    <div
      className="relative overflow-hidden rounded-[12px] text-white"
      style={{
        background:
          "linear-gradient(180deg, #f08a22 0%, #c45c14 16%, #6a2a0c 38%, #1a0c0a 62%, #0a0608 100%)",
        border: "1px solid rgba(254,211,88,0.18)",
        boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 12%, rgba(255,220,120,0.55) 0, transparent 28%), radial-gradient(circle at 88% 8%, rgba(255,160,40,0.4) 0, transparent 24%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 px-3 pb-5 pt-4 sm:px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset("/assets/png/bcwin.png")}
          alt="BCWin"
          width={100}
          height={30}
          className="mx-auto h-10 w-auto object-contain sm:h-11"
          style={{
            filter:
              "drop-shadow(0 4px 14px rgba(0,0,0,0.55)) drop-shadow(0 0 16px rgba(254,211,88,0.35))",
          }}
        />

        <h1
          className="mt-3 text-center text-[18px] font-black uppercase leading-tight tracking-wide sm:text-[20px]"
          style={{
            background: "linear-gradient(180deg, #fff6c8 0%, #FED358 55%, #e08a1a 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 2px 0 rgba(80,30,0,0.25)",
          }}
        >
          Creative video event get it all
        </h1>
        <p
          className="mt-1 text-center text-[34px] font-black leading-none tabular-nums sm:text-[40px]"
          style={{
            background: "linear-gradient(180deg, #fff 0%, #FED358 40%, #4ade80 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          75,000 RS
        </p>

        <Ribbon title="Make a video content about BCWin and get the bonus" />

        <div className="px-3">
          {PLATFORMS.map((p) => (
            <PlatformTable
              key={p.id}
              icon={p.icon}
              badge={p.badge}
              side={p.side}
              label={p.label}
            />
          ))}
        </div>

        <Ribbon
          title="Claim every 30 days"
          subtitle="After the video has been published"
        />

        <div
          className="mt-1 rounded-[12px] px-3 py-3"
          style={{
            border: "1.5px solid rgba(254,211,88,0.45)",
            background: "rgba(8,6,6,0.72)",
          }}
        >
          <p className="mb-2 text-center text-[15px] font-black uppercase tracking-wide text-[#FED358]">
            Terms and conditions
          </p>
          <ol className="space-y-2 text-[14px] leading-snug text-[#FDE4BC]">
            <li>
              1. Your referral should not use the same bank details and the same
              IP. Once detected you will be ineligible for claiming the bonus.
            </li>
            <li>
              2. In order to secure the safety of both parties, BCWin has the
              authority to oblige members to provide their valid documents for
              verification purposes if qualified or not.
            </li>
            <li>
              3. Engaged into this activity expresses your agreement.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
