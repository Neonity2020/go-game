import type { Stone, Position, GameState } from './types';

function createEmptyBoard(size: number): (Stone | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function cloneBoard(board: (Stone | null)[][]): (Stone | null)[][] {
  return board.map(row => [...row]);
}

function getNeighbors(pos: Position, size: number): Position[] {
  const { row, col } = pos;
  const neighbors: Position[] = [];
  if (row > 0) neighbors.push({ row: row - 1, col });
  if (row < size - 1) neighbors.push({ row: row + 1, col });
  if (col > 0) neighbors.push({ row, col: col - 1 });
  if (col < size - 1) neighbors.push({ row, col: col + 1 });
  return neighbors;
}

export function getGroup(board: (Stone | null)[][], pos: Position, size: number): Position[] {
  const stone = board[pos.row][pos.col];
  if (!stone) return [];

  const visited = new Set<string>();
  const group: Position[] = [];
  const queue: Position[] = [pos];

  while (queue.length > 0) {
    const current = queue.pop()!;
    const key = `${current.row},${current.col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    group.push(current);

    for (const neighbor of getNeighbors(current, size)) {
      const nKey = `${neighbor.row},${neighbor.col}`;
      if (!visited.has(nKey) && board[neighbor.row][neighbor.col] === stone) {
        queue.push(neighbor);
      }
    }
  }

  return group;
}

export function getLiberties(board: (Stone | null)[][], group: Position[], size: number): number {
  const libertySet = new Set<string>();
  for (const pos of group) {
    for (const neighbor of getNeighbors(pos, size)) {
      if (board[neighbor.row][neighbor.col] === null) {
        libertySet.add(`${neighbor.row},${neighbor.col}`);
      }
    }
  }
  return libertySet.size;
}

function boardsEqual(a: (Stone | null)[][], b: (Stone | null)[][]): boolean {
  for (let r = 0; r < a.length; r++) {
    for (let c = 0; c < a[r].length; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

export function createInitialState(boardSize: number = 19): GameState {
  return {
    boardSize,
    board: createEmptyBoard(boardSize),
    currentPlayer: 'black',
    captures: { black: 0, white: 0 },
    history: [],
    koPoint: null,
    passCount: 0,
    gameOver: false,
    lastMove: null,
  };
}

export function isValidMove(state: GameState, pos: Position): boolean {
  const { board, boardSize, currentPlayer, koPoint } = state;
  const { row, col } = pos;

  if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) return false;
  if (board[row][col] !== null) return false;
  if (koPoint && koPoint.row === row && koPoint.col === col) return false;

  // Simulate the move
  const newBoard = cloneBoard(board);
  newBoard[row][col] = currentPlayer;
  const opponent: Stone = currentPlayer === 'black' ? 'white' : 'black';

  // Check captures
  let captured = 0;
  for (const neighbor of getNeighbors(pos, boardSize)) {
    if (newBoard[neighbor.row][neighbor.col] === opponent) {
      const group = getGroup(newBoard, neighbor, boardSize);
      if (getLiberties(newBoard, group, boardSize) === 0) {
        captured += group.length;
        for (const p of group) {
          newBoard[p.row][p.col] = null;
        }
      }
    }
  }

  // Suicide check
  if (captured === 0) {
    const ownGroup = getGroup(newBoard, pos, boardSize);
    if (getLiberties(newBoard, ownGroup, boardSize) === 0) {
      return false;
    }
  }

  return true;
}

export function placeStone(state: GameState, pos: Position): GameState {
  if (state.gameOver || !isValidMove(state, pos)) return state;

  const { board, boardSize, currentPlayer, captures } = state;
  const newBoard = cloneBoard(board);
  newBoard[pos.row][pos.col] = currentPlayer;
  const opponent: Stone = currentPlayer === 'black' ? 'white' : 'black';

  // Remove captured stones
  let capturedCount = 0;
  let capturedSingle: Position | null = null;
  for (const neighbor of getNeighbors(pos, boardSize)) {
    if (newBoard[neighbor.row][neighbor.col] === opponent) {
      const group = getGroup(newBoard, neighbor, boardSize);
      if (getLiberties(newBoard, group, boardSize) === 0) {
        capturedCount += group.length;
        if (group.length === 1) capturedSingle = group[0];
        for (const p of group) {
          newBoard[p.row][p.col] = null;
        }
      }
    }
  }

  // Ko detection: single stone captured, and the capturing stone has no liberties other than the captured point
  let koPoint: Position | null = null;
  if (capturedCount === 1 && capturedSingle) {
    const ownGroup = getGroup(newBoard, pos, boardSize);
    if (ownGroup.length === 1 && getLiberties(newBoard, ownGroup, boardSize) === 1) {
      koPoint = capturedSingle;
    }
  }

  const newCaptures = { ...captures };
  newCaptures[currentPlayer] += capturedCount;

  return {
    boardSize,
    board: newBoard,
    currentPlayer: opponent,
    captures: newCaptures,
    history: [...state.history, board],
    koPoint,
    passCount: 0,
    gameOver: false,
    lastMove: pos,
  };
}

export function pass(state: GameState): GameState {
  if (state.gameOver) return state;

  const newPassCount = state.passCount + 1;
  const opponent: Stone = state.currentPlayer === 'black' ? 'white' : 'black';

  return {
    ...state,
    currentPlayer: opponent,
    history: [...state.history, state.board],
    koPoint: null,
    passCount: newPassCount,
    gameOver: newPassCount >= 2,
    lastMove: null,
  };
}

export function resign(state: GameState): GameState {
  return { ...state, gameOver: true };
}
