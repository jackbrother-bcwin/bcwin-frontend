"use client";

/**
 * Admin VIP rules — aligned with backend-docs:
 * GET/POST /admin/vip-rules · PATCH/DELETE /admin/vip-rules/:id
 *
 * Primary fields: level, expRequired, levelUpReward, monthlyReward, rebateRate
 * Optional: vipName, minBet, oneTimeBonus, monthlyBonus, rebatePercentage
 * Legacy: teamSize, teamBetting, teamDeposit
 */

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../lib/admin-api";
import type { AdminVipRule, AdminVipRuleInput } from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import {
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  RefreshBtn,
  Surface,
} from "../../components/ui";
import { AdminBarChart } from "../../components/Charts";
import BulkBar from "../../components/BulkBar";

type FormState = {
  level: string;
  vipName: string;
  expRequired: string;
  levelUpReward: string;
  monthlyReward: string;
  rebateRate: string;
  rebatePercentage: string;
  minBet: string;
  oneTimeBonus: string;
  monthlyBonus: string;
  teamSize: string;
  teamBetting: string;
  teamDeposit: string;
};

const emptyForm = (): FormState => ({
  level: "1",
  vipName: "",
  expRequired: "0",
  levelUpReward: "0",
  monthlyReward: "0",
  rebateRate: "",
  rebatePercentage: "",
  minBet: "",
  oneTimeBonus: "",
  monthlyBonus: "",
  teamSize: "0",
  teamBetting: "0",
  teamDeposit: "0",
});

function ruleToForm(r: AdminVipRule): FormState {
  return {
    level: String(r.level ?? 0),
    vipName: r.vipName ?? "",
    expRequired: String(r.expRequired ?? 0),
    levelUpReward: String(r.levelUpReward ?? 0),
    monthlyReward: String(r.monthlyReward ?? 0),
    rebateRate: r.rebateRate ?? "",
    rebatePercentage:
      r.rebatePercentage != null ? String(r.rebatePercentage) : "",
    minBet: r.minBet != null ? String(r.minBet) : "",
    oneTimeBonus: r.oneTimeBonus != null ? String(r.oneTimeBonus) : "",
    monthlyBonus: r.monthlyBonus != null ? String(r.monthlyBonus) : "",
    teamSize: String(r.teamSize ?? 0),
    teamBetting: String(r.teamBetting ?? 0),
    teamDeposit: String(r.teamDeposit ?? 0),
  };
}

/** Build POST/PATCH body — only send meaningful values */
function formToBody(form: FormState): AdminVipRuleInput {
  const num = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };
  const optNum = (s: string): number | undefined => {
    if (s.trim() === "") return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };

  const body: AdminVipRuleInput = {
    level: num(form.level),
    expRequired: num(form.expRequired),
    levelUpReward: num(form.levelUpReward),
    monthlyReward: num(form.monthlyReward),
    teamSize: num(form.teamSize),
    teamBetting: num(form.teamBetting),
    teamDeposit: num(form.teamDeposit),
  };

  if (form.vipName.trim()) body.vipName = form.vipName.trim();
  if (form.rebateRate.trim()) body.rebateRate = form.rebateRate.trim();
  else body.rebateRate = null;

  const rebatePct = optNum(form.rebatePercentage);
  if (rebatePct !== undefined) body.rebatePercentage = rebatePct;

  const minBet = optNum(form.minBet);
  if (minBet !== undefined) body.minBet = minBet;

  const oneTime = optNum(form.oneTimeBonus);
  if (oneTime !== undefined) body.oneTimeBonus = oneTime;

  const monthlyBonus = optNum(form.monthlyBonus);
  if (monthlyBonus !== undefined) body.monthlyBonus = monthlyBonus;

  return body;
}

const FIELD_META: {
  key: keyof FormState;
  label: string;
  hint?: string;
  wide?: boolean;
  group: "core" | "rewards" | "legacy";
}[] = [
  { key: "level", label: "Level (0–10)", hint: "Required · unique", group: "core" },
  { key: "vipName", label: "VIP name", hint: 'e.g. "VIP 1"', wide: true, group: "core" },
  {
    key: "expRequired",
    label: "EXP required",
    hint: "Cumulative XP to reach this level",
    group: "core",
  },
  {
    key: "levelUpReward",
    label: "Level-up reward",
    hint: "One-time claim amount",
    group: "rewards",
  },
  {
    key: "monthlyReward",
    label: "Monthly reward",
    hint: "Monthly claim amount",
    group: "rewards",
  },
  {
    key: "rebateRate",
    label: "Rebate rate (display)",
    hint: 'String e.g. "0.3%"',
    group: "rewards",
  },
  {
    key: "rebatePercentage",
    label: "Rebate % (numeric)",
    hint: "0–100 numeric",
    group: "rewards",
  },
  { key: "minBet", label: "Min bet", hint: "Optional", group: "rewards" },
  {
    key: "oneTimeBonus",
    label: "One-time bonus",
    hint: "Optional legacy alias",
    group: "rewards",
  },
  {
    key: "monthlyBonus",
    label: "Monthly bonus",
    hint: "Optional legacy alias",
    group: "rewards",
  },
  { key: "teamSize", label: "Team size", hint: "Legacy", group: "legacy" },
  {
    key: "teamBetting",
    label: "Team betting",
    hint: "Legacy",
    group: "legacy",
  },
  {
    key: "teamDeposit",
    label: "Team deposit",
    hint: "Legacy",
    group: "legacy",
  },
];

export default function VipRulesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminVipRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await admin.listVipRules();
      const list = r.rules ?? [];
      setRows(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load VIP rules", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const level = Number(form.level);
    if (!Number.isFinite(level) || level < 0 || level > 10) {
      toast("Level must be 0–10", "error");
      return;
    }

    setBusy(true);
    const body = formToBody(form);
    try {
      if (editId) {
        await admin.updateVipRule(editId, body);
        toast("VIP rule updated", "success");
      } else {
        await admin.createVipRule(body);
        toast("VIP rule created", "success");
      }
      setForm(emptyForm());
      setEditId(null);
      await load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = async () => {
    if (!selected.size || !confirm(`Delete ${selected.size} VIP rules?`)) return;
    setBusy(true);
    try {
      await Promise.all([...selected].map((id) => admin.deleteVipRule(id)));
      toast(`Deleted ${selected.size} rules`, "success");
      setSelected(new Set());
      await load();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Bulk delete failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const chartData = rows
    .slice()
    .sort((a, b) => a.level - b.level)
    .map((r) => ({
      name: `V${r.level}`,
      expRequired: Number(r.expRequired ?? 0),
      levelUpReward: Number(r.levelUpReward ?? 0),
      monthlyReward: Number(r.monthlyReward ?? 0),
    }));

  const setField = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const renderFields = (group: "core" | "rewards" | "legacy") =>
    FIELD_META.filter((f) => f.group === group).map((f) => (
      <div key={f.key} className={f.wide ? "col-span-2" : ""}>
        <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {f.label}
        </label>
        <input
          className="admin-input"
          value={form[f.key]}
          onChange={(e) => setField(f.key, e.target.value)}
          placeholder={f.hint}
          inputMode={
            f.key === "vipName" || f.key === "rebateRate" ? "text" : "decimal"
          }
        />
        {f.hint && (
          <p className="mt-0.5 text-[10px] text-slate-400">{f.hint}</p>
        )}
      </div>
    ));

  return (
    <div>
      <PageTitle
        title="VIP rules"
        subtitle="EXP · rewards · rebate · CRUD /admin/vip-rules"
        action={<RefreshBtn onClick={() => void load()} />}
      />
      <BulkBar
        count={selected.size}
        onClear={() => setSelected(new Set())}
        actions={[
          {
            label: "Delete selected",
            onClick: () => void bulkDelete(),
            variant: "danger",
            icon: "trash",
            disabled: busy,
          },
        ]}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <AdminBarChart
          data={chartData}
          xKey="name"
          yKey="expRequired"
          yKey2="levelUpReward"
          title="EXP required & level-up reward by VIP"
        />

        <Surface title={editId ? "Edit VIP rule" : "Create VIP rule"}>
          <form onSubmit={(e) => void submit(e)} className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Core
            </p>
            <div className="grid grid-cols-2 gap-2">{renderFields("core")}</div>

            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Rewards & rebate
            </p>
            <div className="grid grid-cols-2 gap-2">
              {renderFields("rewards")}
            </div>

            <button
              type="button"
              className="text-[11px] font-bold text-blue-600 hover:underline"
              onClick={() => setShowLegacy((v) => !v)}
            >
              {showLegacy ? "Hide" : "Show"} legacy team fields
            </button>
            {showLegacy && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-dashed border-slate-200 p-2">
                {renderFields("legacy")}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="admin-btn-primary"
              >
                {editId ? "Update" : "Create"}
              </button>
              {editId && (
                <button
                  type="button"
                  className="admin-btn-ghost"
                  onClick={() => {
                    setEditId(null);
                    setForm(emptyForm());
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Surface>
      </div>

      <Surface title="Rules table">
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyBlock />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={
                        selected.size === rows.length && rows.length > 0
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? new Set(rows.map((r) => r.id))
                            : new Set()
                        )
                      }
                    />
                  </th>
                  <th>Level</th>
                  <th>Name</th>
                  <th>EXP req</th>
                  <th>Level-up ₹</th>
                  <th>Monthly ₹</th>
                  <th>Rebate</th>
                  <th>Rebate %</th>
                  <th>Min bet</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice()
                  .sort((a, b) => a.level - b.level)
                  .map((r) => {
                    const id = r.id;
                    return (
                      <tr key={id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.has(id)}
                            onChange={(e) => {
                              const n = new Set(selected);
                              e.target.checked ? n.add(id) : n.delete(id);
                              setSelected(n);
                            }}
                          />
                        </td>
                        <td className="font-bold">{r.level}</td>
                        <td>{r.vipName ?? "—"}</td>
                        <td className="tabular-nums">
                          {Number(r.expRequired ?? 0).toLocaleString()}
                        </td>
                        <td className="tabular-nums">
                          {Number(r.levelUpReward ?? 0).toLocaleString()}
                        </td>
                        <td className="tabular-nums">
                          {Number(r.monthlyReward ?? 0).toLocaleString()}
                        </td>
                        <td>{r.rebateRate ?? "—"}</td>
                        <td className="tabular-nums">
                          {r.rebatePercentage != null
                            ? r.rebatePercentage
                            : "—"}
                        </td>
                        <td className="tabular-nums">
                          {r.minBet != null
                            ? Number(r.minBet).toLocaleString()
                            : "—"}
                        </td>
                        <td className="space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            className="text-xs font-bold text-blue-600"
                            onClick={() => {
                              setEditId(id);
                              setForm(ruleToForm(r));
                              setShowLegacy(
                                !!(
                                  r.teamSize ||
                                  r.teamBetting ||
                                  r.teamDeposit
                                )
                              );
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs font-bold text-red-600"
                            onClick={async () => {
                              if (!confirm(`Delete VIP ${r.level}?`)) return;
                              try {
                                await admin.deleteVipRule(id);
                                toast("Deleted", "success");
                                await load();
                              } catch (err: unknown) {
                                toast(
                                  err instanceof Error
                                    ? err.message
                                    : "Delete failed",
                                  "error"
                                );
                              }
                            }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
