import { GAMES } from "@/modules/zapn/config";
import { GameClient } from "./GameClient";

export function generateStaticParams() {
  return GAMES.map((g) => ({ game: g.id }));
}

export const dynamicParams = false;

export default async function GamePage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  return <GameClient id={game} />;
}
