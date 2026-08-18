"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  IoDocumentTextOutline,
  IoNewspaperOutline,
  IoClose,
} from "react-icons/io5";
import PageHeader from "../ui/PageHeader";
import LoadingSpinner from "../ui/LoadingSpinner";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../context/AuthContext";
import * as api from "../../lib/api";
import type { ActivityTierProgress } from "../../lib/api";
import { formatINR } from "../../lib/format";
import { requireBankForCollect } from "../../lib/require-bank";
import { INVITATION_RULES_TABLE } from "./catalog";
import { useSpaBackClose } from "../../hooks/useSpaBackClose";

interface Props {
  onBack: () => void;
  onNavigate?: (screen: string) => void;
  initialSub?: "main" | "rules" | "record";
}

export default function InvitationBonusPage({
  onBack,
  onNavigate,
  initialSub = "main",
}: Props) {
  const { toast } = useToast();
  const { refreshUser } = useAuth();
  const [sub, setSub] = useState<"main" | "rules" | "record">(initialSub);
  useSpaBackClose(
    !onNavigate && sub !== "main",
    () => setSub("main"),
    "invitation-sub"
  );
  const goRules = () =>
    onNavigate?.("activity-invitation-rules") ?? setSub("rules");
  const goRecord = () =>
    onNavigate?.("activity-invitation-record") ?? setSub("record");
  const closeSub = () => {
    if (onNavigate) onBack();
    else setSub("main");
  };
  const [loading, setLoading] = useState(true);
  const [tiers, setTiers] = useState<ActivityTierProgress[]>([]);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [records, setRecords] = useState<
    { id: string; amount: number; status: string; createdAt?: string }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prog, hist] = await Promise.all([
        api.getActivityProgress(),
        api.getActivityHistory({ page: 1, limit: 50 }).catch(() => null),
      ]);
      setTiers(prog.data?.invitation ?? []);
      const inv = (hist?.data ?? []).filter((b) =>
        String(b.type ?? "")
          .toUpperCase()
          .includes("INVIT")
      );
      setRecords(
        inv.map((b) => ({
          id: b.id,
          amount: b.amount,
          status: b.status,
          createdAt: b.createdAt,
        }))
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const claim = async (bonusId: string) => {
    setClaiming(bonusId);
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
      await api.claimActivityBonus(bonusId);
      await refreshUser();
      toast("Invitation bonus claimed!", "success");
      await load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Claim failed", "error");
    } finally {
      setClaiming(null);
    }
  };

  const [invitees, setInvitees] = useState<api.TeamMember[]>([]);
  const [inviteesLoading, setInviteesLoading] = useState(false);

  const fetchInvitees = useCallback(async () => {
    setInviteesLoading(true);
    try {
      const res = await api.getTeamMembers({ page: 1, limit: 100 });
      if (res.success && Array.isArray(res.data)) {
        setInvitees(res.data);
      }
    } catch {
      setInvitees([]);
    } finally {
      setInviteesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sub === "record") {
      void fetchInvitees();
    }
  }, [sub, fetchInvitees]);

  if (sub === "rules") {
    // Same values as claim UI / backend FALLBACK_INVITATION_TIERS (or live API tiers)
    const rulesRows =
      tiers.length > 0
        ? tiers.map((t, i) => {
            const req = (t.requirement ?? {}) as Record<
              string,
              number | undefined
            >;
            return {
              people: Number(
                req.invites ??
                  req.inviteCount ??
                  req.people ??
                  INVITATION_RULES_TABLE[i]?.people ??
                  0
              ),
              deposit: Number(
                req.minDepositPerInvite ??
                  req.deposit ??
                  req.recharge ??
                  INVITATION_RULES_TABLE[i]?.deposit ??
                  0
              ),
              bonus: Number(t.reward ?? INVITATION_RULES_TABLE[i]?.bonus ?? 0),
            };
          })
        : INVITATION_RULES_TABLE;

    return (
      <div className="flex-1 flex flex-col min-h-screen pb-24" style={{ background: "#110D14" }}>
        <PageHeader title="Invitation reward rules" onBack={closeSub} />
        <div className="px-3 pb-8">
          <p className="text-[13px] text-white/80 font-semibold mb-1">
            Invite friends and recharge to get additional platform rewards!
          </p>
          <p className="text-[11px] text-white/45 mb-4 leading-relaxed">
            Only your <b className="text-white/70">level-1</b> invites count.
            Each invitee must register with your code and make a total SUCCESS
            deposit of at least the amount in the table. Claim credits your
            wallet balance immediately.
          </p>

          <div className="rounded-[12px] overflow-hidden border border-white/10">
            <div
              className="grid grid-cols-3 text-[11px] font-bold text-[#110D14] py-2.5 px-2"
              style={{ background: "linear-gradient(90deg,#C8922A,#E8A84A)" }}
            >
              <span className="text-center">Invite account</span>
              <span className="text-center">Deposit amount</span>
              <span className="text-center">Bonus</span>
            </div>
            {rulesRows.map((r, i) => (
              <div
                key={`${r.people}-${r.deposit}-${i}`}
                className="grid grid-cols-3 py-2.5 px-2 text-[11px] text-[#FDE4BC]/90"
                style={{
                  background: i % 2 === 0 ? "#1a1519" : "#221c20",
                  borderTop: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                <span className="text-center">{r.people} People</span>
                <span className="text-center tabular-nums">
                  {formatINR(r.deposit)}
                </span>
                <span className="text-center tabular-nums text-[#FED358] font-bold">
                  {formatINR(r.bonus)}
                </span>
              </div>
            ))}
          </div>

          <div
            className="w-full h-11 mt-5 rounded-full text-[14px] font-black text-[#110D14] flex items-center justify-center"
            style={{ background: "linear-gradient(180deg,#FED358,#E8A84A)" }}
          >
            Rules
          </div>
          <ul className="mt-4 space-y-2 text-[11px] text-white/50 leading-relaxed list-disc pl-4">
            <li>
              Only <b className="text-white/65">direct (L1)</b> invites count —
              friends who registered with your invitation code.
            </li>
            <li>
              For each tier you need the listed number of invitees, and each of
              those invitees must have total SUCCESS recharge ≥ the deposit
              amount (per person).
            </li>
            <li>
              Higher tiers stack: meeting a higher tier still requires meeting
              that tier&apos;s invite count and per-person deposit.
            </li>
            <li>
              When a tier is finished, tap Claim. The bonus is credited to your
              wallet balance immediately (after bank details are bound).
            </li>
            <li>
              Unclaimed invitation bonuses expire after 7 days once created.
            </li>
          </ul>
        </div>
      </div>
    );
  }

  if (sub === "record") {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-[#110D14] text-[#FDE4BC]">
        <PageHeader title="Invitation record" onBack={closeSub} />
        <div className="flex-1 px-3.5 pt-3 pb-8">
          {inviteesLoading ? (
            <div className="py-20 text-center text-[#837064] text-xs">
              Loading…
            </div>
          ) : invitees.length === 0 ? (
            <div className="pt-12 pb-16 flex flex-col items-center justify-center">
              <p className="text-[#837064] text-xs">No data</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {invitees.map((m) => {
                const usernameDisplay = m.username || "—";
                const uidDisplay =
                  m.serialNumber != null
                    ? m.serialNumber
                    : m.id.substring(0, 8);
                const regTimeDisplay = m.createdAt
                  ? (() => {
                      const d = new Date(m.createdAt);
                      if (Number.isNaN(d.getTime())) return "—";
                      const YYYY = d.getFullYear();
                      const MM = String(d.getMonth() + 1).padStart(2, "0");
                      const DD = String(d.getDate()).padStart(2, "0");
                      const hh = String(d.getHours()).padStart(2, "0");
                      const mm = String(d.getMinutes()).padStart(2, "0");
                      const ss = String(d.getSeconds()).padStart(2, "0");
                      return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
                    })()
                  : "—";

                return (
                  <div
                    key={m.id}
                    className="bg-[#241E22] border border-[#3D363A]/60 rounded-xl p-3.5 shadow-md flex flex-col gap-2.5"
                  >
                    {/* Top Row: Username & UID */}
                    <div className="flex justify-between items-center text-xs pb-1 border-b border-[#3D363A]/30">
                      <span className="font-semibold text-[#FDE4BC]">
                        {usernameDisplay}
                      </span>
                      <span className="text-[#837064] font-mono">
                        UID:{uidDisplay}
                      </span>
                    </div>

                    {/* Row 1: Registration time */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#837064]">Registration time</span>
                      <span className="text-[#837064] font-mono">
                        {regTimeDisplay}
                      </span>
                    </div>

                    {/* Row 2: Deposit amount */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#837064]">Deposit amount</span>
                      <span className="font-bold text-[#FED358]">
                        {formatINR(m.totalDeposit ?? 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-screen pb-24" style={{ background: "#110D14" }}>
      <PageHeader title="Invitation bonus" onBack={onBack} />

      {/* Hero */}
      <div
        className="mx-3 rounded-[14px] p-4 relative overflow-hidden"
        style={{
          background: "linear-gradient(120deg,#FF9A3C 0%,#FF6B2C 50%,#E84A2A 100%)",
        }}
      >
        <div className="relative z-[1] max-w-[62%]">
          <h2 className="text-[17px] font-black text-white leading-tight">
            Invite friends and deposit
          </h2>
          <p className="text-[11px] text-white/90 mt-1.5 leading-snug">
            Both parties can receive rewards. Invite friends to register and
            recharge to receive rewards.
          </p>
          <p className="text-[10px] text-white/70 mt-3">activity date</p>
          <p className="text-[13px] font-bold text-white tabular-nums">
            2025-04-09 - 2055-03-31
          </p>
        </div>
        <div className="absolute right-3 top-4 text-[56px] opacity-90">🎁</div>
      </div>

      {/* Shortcut tiles */}
      <div className="mx-3 mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={goRules}
          className="rounded-[14px] py-4 flex flex-col items-center gap-2 active:scale-[0.98]"
          style={{ background: "#241E22", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(145deg,#5B9CFF,#3B82F6)" }}
          >
            <IoDocumentTextOutline size={26} className="text-white" />
          </div>
          <span className="text-[11px] text-white/70 font-medium text-center px-2">
            Invitation reward rules
          </span>
        </button>
        <button
          type="button"
          onClick={goRecord}
          className="rounded-[14px] py-4 flex flex-col items-center gap-2 active:scale-[0.98]"
          style={{ background: "#241E22", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(145deg,#4ADE80,#16A34A)" }}
          >
            <IoNewspaperOutline size={26} className="text-white" />
          </div>
          <span className="text-[11px] text-white/70 font-medium text-center px-2">
            Invitation record
          </span>
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="px-3 mt-4 space-y-3 pb-8">
          {(tiers.length > 0 ? tiers : INVITATION_RULES_TABLE.map((r, i) => ({
            tier: i,
            reward: r.bonus,
            requirement: { invites: r.people, deposit: r.deposit },
            current: { invites: 0, deposit: 0 },
            completed: false,
            claimed: false,
          }))).map((t, idx) => {
            // API shapes vary — read via index map to keep tsc happy in production builds
            const req = (t.requirement ?? {}) as Record<string, number | undefined>;
            const cur = (t.current ?? {}) as Record<string, number | undefined>;
            const needPeople =
              Number(
                req.invites ??
                  req.inviteCount ??
                  req.people ??
                  INVITATION_RULES_TABLE[idx]?.people ??
                  0
              ) || 0;
            const needDeposit =
              Number(
                req.minDepositPerInvite ??
                  req.deposit ??
                  req.recharge ??
                  INVITATION_RULES_TABLE[idx]?.deposit ??
                  0
              ) || 0;
            const havePeople = Number(
              cur.qualifyingInvites ??
                cur.invites ??
                cur.inviteCount ??
                cur.people ??
                0
            );
            // Deposit number in design = count of invitees who met recharge (same as qualifying)
            const haveDeposit = havePeople;
            const reward = t.reward ?? INVITATION_RULES_TABLE[idx]?.bonus ?? 0;
            const done = !!t.completed;
            const claimed = !!t.claimed;
            const bonusId = (t as { bonusId?: string | null }).bonusId;

            return (
              <div
                key={t.tier ?? idx}
                className="rounded-[14px] overflow-hidden"
                style={{
                  background: "#1a1519",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center justify-between px-3 pt-3">
                  <div
                    className="flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1"
                    style={{ background: "#17B15E" }}
                  >
                    <span className="text-[11px] font-bold text-white">
                      Bonus
                    </span>
                    <span className="w-5 h-5 rounded-full bg-white/20 text-[10px] font-black text-white flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <IoClose size={14} className="text-white/80" />
                  </div>
                  <span className="text-[15px] font-black text-[#FED358] tabular-nums">
                    {formatINR(reward)}
                  </span>
                </div>

                <div className="mx-3 mt-3 rounded-lg overflow-hidden text-[11px]">
                  <div
                    className="flex justify-between px-3 py-2"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                  >
                    <span className="text-white/55">Number of invitees</span>
                    <span className="text-white font-bold">{needPeople}</span>
                  </div>
                  <div
                    className="flex justify-between px-3 py-2"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <span className="text-white/55">Recharge per people</span>
                    <span className="text-[#DA3735] font-bold">
                      {formatINR(needDeposit)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mx-3 mt-3 mb-3">
                  <div className="text-center">
                    <p className="text-[13px] font-bold text-white tabular-nums">
                      <span className="text-[#DA3735]">{havePeople}</span>
                      <span className="text-white/40"> / {needPeople}</span>
                    </p>
                    <p className="text-[10px] text-white/40">Number of invitees</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-bold text-white tabular-nums">
                      <span className="text-[#DA3735]">
                        {haveDeposit > 0 ? Math.min(haveDeposit, needPeople) : 0}
                      </span>
                      <span className="text-white/40"> / {needPeople}</span>
                    </p>
                    <p className="text-[10px] text-white/40">Deposit number</p>
                  </div>
                </div>

                {done && !claimed && bonusId ? (
                  <button
                    type="button"
                    disabled={claiming === bonusId}
                    onClick={() => void claim(bonusId)}
                    className="mx-3 mb-3 w-[calc(100%-24px)] h-10 rounded-full text-[13px] font-black text-[#110D14]"
                    style={{ background: "linear-gradient(180deg,#FED358,#E8A84A)" }}
                  >
                    {claiming === bonusId ? "…" : "Claim"}
                  </button>
                ) : (
                  <div
                    className="mx-3 mb-3 h-10 rounded-full flex items-center justify-center text-[13px] font-bold text-white/50"
                    style={{ background: "rgba(255,255,255,0.08)" }}
                  >
                    {claimed ? "Claimed" : "Unfinished"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
