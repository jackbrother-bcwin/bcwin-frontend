"use client";

import { SiBinance, SiTether } from "react-icons/si";

function normalizeChain(chain?: string | null): "BEP20" | "TRC20" | "" {
  const c = String(chain ?? "")
    .toUpperCase()
    .replace(/[-\s]/g, "");
  if (c === "BEP20" || c === "BEP" || c === "BSC" || c === "BNB") return "BEP20";
  if (c === "TRC20" || c === "TRC" || c === "TRON" || c === "TRX") return "TRC20";
  return "";
}

/** USDT token — green Tether T, no chain overlay */
export function TetherMark({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: "#26A17B" }}
      title="USDT"
      aria-label="USDT"
    >
      <SiTether
        size={Math.max(9, Math.round(size * 0.72))}
        color="#fff"
        aria-hidden
      />
    </span>
  );
}

/** BNB Smart Chain (BEP20) */
export function BnbMark({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: "#F3BA2F" }}
      title="BEP20"
      aria-label="BEP20"
    >
      <SiBinance
        size={Math.max(8, Math.round(size * 0.65))}
        style={{ color: "#110D14" }}
        aria-hidden
      />
    </span>
  );
}

/** Tron (TRC20) — filled official diamond on Tron red */
export function TronMark({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: "#EF0027" }}
      title="TRC20"
      aria-label="TRC20"
    >
      <svg width="78%" height="78%" viewBox="8 7 34 36" aria-hidden>
        <path
          fill="#fff"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M26.1014 21.2149L32.7316 15.2706L14.4413 11.6125L26.1014 21.2149ZM35.0672 13.7646C34.9557 13.6994 34.8298 13.6506 34.6908 13.6228L11.706 9.02585C11.1479 8.91424 10.6909 9.17665 10.4502 9.57042C10.0728 9.87477 9.86981 10.396 10.0925 10.9501L22.4961 41.8149C22.812 42.6009 23.7011 42.7469 24.2811 42.3681C24.5174 42.3121 24.7439 42.1791 24.9273 41.9546L41.6796 21.4474C41.9048 21.1717 41.9816 20.8526 41.9453 20.553C42.0387 20.1556 41.9351 19.7107 41.5816 19.3908L35.6909 14.0611C35.5104 13.8978 35.2927 13.799 35.0672 13.7646ZM34.8833 16.0275L29.2389 21.0881L38.9707 19.7256L34.8833 16.0275ZM13.1172 13.1131L25.0686 22.9554L23.1715 38.132L13.1172 13.1131ZM38.8388 21.7637L25.1724 38.4932L27.0279 23.4171L38.8388 21.7637Z"
        />
      </svg>
    </span>
  );
}

/**
 * Token is always USDT (Tether). Second mark is the chain:
 * BEP20 → BNB · TRC20 → Tron.
 */
export function UsdtTypeIcons({
  chain,
  size = 16,
}: {
  chain?: string | null;
  size?: number;
}) {
  const c = normalizeChain(chain);
  return (
    <span className="inline-flex items-center gap-1 shrink-0">
      <TetherMark size={size} />
      {c === "BEP20" && <BnbMark size={size} />}
      {c === "TRC20" && <TronMark size={size} />}
    </span>
  );
}
