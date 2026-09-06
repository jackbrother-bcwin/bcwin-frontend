import { asset } from "./lib/cdn";

const SPLASH_IMG = "https://ik.imagekit.io/BCwin/assets/images/bcwinsplash.png";

/** Route-level loading — same splash as BrandSplash (no client JS). */
export default function Loading() {
  return (
    <div
      className="brand-splash relative flex min-h-dvh min-h-screen flex-col overflow-hidden bg-[#1a0e04]"
      role="status"
      aria-live="polite"
      aria-label="Loading BCWin"
    >
      {/* Splash artwork */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative h-full w-full max-w-[480px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SPLASH_IMG}
            alt="BCWin"
            className="h-full w-full object-cover object-center sm:object-contain"
          />
        </div>
      </div>

      {/* Soft scrims for logo / spinner */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-24"
        style={{
          background: "linear-gradient(180deg, rgba(10,6,2,0.45) 0%, transparent 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[26%]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(10,6,2,0.3) 45%, rgba(10,6,2,0.72) 100%)",
        }}
      />

      {/* BCWin logo on top */}
      <div className="relative z-10 flex flex-col items-center pt-[max(16px,env(safe-area-inset-top))] px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset("/assets/png/bcwin.png")}
          alt="BCWin"
          width={168}
          height={48}
          className="mt-3 h-11 w-auto object-contain sm:h-12"
          style={{
            filter:
              "drop-shadow(0 4px 18px rgba(0,0,0,0.55)) drop-shadow(0 0 20px rgba(254,211,88,0.4))",
          }}
        />
      </div>

      {/* Spinner */}
      <div className="relative z-10 mt-auto flex flex-col items-center gap-3 px-6 pb-[max(28px,calc(20px+env(safe-area-inset-bottom)))]">
        <div
          className="h-9 w-9 animate-spin rounded-full border-[3px] border-t-transparent"
          style={{
            borderColor: "rgba(254,211,88,0.25)",
            borderTopColor: "#FED358",
            boxShadow: "0 0 16px rgba(254,211,88,0.3)",
          }}
          aria-hidden
        />
        <span className="text-[14px] font-semibold tracking-wide text-[#FDE4BC]">
          Loading…
        </span>
      </div>
    </div>
  );
}
