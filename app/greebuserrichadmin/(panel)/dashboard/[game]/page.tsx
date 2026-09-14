import { notFound } from "next/navigation";
import GameDashboard from "../../../components/GameDashboard";

export default async function GameDashboardPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (game !== "wingo" && game !== "trxwingo" && game !== "thirdparty") notFound();
  return <GameDashboard key={game} game={game} />;
}
