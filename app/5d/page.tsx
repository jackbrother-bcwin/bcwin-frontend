import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "5D",
};

export default function FiveDRoutePage() {
  redirect("/?screen=5d");
}
