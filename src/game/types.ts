export type Stone = 'black' | 'white';
export type Position = { row: number; col: number };

export interface MoveRecord {
  moveNumber: number;
  player: Stone;
  position: Position | null; // null = pass
  captures: number; // stones captured this move
}

export interface ScoreResult {
  blackTerritory: number;
  whiteTerritory: number;
  blackStones: number;
  whiteStones: number;
  blackCaptures: number;
  whiteCaptures: number;
  blackTotal: number;
  whiteTotal: number;
  komi: number;
  winner: Stone | 'tie';
}

export interface GameState {
  boardSize: number;
  board: (Stone | null)[][];
  currentPlayer: Stone;
  captures: { black: number; white: number };
  history: (Stone | null)[][][];
  capturesHistory: { black: number; white: number }[];
  koPoint: Position | null;
  passCount: number;
  gameOver: boolean;
  lastMove: Position | null;
  moveRecords: MoveRecord[];
}
