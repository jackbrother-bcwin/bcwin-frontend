"use client";

/**
 * Root-level error boundary (must include html/body — replaces root layout).
 * Next.js 16: app/global-error.tsx
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#110D14",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 400,
            minHeight: "100vh",
            background: "#110D14",
            color: "#FDE4BC",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 20, margin: 0 }}>Application error</h1>
          <p style={{ fontSize: 14, color: "#B79C8B", margin: 0 }}>
            {error.message || "A critical error occurred."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 8,
              height: 44,
              padding: "0 24px",
              borderRadius: 999,
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
              background: "linear-gradient(180deg, #FED358, #FFB472)",
              color: "#110D14",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
