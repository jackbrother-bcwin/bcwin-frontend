import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "K3",
};

export default function K3RoutePage() {
  redirect("/?screen=k3");
}
