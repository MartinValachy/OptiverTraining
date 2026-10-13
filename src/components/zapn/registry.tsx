"use client";

import type { ComponentType } from "react";
import type { GameId } from "@/modules/zapn/config";
import type { GameProps, GameResult } from "./GameShell";
import { BalloonAnalysis, BalloonGame, CodeCompareGame, NumberBoxGame, PincodeGame, SwitchGame } from "./games1";
import { DialGame, GrillGame, PatternGame, ShapeshiftGame, TowerGame } from "./games2";

export const GAME_COMPONENTS: Record<GameId, { Game: ComponentType<GameProps>; Analysis?: ComponentType<{ result: GameResult }> }> = {
  balloon: { Game: BalloonGame, Analysis: BalloonAnalysis },
  pincode: { Game: PincodeGame },
  codecompare: { Game: CodeCompareGame },
  switch: { Game: SwitchGame },
  numberbox: { Game: NumberBoxGame },
  tower: { Game: TowerGame },
  shapeshift: { Game: ShapeshiftGame },
  grill: { Game: GrillGame },
  pattern: { Game: PatternGame },
  dial: { Game: DialGame },
};
