"use client";
import React, { useState } from "react";
import * as admin from "../../../lib/admin-api";
import { useToast } from "../../../components/ui/Toast";
import ResourcePage from "../_resource/ResourcePage";
import { Surface } from "../../components/ui";

export default function Page() {
  const { toast } = useToast();
  const [form, setForm] = useState({ mobileNumber: "", password: "", username: "" });
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-4">
      <Surface title="Create sub-admin" className="max-w-lg">
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await admin.createSubAdmin(form);
              toast("Sub-admin created", "success");
            } catch (err: unknown) {
              toast(err instanceof Error ? err.message : "Failed", "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          {(["username", "mobileNumber", "password"] as const).map((k) => (
            <input
              key={k}
              className="admin-input"
              placeholder={k}
              type={k === "password" ? "password" : "text"}
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              required
            />
          ))}
          <button type="submit" disabled={busy} className="admin-btn-primary">Create</button>
        </form>
      </Surface>
      <ResourcePage
        title="Sub-admins"
        loader={async () => {
          const r = await admin.listSubAdmins();
          const d = r.data;
          return Array.isArray(d) ? d : [];
        }}
      />
    </div>
  );
}
