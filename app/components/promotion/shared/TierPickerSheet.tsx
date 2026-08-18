"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSpaBackClose } from "../../../hooks/useSpaBackClose";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";

const TIERS = [
  { id: "all", label: "All tiers" },
  { id: "1", label: "Tier 1" },
  { id: "2", label: "Tier 2" },
  { id: "3", label: "Tier 3" },
  { id: "4", label: "Tier 4" },
  { id: "5", label: "Tier 5" },
  { id: "6", label: "Tier 6" },
];

interface Props {
  open: boolean;
  value: string;
  onConfirm: (tier: string) => void;
  onCancel: () => void;
}

export default function TierPickerSheet({ open, value, onConfirm, onCancel }: Props) {
  const [mounted, setMounted] = useState(false);
  const [sel, setSel] = useState(value || "all");

  useSpaBackClose(open, onCancel, "tier-picker-sheet");
  useBodyScrollLock(open);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setSel(value || "all");
  }, [open, value]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="agency-sheet-overlay" onClick={onCancel} role="presentation">
      <div
        className="agency-sheet agency-sheet--tier"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Choose tier"
      >
        <div className="agency-sheet-head">
          <button type="button" className="agency-sheet-cancel" onClick={onCancel}>
            Cancel
          </button>
          <span className="agency-sheet-title" />
          <button
            type="button"
            className="agency-sheet-confirm"
            onClick={() => onConfirm(sel || "all")}
          >
            Confirm
          </button>
        </div>
        <div className="agency-tier-list">
          {TIERS.map((t) => (
            <button
              key={t.id || "all"}
              type="button"
              className={
                sel === t.id ? "agency-tier-item agency-tier-item--on" : "agency-tier-item"
              }
              onClick={() => setSel(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
