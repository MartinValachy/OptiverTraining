"use client";

import { GameShell } from "@/components/zapn/GameShell";
import { GAME_COMPONENTS } from "@/components/zapn/registry";
import { GAME_MAP, type GameId } from "@/modules/zapn/config";

export function GameClient({ id }: { id: string }) {
  const meta = GAME_MAP.get(id as GameId);
  if (!meta) return <p>Unknown game.</p>;
  const { Game, Analysis } = GAME_COMPONENTS[meta.id];
  return <GameShell meta={meta} Game={Game} Analysis={Analysis} />;
}
