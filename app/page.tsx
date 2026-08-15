import type { Metadata } from "next";
import AppShell from "./components/AppShell";

/**
 * Server Component entry (Next 16 default).
 * Interactive SPA shell is isolated in client AppShell with dynamic imports.
 */
export const metadata: Metadata = {
  title: "BCWin — Home",
  description: "Play and Win",
};

export default function HomePage() {
  return <AppShell />;
}
