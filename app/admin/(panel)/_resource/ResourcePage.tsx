"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../components/ui/Toast";
import {
  EmptyBlock,
  LoadingBlock,
  PageTitle,
  RefreshBtn,
  Surface,
} from "../../components/ui";

/** Generic admin resource viewer for list endpoints */
export default function ResourcePage({
  title,
  subtitle,
  loader,
  columns,
}: {
  title: string;
  subtitle?: string;
  loader: () => Promise<unknown[]>;
  columns?: string[];
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loader();
      setRows(
        (data as Array<Record<string, unknown>>).map((r) =>
          typeof r === "object" && r ? r : { value: r }
        )
      );
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Failed to load", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loader, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const cols =
    columns ??
    (rows[0]
      ? Object.keys(rows[0]).filter((k) => typeof rows[0]![k] !== "object").slice(0, 8)
      : []);

  return (
    <div>
      <PageTitle title={title} subtitle={subtitle} action={<RefreshBtn onClick={load} loading={loading} />} />
      <Surface>
        {loading ? (
          <LoadingBlock />
        ) : rows.length === 0 ? (
          <EmptyBlock />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={String(r.id ?? i)}>
                    {cols.map((c) => (
                      <td key={c} className="max-w-[180px] truncate text-[12px]">
                        {String(r[c] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}
