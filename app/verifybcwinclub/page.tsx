"use client";

import React, { useState } from "react";
import Image from "next/image";

/** Only these six hosts are official. Prefix match / "contains bcwin" is not enough. */
const OFFICIAL_HOSTS = [
  "bcwin.club",
  "bcwin7.site",
  "bcwin7.live",
  "bcwin.click",
  "bcwin7.xyz",
  "bcwin.best",
] as const;

const OFFICIAL_SET = new Set<string>(OFFICIAL_HOSTS);

/** Hostname only. Strips protocol, www, path, query, port. */
function extractHostname(raw: string): string | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  try {
    const href = /^[a-z][a-z0-9+.-]*:\/\//.test(t) ? t : `https://${t}`;
    const host = new URL(href).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    const host = t
      .replace(/^(https?:\/\/)?(www\.)?/, "")
      .split(/[/?#:]/)[0]
      ?.replace(/\.$/, "");
    return host || null;
  }
}

export default function VerifyBcwinClubPage() {
  const [inputUrl, setInputUrl] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "verifying" | "success" | "invalid">("idle");
  const [verifiedDomain, setVerifiedDomain] = useState("");
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [copiedDomain, setCopiedDomain] = useState<string | null>(null);

  const domainList = OFFICIAL_HOSTS;

  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputUrl.trim()) return;

    setVerifyStatus("verifying");
    const host = extractHostname(inputUrl);

    setTimeout(() => {
      if (host && OFFICIAL_SET.has(host)) {
        setVerifyStatus("success");
        setVerifiedDomain(host);
      } else {
        setVerifyStatus("invalid");
        setVerifiedDomain(host || inputUrl.trim());
      }
    }, 600);
  };

  const handleVisit = (domain: string) => {
    setCopiedDomain(domain);
    setTimeout(() => setCopiedDomain(null), 2000);
    window.open(`https://${domain}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen w-full bg-[#111622] text-white flex flex-col items-center justify-start antialiased selection:bg-[#ffc832] selection:text-black">
      {/* Center column shell matching mobile & desktop layout */}
      <div className="w-full max-w-[480px] min-h-screen bg-[#131924] flex flex-col shadow-2xl border-x border-[#1e2738] pb-12">
        
        {/* 1. Header Section */}
        <header className="bg-[#151c28] border-b border-[#242e42] pt-5 pb-4 px-4 flex flex-col items-center justify-center relative shadow-md">
          <div className="relative h-10 w-[168px] sm:h-12 sm:w-[200px]">
            <Image
              src="/assets/png/bcwin.png"
              alt="BCWin"
              fill
              sizes="200px"
              className="object-contain"
              priority
            />
          </div>
        </header>

        {/* Main Content Area */}
        <main className="p-3.5 sm:p-4 flex flex-col gap-4">

          {/* 2. Verification Search Bar */}
          <form onSubmit={handleVerify} className="w-full flex flex-col gap-2">
            <div className="w-full bg-[#121927] border border-[#26334a] rounded-xl flex items-center p-1 shadow-inner focus-within:border-[#ffc832] transition-all">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => {
                  setInputUrl(e.target.value);
                  if (verifyStatus !== "idle") setVerifyStatus("idle");
                }}
                placeholder="Verify BCWIN CLUB URL..."
                className="bg-transparent text-white placeholder:text-[#64748b] text-sm sm:text-base px-3.5 py-2.5 outline-none flex-1 font-medium w-full"
              />
              <button
                type="submit"
                disabled={verifyStatus === "verifying"}
                className="bg-[#ff253a] hover:bg-[#e01f33] text-white text-sm sm:text-base font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 shrink-0 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-70"
              >
                {/* Lock Icon */}
                <svg className="w-4 h-4 text-white shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                </svg>
                <span>{verifyStatus === "verifying" ? "Checking..." : "Verify"}</span>
              </button>
            </div>

            {/* Verification Result Toast/Box */}
            {verifyStatus === "success" && (
              <div className="bg-[#102a1e] border border-[#22c55e] text-[#4ade80] text-xs sm:text-sm p-3 rounded-xl flex items-center justify-between shadow-lg animate-fadeIn">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#22c55e] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">Official BCWIN CLUB domain verified!</span>
                </div>
                <span className="text-[11px] bg-[#164e33] px-2 py-0.5 rounded text-white font-mono">{verifiedDomain}</span>
              </div>
            )}

            {verifyStatus === "invalid" && (
              <div className="bg-[#31171a] border border-[#ef4444] text-[#fca5a5] text-xs sm:text-sm p-3 rounded-xl flex items-center justify-between shadow-lg animate-fadeIn">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#ef4444] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">Unverified or phishing URL warning!</span>
                </div>
              </div>
            )}
          </form>

          {/* 3. Hero Feature Card */}
          <div className="bg-[#151d2b] border border-[#ffca36] rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
            <div className="border-l-4 border-[#ffca36] pl-3.5 flex flex-col gap-1">
              <h2 className="text-[#ffc832] font-black text-lg sm:text-xl tracking-wide uppercase leading-tight font-sans">
                A WORLD-CLASS ENTERTAINMENT BETTING PLATFORM
              </h2>
              <p className="text-[#cbd5e1] text-xs sm:text-sm font-medium mt-1 leading-relaxed">
                INR &amp; USDT dual-currency support, choose freely.
              </p>
            </div>
          </div>

          {/* 4. "Play now" Section */}
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-[#ffc832] font-black text-lg sm:text-xl tracking-wide">
              {/* Laptop / Computer Icon */}
              <svg className="w-5 h-5 text-[#ffc832]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" />
                <path d="M8 21h8M12 17v4" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <span>Play now</span>
            </div>

            {/* List Box containing 5 Domains */}
            <div className="bg-[#151c27] p-2.5 sm:p-3 rounded-2xl border border-[#202b3c] flex flex-col gap-2.5 shadow-md">
              {domainList.map((domain, index) => (
                <div
                  key={domain}
                  className="bg-[#1b2434] hover:bg-[#202b3e] transition-all p-3 rounded-xl border border-[#28354c] flex items-center justify-between gap-2 shadow-sm group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Number Badge */}
                    <div className="w-7 h-7 bg-[#ff3b4e] rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
                      {index + 1}
                    </div>
                    {/* Domain Name */}
                    <span className="font-bold text-white text-sm sm:text-base tracking-wide truncate">
                      {domain}
                    </span>
                  </div>

                  {/* Visit Action Button */}
                  <button
                    onClick={() => handleVisit(domain)}
                    className="bg-[#ff253a] hover:bg-[#e01f33] text-white font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow transition-all active:scale-95 cursor-pointer shrink-0"
                  >
                    <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                    </svg>
                    <span>{copiedDomain === domain ? "Opening..." : "Visit"}</span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* 5. VPN Help Section */}
          <div className="bg-[#151d2b] p-4 sm:p-5 rounded-xl border border-[#ffca36] shadow-xl flex flex-col gap-3.5">
            <div className="flex items-start gap-3">
              {/* Globe Icon Box */}
              <div className="w-11 h-11 bg-[#ffb800] rounded-xl flex items-center justify-center text-[#111927] text-xl font-bold shrink-0 shadow-md">
                <svg className="w-6 h-6 text-[#111927]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeWidth="2" />
                </svg>
              </div>

              {/* Title */}
              <h3 className="text-[#ffc832] font-black text-base sm:text-lg leading-tight pt-1">
                Having trouble accessing the website?
              </h3>
            </div>

            {/* Description */}
            <p className="text-[#c2cbd8] text-xs sm:text-sm leading-relaxed">
              If access is restricted in your current region, install a VPN and reconnect before visiting the website.
            </p>

            {/* VPN Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-1">
              <a
                href="https://1.1.1.1"
                target="_blank"
                rel="noreferrer"
                className="bg-[#ffb800] hover:bg-[#e6a600] text-[#111827] font-black text-xs sm:text-sm py-3 px-3 rounded-xl text-center shadow-md transition-all active:scale-95 flex items-center justify-center"
              >
                Install VPN
              </a>
              <button
                onClick={() => alert("Please download Cloudflare 1.1.1.1 or NordVPN to restore full access to BCWIN CLUB domains.")}
                className="bg-[#1e2838] hover:bg-[#253246] text-white font-bold text-xs sm:text-sm py-3 px-3 rounded-xl border border-[#374760] text-center shadow-md transition-all active:scale-95 flex items-center justify-center cursor-pointer"
              >
                Installation Guide
              </button>
            </div>
          </div>

          {/* 6. Video & Feature Statement Banner Section */}
          <div className="bg-gradient-to-b from-[#18202d] via-[#111722] to-[#0c1017] border border-[#ffca36]/60 rounded-xl overflow-hidden shadow-2xl relative flex flex-col">
            {/* Art Deco Gold Corner Accents */}
            <div className="p-4 sm:p-5 flex flex-col gap-4 relative z-10">

              {/* Feature Bullet 1 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 text-[#ffc832] shrink-0 mt-0.5">
                  {/* Scale Icon */}
                  <svg className="w-7 h-7 text-[#ffc832]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l9-4 9 4M12 2v20M4 10l5 9m5-9l5 9M1 10h6m10 0h6" />
                  </svg>
                </div>
                <p className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider leading-snug">
                  BCWIN CLUB PROVIDES <span className="text-[#ff253a] font-extrabold">FAIR</span> AND <span className="text-[#ff253a] font-extrabold">EXCELLENT</span> GAMES
                </p>
              </div>

              {/* Feature Bullet 2 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 text-[#ffc832] shrink-0 mt-0.5">
                  {/* Agent/Users Icon */}
                  <svg className="w-7 h-7 text-[#ffc832]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5 5 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider leading-snug">
                  EACH ADMIN HAS THE ABILITY TO AGENT DEVELOPMENT <span className="text-[#ff253a] font-extrabold">SUPPORT</span> AND FIX ANY DIFFICULT <span className="text-[#ff253a] font-extrabold">PROBLEMS</span>
                </p>
              </div>

              {/* Feature Bullet 3 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 text-[#ffc832] shrink-0 mt-0.5">
                  {/* Security Shield Icon */}
                  <svg className="w-7 h-7 text-[#ffc832]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <p className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider leading-snug">
                  THE PLATFORM ENSURES THE <span className="text-[#ff253a] font-extrabold">SECURITY</span> OF ACCOUNT FUNDS AND <span className="text-[#ff253a] font-extrabold">CONFIDENTIALITY</span> OF INFORMATION
                </p>
              </div>

              {/* Join Now Subtle Watermark */}
              <div className="w-full flex justify-center my-1">
                <span className="text-[11px] font-black tracking-widest text-[#ffc832]/60 border border-[#ffc832]/40 rounded-full px-5 py-1 uppercase bg-[#ffc832]/5">
                  JOIN NOW
                </span>
              </div>
            </div>

            {/* Video Control Bar at bottom matching Screenshot 2 */}
            <div className="bg-black/95 px-3 py-2 border-t border-[#232f45] flex items-center justify-between text-xs text-gray-300 select-none">
              <div className="flex items-center gap-2.5">
                {/* Play/Pause toggle */}
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {isPlaying ? (
                    <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                {/* Time Display */}
                <span className="font-mono text-[11px] text-gray-300">0:18 / 0:20</span>
              </div>

              <div className="flex items-center gap-3">
                {/* Mute button */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {isMuted ? (
                    <svg className="w-4 h-4 fill-current text-gray-400" viewBox="0 0 24 24">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                  )}
                </button>

                {/* Fullscreen icon */}
                <svg className="w-4 h-4 fill-current text-gray-400 hover:text-white transition-colors cursor-pointer" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>

                {/* Options dots */}
                <svg className="w-4 h-4 fill-current text-gray-400 hover:text-white transition-colors cursor-pointer" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </div>
            </div>

            {/* Video Progress Bar Line */}
            <div className="w-full bg-gray-800 h-1 relative">
              <div className="bg-[#ff253a] h-1 w-[90%] transition-all"></div>
            </div>
          </div>

          {/* 7. FAQ Informational Cards */}
          <div className="flex flex-col gap-4">
            {/* FAQ 1 */}
            <div className="bg-[#151d2b] p-4 sm:p-5 rounded-xl border border-[#ffca36] shadow-xl relative">
              <div className="border-l-4 border-[#ffca36] pl-3.5 flex flex-col gap-1.5">
                <h3 className="text-[#ffc832] font-black text-sm sm:text-base tracking-wide leading-snug">
                  Why There Have Many Members &amp; An Agent Choose BCWIN CLUB?
                </h3>
                <p className="text-[#c2cbd8] text-xs sm:text-sm leading-relaxed mt-1">
                  The platform was launched in 2019 and has been running for more than 6 years. More than millions of people have chosen BCWIN CLUB. At the same time, the latest system is adopted to ensure member information security and service quality.
                </p>
              </div>
            </div>

            {/* FAQ 2 */}
            <div className="bg-[#151d2b] p-4 sm:p-5 rounded-xl border border-[#ffca36] shadow-xl relative">
              <div className="border-l-4 border-[#ffca36] pl-3.5 flex flex-col gap-1.5">
                <h3 className="text-[#ffc832] font-black text-sm sm:text-base tracking-wide leading-snug uppercase">
                  HOW TO REGISTER AS AN AGENT?
                </h3>
                <p className="text-[#c2cbd8] text-xs sm:text-sm leading-relaxed mt-1">
                  Select “Promotion” Select “Invitation Link” Copy the “Invitation Link” Use Invitation Links to Invite Friends to Join
                </p>
              </div>
            </div>
          </div>

          {/* 8. Provider Logos Footer Section */}
          <footer className="mt-4 pt-6 border-t border-[#232f45] flex flex-col items-center">
            <div className="w-full grid grid-cols-3 gap-y-6 gap-x-4 items-center justify-items-center opacity-75 hover:opacity-100 transition-opacity">
              {/* KoolBet */}
              <div className="flex flex-col items-center justify-center">
                <span className="font-black text-lg text-gray-300 tracking-tighter italic">KCOLBET</span>
                <span className="text-[8px] text-gray-400 tracking-widest uppercase">COMPETITION GAMES SOFT</span>
              </div>

              {/* JILI */}
              <div className="flex items-center justify-center">
                <span className="font-black text-2xl text-gray-200 tracking-widest font-serif border-b-2 border-gray-400 pb-0.5">JILI</span>
              </div>

              {/* Evolution */}
              <div className="flex items-center justify-center">
                <span className="font-bold text-base text-gray-300 tracking-tight flex items-center gap-1">
                  <span className="text-xs border border-gray-400 rounded px-1 font-mono">E</span> Evolution
                </span>
              </div>

              {/* PG SOFT */}
              <div className="flex items-center justify-center">
                <span className="font-black text-xl text-gray-300 tracking-wider">PG</span>
              </div>

              {/* JDB */}
              <div className="flex flex-col items-center justify-center">
                <span className="font-black text-xl text-gray-200 tracking-widest">JDB</span>
                <span className="text-[8px] text-gray-400 tracking-tight">JUST DO THE BEST</span>
              </div>

              {/* SPRIBE */}
              <div className="flex items-center justify-center">
                <span className="font-black text-lg text-gray-300 tracking-wider uppercase">SPRIBE</span>
              </div>

              {/* Playtech */}
              <div className="flex items-center justify-center">
                <span className="font-bold text-lg text-gray-300 lowercase tracking-tight">playtech</span>
              </div>

              {/* Microgaming */}
              <div className="flex items-center justify-center">
                <span className="font-medium text-xs text-gray-300 tracking-tighter uppercase">Microgaming</span>
              </div>

              {/* HABANERO */}
              <div className="flex items-center justify-center">
                <span className="font-bold text-xs text-gray-300 tracking-wider uppercase">HABANERO™</span>
              </div>
            </div>
          </footer>

        </main>
      </div>
    </div>
  );
}
