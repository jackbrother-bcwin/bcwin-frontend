import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: "#110D14", color: "#FDE4BC" }}
    >
      <p className="text-4xl font-black text-[#FED358]">404</p>
      <h1 className="text-lg font-bold">Page not found</h1>
      <p className="max-w-xs text-[12px] text-[#B79C8B]">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="ts-btn-gold inline-flex h-11 items-center px-6 text-sm no-underline"
      >
        Back to home
      </Link>
    </div>
  );
}
