"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { LoadingBlock, PageTitle, RefreshBtn, Surface } from "../../components/ui";

export default function ConfigPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<Record<string, unknown>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await admin.getConfig();
      setCfg((res.config as Record<string, unknown>) ?? {});
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const fee = Number(cfg.serviceFeePercent ?? 0);
    if (!Number.isFinite(fee) || fee < 0) {
      toast("Service fee cannot be negative", "error");
      return;
    }
    if (fee > 100) {
      toast("Service fee cannot exceed 100%", "error");
      return;
    }

    const inrBonus = Number(cfg.inrDepositBonusPercent ?? 0);
    const usdtBonus = Number(cfg.usdtDepositBonusPercent ?? 5);
    if (!Number.isFinite(inrBonus) || inrBonus < 0 || inrBonus > 100) {
      toast("INR recharge bonus % must be 0–100", "error");
      return;
    }
    if (!Number.isFinite(usdtBonus) || usdtBonus < 0 || usdtBonus > 100) {
      toast("USDT recharge bonus % must be 0–100", "error");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        cxpayEnabled: !!cfg.cxpayEnabled,
        xdpayEnabled: !!cfg.xdpayEnabled,
        oxapayEnabled: !!cfg.oxapayEnabled,
        upiEnabled: !!cfg.upiEnabled,
        serviceFeePercent: fee,
        minDepositAmount: Number(cfg.minDepositAmount ?? 0),
        minWithdrawAmount: Number(cfg.minWithdrawAmount ?? 0),
        wager: Number(cfg.wager ?? 0),
        rewardWagerFactor: Number(cfg.rewardWagerFactor ?? 1.0),
        illegalBetPenaltyFactor: Number(cfg.illegalBetPenaltyFactor ?? 3),
        announcement: cfg.announcement ?? null,
        wingoAlgorithm: cfg.wingoAlgorithm ?? "RANDOM",
        inrToUsdtPaymentConversionRate: Number(cfg.inrToUsdtPaymentConversionRate ?? 105),
        inrToUsdtWithdrawalConversionRate: Number(cfg.inrToUsdtWithdrawalConversionRate ?? 100),
        inrDepositBonusPercent: inrBonus,
        usdtDepositBonusPercent: usdtBonus,
      };
      if (Array.isArray(cfg.upiIds)) body.upiIds = cfg.upiIds;
      else if (typeof cfg.upiIds === "string") {
        body.upiIds = String(cfg.upiIds)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const res = await admin.updateConfig(body);
      toast(res.message || "Config saved", "success");
      if (res.config) setCfg(res.config as Record<string, unknown>);
      else load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBlock />;

  const set = (k: string, v: unknown) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <div>
      <PageTitle
        title="Platform config"
        subtitle="Payment gates, fees, algorithms"
        action={<RefreshBtn onClick={load} />}
      />
      <Surface className="max-w-2xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={!!cfg.cxpayEnabled}
              onChange={(e) => set("cxpayEnabled", e.target.checked)}
            />
            CXPAY enabled
            <span className="text-[11px] font-normal text-slate-400">
              (UPI / QR deposits)
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={!!cfg.xdpayEnabled}
              onChange={(e) => set("xdpayEnabled", e.target.checked)}
            />
            XDPAY enabled
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={!!cfg.oxapayEnabled}
              onChange={(e) => set("oxapayEnabled", e.target.checked)}
            />
            OXAPAY enabled
            <span className="text-[11px] font-normal text-slate-400">
              (USDT)
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={!!cfg.upiEnabled}
              onChange={(e) => set("upiEnabled", e.target.checked)}
            />
            UPI manual enabled
          </label>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Service fee % (0–100, not negative)
          </label>
          <input
            className="admin-input"
            type="number"
            step="0.01"
            min={0}
            max={100}
            value={String(cfg.serviceFeePercent ?? "")}
            onChange={(e) => set("serviceFeePercent", e.target.value)}
          />
        </div>
        {(
          [
            ["minDepositAmount", "Min deposit"],
            ["minWithdrawAmount", "Min withdraw"],
            ["wager", "Wager factor (standard deposit)"],
            ["rewardWagerFactor", "Reward Wager Factor (default 1.0x)"],
            ["illegalBetPenaltyFactor", "Illegal Bet Penalty Wager Factor (default 3x)"],
          ] as const
        ).map(([k, label]) => (
          <div key={k}>
            <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
            <input
              className="admin-input"
              type="number"
              step="any"
              value={String(cfg[k] ?? "")}
              onChange={(e) => set(k, e.target.value)}
            />
          </div>
        ))}

        <div className="border-t border-slate-200 pt-4">
          <h3 className="mb-1 text-sm font-bold text-slate-700">Recharge bonuses</h3>
          <p className="mb-3 text-[11px] text-slate-500">
            Extra INR credited on SUCCESS as a % of principal (not part of deposit amount).
            Formula: floor(principal × % / 100). Set 0 to disable.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                INR recharge bonus % (0 = off)
              </label>
              <input
                className="admin-input"
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={String(cfg.inrDepositBonusPercent ?? 0)}
                onChange={(e) => set("inrDepositBonusPercent", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                USDT recharge bonus % (default 5)
              </label>
              <input
                className="admin-input"
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={String(cfg.usdtDepositBonusPercent ?? 5)}
                onChange={(e) => set("usdtDepositBonusPercent", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── INR ↔ USDT Conversion Rates ── */}
        <div className="border-t border-slate-200 pt-4">
          <h3 className="mb-3 text-sm font-bold text-slate-700">INR ↔ USDT Conversion Rates</h3>
          <p className="mb-3 text-[11px] text-slate-500">
            These rates are used by OXAPAY to convert between INR wallet amounts and USDT crypto payments.
            <br />
            <strong>Payment rate:</strong> 1 USDT = X INR (for deposits). &nbsp;
            <strong>Withdrawal rate:</strong> 1 USDT = X INR (for withdrawals).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Deposit rate (1 USDT = ? INR)
              </label>
              <input
                className="admin-input"
                type="number"
                step="0.01"
                min="0"
                value={String(cfg.inrToUsdtPaymentConversionRate ?? "")}
                onChange={(e) => set("inrToUsdtPaymentConversionRate", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Withdrawal rate (1 USDT = ? INR)
              </label>
              <input
                className="admin-input"
                type="number"
                step="0.01"
                min="0"
                value={String(cfg.inrToUsdtWithdrawalConversionRate ?? "")}
                onChange={(e) => set("inrToUsdtWithdrawalConversionRate", e.target.value)}
              />
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            UPI IDs (comma separated)
          </label>
          <input
            className="admin-input"
            value={
              Array.isArray(cfg.upiIds)
                ? (cfg.upiIds as string[]).join(", ")
                : String(cfg.upiIds ?? "")
            }
            onChange={(e) => set("upiIds", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Announcement</label>
          <textarea
            className="admin-input h-24 py-2"
            value={String(cfg.announcement ?? "")}
            onChange={(e) => set("announcement", e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Wingo result mode
          </label>
          <select
            className="admin-input"
            value={String(cfg.wingoAlgorithm ?? "RANDOM")}
            onChange={(e) => set("wingoAlgorithm", e.target.value)}
          >
            <option value="RANDOM">RANDOM — pure random 0–9</option>
            <option value="WINNING">WINNING — house edge (lowest liability)</option>
            <option value="TRX">TRX — last digit of Tron block hash</option>
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            Admin manual set (Game Managers) always overrides this for that period.
          </p>
        </div>
        <button type="button" disabled={saving} onClick={save} className="admin-btn-primary">
          {saving ? "Saving…" : "Save configuration"}
        </button>
      </Surface>
    </div>
  );
}
