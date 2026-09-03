"use client";

import React, { useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import { EmptyBlock, PageTitle, Surface } from "../../components/ui";
import {
  isValidBankAccount,
  isValidBep20Address,
  isValidIfsc,
  isValidRecipientName,
  isValidTrc20Address,
  isValidUpiId,
} from "../../../lib/bank-validation";

type BankForm = {
  fullName: string;
  bankName: string;
  bankAccount: string;
  ifsc: string;
  upiId: string;
  trc20Address: string;
  bep20Address: string;
};

const EMPTY: BankForm = {
  fullName: "",
  bankName: "",
  bankAccount: "",
  ifsc: "",
  upiId: "",
  trc20Address: "",
  bep20Address: "",
};

const FIELDS: { key: keyof BankForm; label: string; placeholder: string }[] = [
  { key: "fullName", label: "Account holder", placeholder: "Full name" },
  { key: "bankName", label: "Bank name", placeholder: "STATE BANK OF INDIA" },
  { key: "bankAccount", label: "Account number", placeholder: "Bank account" },
  { key: "ifsc", label: "IFSC", placeholder: "HDFC0000001" },
  { key: "upiId", label: "UPI ID", placeholder: "name@upi" },
  { key: "trc20Address", label: "USDT TRC20", placeholder: "T… (34 chars)" },
  { key: "bep20Address", label: "USDT BEP20", placeholder: "0x… (42 chars)" },
];

function bankFormError(form: BankForm): string | null {
  if (form.fullName.trim() && !isValidRecipientName(form.fullName))
    return "Recipient name must be 3–100 valid characters";
  if (
    form.bankName.trim() &&
    (form.bankName.trim().length < 2 || form.bankName.trim().length > 120)
  )
    return "Bank name must be 2–120 characters";
  if (form.bankAccount.trim() && !isValidBankAccount(form.bankAccount))
    return "Account number must be 8–20 digits";
  if (form.ifsc.trim() && !isValidIfsc(form.ifsc))
    return "IFSC must be 11 characters: 4 letters, 0, then 6 letters or digits";
  if (form.upiId.trim() && !isValidUpiId(form.upiId))
    return "UPI ID must use name@handle format (3–50 characters, no spaces)";
  if (form.trc20Address.trim() && !isValidTrc20Address(form.trc20Address))
    return "TRC20 address must start with T and contain 34 characters";
  if (form.bep20Address.trim() && !isValidBep20Address(form.bep20Address))
    return "BEP20 address must be 0x followed by 40 hexadecimal characters";
  return null;
}

function flattenUser(u: {
  id: string;
  serialNumber?: number;
  username?: string;
  mobileNumber?: string;
  bank?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const b = u.bank ?? {};
  return {
    userId: u.id,
    username: u.username,
    serialNumber: u.serialNumber,
    mobileNumber: u.mobileNumber,
    fullName: b.fullName ?? "",
    bankName: b.bankName ?? "",
    bankAccount: b.bankAccount ?? "",
    ifsc: b.ifsc ?? "",
    upiId: b.upiId ?? "",
    trc20Address: b.trc20Address ?? "",
    bep20Address: b.bep20Address ?? "",
  };
}

export default function BankAdminPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [editUserId, setEditUserId] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [form, setForm] = useState<BankForm>(EMPTY);
  const [busy, setBusy] = useState(false);

  const fillFromRow = (r: Record<string, unknown>) => {
    setEditUserId(String(r.userId ?? r.id ?? ""));
    setEditLabel(
      [r.username, r.serialNumber != null ? `UID ${r.serialNumber}` : ""]
        .filter(Boolean)
        .join(" · ")
    );
    setForm({
      fullName: String(r.fullName ?? ""),
      bankName: String(r.bankName ?? ""),
      bankAccount: String(r.bankAccount ?? ""),
      ifsc: String(r.ifsc ?? ""),
      upiId: String(r.upiId ?? ""),
      trc20Address: String(r.trc20Address ?? ""),
      bep20Address: String(r.bep20Address ?? ""),
    });
  };

  const doSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const r = await admin.searchBank({ search: search || undefined });
      if (r.user) {
        const row = flattenUser(r.user);
        setRows([row]);
        fillFromRow(row);
      } else if (Array.isArray(r.data)) {
        setRows(r.data as Array<Record<string, unknown>>);
      } else {
        setRows([]);
        toast("No user found", "info");
      }
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Search failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageTitle title="Bank details" subtitle="Search & update user payout info (bank / UPI / USDT)" />
      <Surface className="mb-4 max-w-xl">
        <form onSubmit={(ev) => void doSearch(ev)} className="flex gap-2">
          <input
            className="admin-input"
            placeholder="Mobile, name, or #UID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="admin-btn-primary shrink-0">
            {loading ? "…" : "Search"}
          </button>
        </form>
      </Surface>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface title="Results">
          {rows.length === 0 ? (
            <EmptyBlock label="No bank rows — search first" />
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {rows.map((r, i) => (
                <button
                  key={String(r.userId ?? i)}
                  type="button"
                  className="w-full rounded-lg border border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => fillFromRow(r)}
                >
                  <p className="font-bold">
                    {String(r.username ?? r.fullName ?? "—")}
                    {r.serialNumber != null ? (
                      <span className="ml-2 text-xs font-medium text-slate-400">
                        UID {String(r.serialNumber)}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {String(r.bankAccount || "no account")} · {String(r.ifsc || "—")}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-400">
                    TRC20 {String(r.trc20Address || "—")} · BEP20{" "}
                    {String(r.bep20Address || "—")}
                  </p>
                </button>
              ))}
            </div>
          )}
        </Surface>
        <Surface title={editLabel ? `Update · ${editLabel}` : "Update bank"}>
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editUserId) {
                toast("Select a user first", "error");
                return;
              }
              const validationError = bankFormError(form);
              if (validationError) {
                toast(validationError, "error");
                return;
              }
              setBusy(true);
              try {
                await admin.updateUserBank(editUserId, {
                  fullName: form.fullName.trim() || null,
                  bankName: form.bankName.trim() || null,
                  bankAccount: form.bankAccount.trim() || null,
                  ifsc: form.ifsc.trim() || null,
                  upiId: form.upiId.trim() || null,
                  trc20Address: form.trc20Address.trim() || null,
                  bep20Address: form.bep20Address.trim() || null,
                });
                toast("Bank updated", "success");
                void doSearch();
              } catch (err: unknown) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              className="admin-input"
              placeholder="User UUID"
              value={editUserId}
              onChange={(e) => setEditUserId(e.target.value)}
            />
            {FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                  {label}
                </label>
                <input
                  className="admin-input font-mono text-[13px]"
                  placeholder={placeholder}
                  maxLength={
                    key === "fullName"
                      ? 100
                      : key === "bankName"
                        ? 120
                        : key === "bankAccount"
                          ? 20
                          : key === "ifsc"
                            ? 11
                            : key === "upiId"
                              ? 50
                              : key === "trc20Address"
                                ? 34
                                : 42
                  }
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      [key]:
                        key === "ifsc"
                          ? e.target.value.toUpperCase()
                          : e.target.value,
                    }))
                  }
                />
              </div>
            ))}
            <button type="submit" disabled={busy} className="admin-btn-primary">
              {busy ? "Saving…" : "Save bank details"}
            </button>
          </form>
        </Surface>
      </div>
    </div>
  );
}
