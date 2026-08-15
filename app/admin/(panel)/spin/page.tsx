"use client";

import React, { useCallback, useEffect, useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import {
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  RefreshBtn,
  Surface,
} from "../../components/ui";
import { AdminPieChart } from "../../components/Charts";
import BulkBar from "../../components/BulkBar";

export default function SpinAdminPage() {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<Array<Record<string, unknown>>>([]);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [rewardForm, setRewardForm] = useState({
    amount: "10",
    probability: "10",
    isActive: true,
  });
  const [ruleForm, setRuleForm] = useState({
    minDeposit: "500",
    spinChances: "1",
    isActive: true,
  });
  const [editRewardId, setEditRewardId] = useState<string | null>(null);
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  const [selR, setSelR] = useState<Set<string>>(new Set());
  const [selU, setSelU] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rw, ru] = await Promise.all([
        admin.listLuckySpinRewards(),
        admin.listLuckySpinRules(),
      ]);
      setRewards(Array.isArray(rw.data) ? (rw.data as Array<Record<string, unknown>>) : []);
      setRules(Array.isArray(ru.data) ? (ru.data as Array<Record<string, unknown>>) : []);
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const pie = rewards.map((r) => ({
    name: `₹${r.amount}`,
    value: Number(r.probability ?? 0),
  }));

  const saveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        amount: Number(rewardForm.amount),
        probability: Number(rewardForm.probability),
        isActive: rewardForm.isActive,
      };
      if (editRewardId) {
        await admin.updateLuckySpinReward(editRewardId, body);
        toast("Reward updated", "success");
      } else {
        await admin.createLuckySpinReward(body);
        toast("Reward created", "success");
      }
      setEditRewardId(null);
      setRewardForm({ amount: "10", probability: "10", isActive: true });
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const saveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        minDeposit: Number(ruleForm.minDeposit),
        spinChances: Number(ruleForm.spinChances),
        isActive: ruleForm.isActive,
      };
      if (editRuleId) {
        await admin.updateLuckySpinRule(editRuleId, body);
        toast("Rule updated", "success");
      } else {
        await admin.createLuckySpinRule(body);
        toast("Rule created", "success");
      }
      setEditRuleId(null);
      setRuleForm({ minDeposit: "500", spinChances: "1", isActive: true });
      load();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle
        title="Lucky spin"
        subtitle="Rewards weights + deposit rules · full CRUD"
        action={<RefreshBtn onClick={load} />}
      />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <AdminPieChart data={pie} title="Reward probability weights" />
        <Surface title={editRewardId ? "Edit reward" : "Add reward"}>
          {editRewardId && (
            <button
              type="button"
              className="mb-2 text-xs font-bold text-blue-600 underline"
              onClick={() => {
                setEditRewardId(null);
                setRewardForm({ amount: "10", probability: "10", isActive: true });
              }}
            >
              Cancel edit
            </button>
          )}
          <form className="space-y-2" onSubmit={saveReward}>
            <input
              className="admin-input"
              placeholder="Amount"
              value={rewardForm.amount}
              onChange={(e) => setRewardForm((f) => ({ ...f, amount: e.target.value }))}
            />
            <input
              className="admin-input"
              placeholder="Probability weight"
              value={rewardForm.probability}
              onChange={(e) => setRewardForm((f) => ({ ...f, probability: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rewardForm.isActive}
                onChange={(e) => setRewardForm((f) => ({ ...f, isActive: e.target.checked }))}
              />{" "}
              Active
            </label>
            <button type="submit" disabled={busy} className="admin-btn-primary">
              {busy ? "…" : editRewardId ? "Update reward" : "Create reward"}
            </button>
          </form>
        </Surface>
      </div>

      <BulkBar
        count={selR.size}
        onClear={() => setSelR(new Set())}
        actions={[
          {
            label: "Delete rewards",
            variant: "danger",
            icon: "trash",
            onClick: async () => {
              if (!confirm(`Delete ${selR.size} rewards?`)) return;
              await Promise.all([...selR].map((id) => admin.deleteLuckySpinReward(id)));
              toast("Deleted", "success");
              setSelR(new Set());
              load();
            },
          },
        ]}
      />

      <Surface title="Rewards" className="mb-4">
        {loading ? (
          <LoadingBlock />
        ) : rewards.length === 0 ? (
          <EmptyBlock />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th />
                <th>Amount</th>
                <th>Weight</th>
                <th>Active</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rewards.map((r) => {
                const id = String(r.id);
                return (
                  <tr key={id} className={editRewardId === id ? "bg-blue-50" : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selR.has(id)}
                        onChange={(e) => {
                          const n = new Set(selR);
                          e.target.checked ? n.add(id) : n.delete(id);
                          setSelR(n);
                        }}
                      />
                    </td>
                    <td className="font-bold">₹{Number(r.amount)}</td>
                    <td>{Number(r.probability)}</td>
                    <td>{r.isActive ? "Yes" : "No"}</td>
                    <td className="space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-xs font-bold text-blue-600"
                        onClick={() => {
                          setEditRewardId(id);
                          setRewardForm({
                            amount: String(r.amount ?? ""),
                            probability: String(r.probability ?? ""),
                            isActive: Boolean(r.isActive),
                          });
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs font-bold text-slate-600"
                        onClick={async () => {
                          await admin.updateLuckySpinReward(id, { isActive: !r.isActive });
                          toast("Toggled", "success");
                          load();
                        }}
                      >
                        Toggle
                      </button>
                      <button
                        type="button"
                        className="text-xs font-bold text-red-600"
                        onClick={async () => {
                          if (!confirm("Delete?")) return;
                          await admin.deleteLuckySpinReward(id);
                          load();
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
        )}
      </Surface>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface title={editRuleId ? "Edit deposit→spins rule" : "Add deposit→spins rule"}>
          {editRuleId && (
            <button
              type="button"
              className="mb-2 text-xs font-bold text-blue-600 underline"
              onClick={() => {
                setEditRuleId(null);
                setRuleForm({ minDeposit: "500", spinChances: "1", isActive: true });
              }}
            >
              Cancel edit
            </button>
          )}
          <form className="space-y-2" onSubmit={saveRule}>
            <input
              className="admin-input"
              placeholder="Min deposit"
              value={ruleForm.minDeposit}
              onChange={(e) => setRuleForm((f) => ({ ...f, minDeposit: e.target.value }))}
            />
            <input
              className="admin-input"
              placeholder="Spin chances"
              value={ruleForm.spinChances}
              onChange={(e) => setRuleForm((f) => ({ ...f, spinChances: e.target.value }))}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ruleForm.isActive}
                onChange={(e) => setRuleForm((f) => ({ ...f, isActive: e.target.checked }))}
              />{" "}
              Active
            </label>
            <button type="submit" disabled={busy} className="admin-btn-primary">
              {busy ? "…" : editRuleId ? "Update rule" : "Create rule"}
            </button>
          </form>
        </Surface>
        <Surface title="Spin rules">
          <BulkBar
            count={selU.size}
            onClear={() => setSelU(new Set())}
            actions={[
              {
                label: "Delete rules",
                variant: "danger",
                icon: "trash",
                onClick: async () => {
                  await Promise.all([...selU].map((id) => admin.deleteLuckySpinRule(id)));
                  toast("Deleted", "success");
                  setSelU(new Set());
                  load();
                },
              },
            ]}
          />
          {rules.length === 0 ? (
            <EmptyBlock />
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th />
                  <th>Min deposit</th>
                  <th>Spins</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => {
                  const id = String(r.id);
                  return (
                    <tr key={id} className={editRuleId === id ? "bg-blue-50" : undefined}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selU.has(id)}
                          onChange={(e) => {
                            const n = new Set(selU);
                            e.target.checked ? n.add(id) : n.delete(id);
                            setSelU(n);
                          }}
                        />
                      </td>
                      <td>₹{Number(r.minDeposit)}</td>
                      <td>{Number(r.spinChances)}</td>
                      <td>{r.isActive ? "Yes" : "No"}</td>
                      <td className="space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          className="text-xs font-bold text-blue-600"
                          onClick={() => {
                            setEditRuleId(id);
                            setRuleForm({
                              minDeposit: String(r.minDeposit ?? ""),
                              spinChances: String(r.spinChances ?? ""),
                              isActive: Boolean(r.isActive ?? true),
                            });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-slate-600"
                          onClick={async () => {
                            await admin.updateLuckySpinRule(id, {
                              isActive: !r.isActive,
                            });
                            toast("Toggled", "success");
                            load();
                          }}
                        >
                          Toggle
                        </button>
                        <button
                          type="button"
                          className="text-xs font-bold text-red-600"
                          onClick={async () => {
                            await admin.deleteLuckySpinRule(id);
                            if (editRuleId === id) setEditRuleId(null);
                            load();
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
          )}
        </Surface>
      </div>
    </div>
  );
}
