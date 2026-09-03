"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as admin from "../../../../lib/admin-api";
import { useToast } from "../../../../components/ui/Toast";
import { EmptyBlock, PageTitle, Surface } from "../../../components/ui";
import { IoPeople, IoPerson } from "react-icons/io5";

type TreeNode = {
  id?: string;
  username?: string;
  serialNumber?: number;
  mobileNumber?: string;
  referralCode?: string;
  referredBy?: string | null;
  layer?: number;
  children?: TreeNode[];
  [k: string]: unknown;
};

/** Detect which query key the backend expects */
function buildInviteTreeParams(raw: string): Record<string, string> {
  const q = raw.trim();
  if (!q) return {};

  // UUID
  if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      q
    )
  ) {
    return { userId: q };
  }

  // A leading # explicitly selects an exact serial/UID lookup.
  const serialMatch = q.match(/^#\s*(\d+)$/);
  if (serialMatch) {
    return { serialNumber: serialMatch[1]! };
  }

  // Any all-digit value is a mobile-number lookup, regardless of length.
  if (/^\d+$/.test(q)) {
    return { mobile: q };
  }

  // Username / referral code → backend search
  return { search: q };
}

/** Nest flat layer list into a tree using referralCode → referredBy */
function nestTree(
  rootReferralCode: string,
  flat: TreeNode[]
): TreeNode[] {
  const MAX_DEPTH = 50;

  const byReferrer = new Map<string, TreeNode[]>();
  for (const m of flat) {
    const parent = String(m.referredBy ?? "");
    if (!byReferrer.has(parent)) byReferrer.set(parent, []);
    byReferrer.get(parent)!.push({ ...m, children: [] });
  }

  /**
   * visited tracks referral codes that are already on the current
   * ancestor path — if we see the same code again it's a cycle in
   * the data, and we stop recursing to prevent a stack overflow.
   */
  const attach = (
    code: string,
    depth: number,
    visited: Set<string>
  ): TreeNode[] => {
    if (depth > MAX_DEPTH || visited.has(code)) return [];
    const kids = byReferrer.get(code) ?? [];
    const nowVisited = new Set(visited);
    nowVisited.add(code);
    return kids.map((k) => {
      const childCode = k.referralCode ? String(k.referralCode) : null;
      return {
        ...k,
        layer: depth,
        children: childCode
          ? attach(childCode, depth + 1, nowVisited)
          : [],
      };
    });
  };

  return attach(rootReferralCode, 1, new Set());
}

function NodeCard({ node, depth }: { node: TreeNode; depth: number }) {
  const kids = Array.isArray(node.children) ? node.children : [];
  const layer = node.layer ?? depth;
  return (
    <div className="relative min-w-0">
      <div
        className="inline-flex min-w-[140px] max-w-full flex-col rounded-xl border border-blue-100 bg-white px-3 py-2 shadow-sm transition hover:shadow-md"
        style={{ marginLeft: Math.min(depth, 8) * 8 }}
      >
        <div className="mb-1 flex items-center gap-1.5 text-blue-600">
          {kids.length ? <IoPeople size={14} /> : <IoPerson size={14} />}
          <span className="text-[10px] font-bold uppercase text-slate-400">
            L{layer}
          </span>
        </div>
        <p className="truncate text-sm font-bold text-slate-800">
          {node.username ?? "User"}
        </p>
        <p className="font-mono text-[10px] text-slate-500">
          #{node.serialNumber ?? "—"}
        </p>
        <p className="truncate text-[10px] text-slate-400">
          {node.mobileNumber ?? ""}
        </p>
        {node.referralCode && (
          <p className="mt-0.5 truncate font-mono text-[9px] text-slate-300">
            {String(node.referralCode)}
          </p>
        )}
      </div>
      {kids.length > 0 && (
        <div className="ml-4 mt-2 space-y-2 border-l-2 border-blue-100 pl-3 sm:ml-6 sm:pl-4">
          {kids.map((c, i) => (
            <NodeCard key={String(c.id ?? i)} node={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function InviteTreePage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [root, setRoot] = useState<Record<string, unknown> | null>(null);
  const [flat, setFlat] = useState<TreeNode[]>([]);
  const [total, setTotal] = useState(0);
  const [layerCounts, setLayerCounts] = useState<Record<string, number>>({});

  const tree = useMemo(() => {
    if (!root?.referralCode) return [];
    return nestTree(String(root.referralCode), flat);
  }, [root, flat]);

  const runSearch = async (rawInput?: string) => {
    const raw = (rawInput ?? query).trim();
    if (!raw) {
      toast("Enter a mobile, username, #UID, or user UUID", "error");
      return;
    }
    setQuery(raw);
    setLoading(true);
    try {
      const params = buildInviteTreeParams(raw);
      const res = await admin.getInviteTree(params);
      const anyRes = res as {
        success?: boolean;
        user?: Record<string, unknown>;
        tree?: TreeNode[];
        total?: number;
        layerCounts?: Record<string, number>;
        error?: string;
      };

      if (!anyRes.user) {
        toast(anyRes.error || "User not found", "error");
        setRoot(null);
        setFlat([]);
        setTotal(0);
        setLayerCounts({});
        return;
      }

      setRoot(anyRes.user);
      const t = Array.isArray(anyRes.tree) ? anyRes.tree : [];
      setFlat(t);
      setTotal(Number(anyRes.total ?? t.length));
      setLayerCounts(anyRes.layerCounts ?? {});

      if (t.length === 0) {
        toast("User found — no downline members yet", "success");
      } else {
        toast(`Loaded ${t.length} member(s) in tree`, "success");
      }
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to load tree", "error");
      setRoot(null);
      setFlat([]);
      setTotal(0);
      setLayerCounts({});
    } finally {
      setLoading(false);
    }
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSearch();
  };

  // Prefill from ?q= when opened from user hub
  useEffect(() => {
    const q = searchParams.get("q");
    if (q?.trim()) {
      void runSearch(q.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount / q change
  }, [searchParams]);

  return (
    <div>
      <PageTitle
        title="Invite tree"
        subtitle="Lookup by mobile · username · #UID · UUID"
      />
      <Surface className="mb-4 max-w-xl">
        <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
          <input
            className="admin-input"
            placeholder="e.g. 9855641885 · username · #8400 · UUID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="User identifier"
          />
          <button
            type="submit"
            disabled={loading}
            className="admin-btn-primary shrink-0"
          >
            {loading ? "Loading…" : "Load tree"}
          </button>
        </form>
        <p className="mt-2 text-[11px] text-slate-500">
          Use # before an exact UID (e.g. #8400). Digits without # search mobile;
          names and full user UUIDs also work.
        </p>
      </Surface>

      {root && (
        <div className="mb-4 admin-fade-up rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 p-4 text-white shadow-lg sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Root user
          </p>
          <p className="text-xl font-black">{String(root.username ?? "—")}</p>
          <p className="break-all text-sm text-white/80">
            #{String(root.serialNumber ?? "")} ·{" "}
            {String(root.mobileNumber ?? "")}
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-white/70">
            ID: {String(root.id ?? "")}
          </p>
          <p className="mt-0.5 break-all font-mono text-[11px] text-white/70">
            Code: {String(root.referralCode ?? "")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-white/20 px-2.5 py-1">
              Total downline: {total}
            </span>
            {Object.entries(layerCounts)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([layer, count]) => (
                <span
                  key={layer}
                  className="rounded-full bg-white/15 px-2.5 py-1"
                >
                  L{layer}: {count}
                </span>
              ))}
          </div>
        </div>
      )}

      <Surface title="Downline tree">
        {!root ? (
          <EmptyBlock label="Search a user to render their invite tree" />
        ) : tree.length === 0 ? (
          <EmptyBlock label="No downline members for this user" />
        ) : (
          <div className="space-y-3 overflow-x-auto py-2">
            {tree.map((n, i) => (
              <NodeCard key={String(n.id ?? i)} node={n} depth={1} />
            ))}
          </div>
        )}
      </Surface>
    </div>
  );
}
