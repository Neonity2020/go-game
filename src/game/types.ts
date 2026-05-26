export type Stone = 'black' | 'white';
export type Position = { row: number; col: number };

export interface GameState {
  boardSize: number;
  board: (Stone | null)[][];
  currentPlayer: Stone;
  captures: { black: number; white: number };
  history: (Stone | null)[][][];
  koPoint: Position | null;
  passCount: number;
  gameOver: boolean;
  lastMove: Position | null;
}
