"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import * as admin from "../../../../lib/admin-api";
import { useToast } from "../../../../components/ui/Toast";
import { PageTitle, Surface } from "../../../components/ui";

type UserRole = "USER" | "AGENT" | "SUB_ADMIN" | "ADMIN";

const ROLES: UserRole[] = ["USER", "AGENT", "SUB_ADMIN", "ADMIN"];

export default function CreateUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<{
    username: string;
    mobileNumber: string;
    password: string;
    role: UserRole;
    isDemo: boolean;
  }>({
    username: "",
    mobileNumber: "",
    password: "",
    role: "USER",
    isDemo: false,
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await admin.createUser({
        username: form.username,
        mobileNumber: form.mobileNumber,
        password: form.password,
        role: form.role,
        isDemo: form.isDemo,
      });
      toast(
        form.isDemo ? "Demo user created" : "User created",
        "success"
      );
      router.push("/admin/users");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle title="Create user" subtitle="Admin-created accounts" />
      <Surface className="max-w-lg">
        <form onSubmit={submit} className="space-y-3">
          {(
            [
              ["username", "Username"],
              ["mobileNumber", "Mobile (10 digits)"],
              ["password", "Password"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
              <input
                className="admin-input"
                type={key === "password" ? "password" : "text"}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                required
              />
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Role</label>
            <select
              className="admin-input"
              value={form.role}
              onChange={(e) =>
                setForm((f) => ({ ...f, role: e.target.value as UserRole }))
              }
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
          >
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-amber-500"
                checked={form.isDemo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isDemo: e.target.checked }))
                }
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  Demo account
                </span>
                <span className="mt-0.5 block text-xs text-slate-500 leading-snug">
                  Demo users are excluded from real turnover, salary, and
                  production metrics. Default is off (real user).
                </span>
              </span>
            </label>
          </div>
          <button type="submit" disabled={busy} className="admin-btn-primary">
            {busy ? "Creating…" : "Create user"}
          </button>
        </form>
      </Surface>
    </div>
  );
}
