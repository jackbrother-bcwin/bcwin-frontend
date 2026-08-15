import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Win Go",
};

/** Legacy path → SPA entry with screen query (hash not reliable on server redirect) */
export default function WingoRoutePage() {
  redirect("/?screen=wingo");
}
