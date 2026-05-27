import type { Stone, Position, GameState, ScoreResult } from './types';

function createEmptyBoard(size: number): (Stone | null)[][] {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function cloneBoard(board: (Stone | null)[][]): (Stone | null)[][] {
  return board.map(row => [...row]);
}

export function getMaxHandicapStones(boardSize: number): number {
  return boardSize === 9 ? 5 : 9;
}

export function normalizeHandicap(boardSize: number, handicap: number): number {
  if (!Number.isFinite(handicap)) return 0;
  const rounded = Math.round(handicap);
  return Math.min(Math.max(rounded, 0), getMaxHandicapStones(boardSize));
}

export function getHandicapPositions(boardSize: number, handicap: number): Position[] {
  const count = normalizeHandicap(boardSize, handicap);
  if (count === 0) return [];

  const low = boardSize === 9 ? 2 : 3;
  const high = boardSize - low - 1;
  const mid = Math.floor(boardSize / 2);

  const center = { row: mid, col: mid };
  if (count === 1) return [center];

  const corners = [
    { row: high, col: low },
    { row: low, col: high },
    { row: high, col: high },
    { row: low, col: low },
  ];

  if (count <= 4) return corners.slice(0, count);
  if (count === 5) return [...corners, center];

  const sidePoints = [
    { row: mid, col: low },
    { row: mid, col: high },
    { row: low, col: mid },
    { row: high, col: mid },
  ];

  if (count === 6) return [...corners, ...sidePoints.slice(0, 2)];
  if (count === 7) return [...corners, ...sidePoints.slice(0, 2), center];
  if (count === 8) return [...corners, ...sidePoints];
  return [...corners, ...sidePoints, center];
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

export function createInitialState(boardSize: number = 19, handicap: number = 0): GameState {
  const normalizedHandicap = normalizeHandicap(boardSize, handicap);
  const board = createEmptyBoard(boardSize);
  for (const pos of getHandicapPositions(boardSize, normalizedHandicap)) {
    board[pos.row][pos.col] = 'black';
  }

  return {
    boardSize,
    handicap: normalizedHandicap,
    board,
    currentPlayer: normalizedHandicap > 0 ? 'white' : 'black',
    captures: { black: 0, white: 0 },
    history: [],
    capturesHistory: [],
    koPoint: null,
    passCount: 0,
    gameOver: false,
    lastMove: null,
    moveRecords: [],
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

  // Ko detection
  let koPoint: Position | null = null;
  if (capturedCount === 1 && capturedSingle) {
    const ownGroup = getGroup(newBoard, pos, boardSize);
    if (ownGroup.length === 1 && getLiberties(newBoard, ownGroup, boardSize) === 1) {
      koPoint = capturedSingle;
    }
  }

  const newCaptures = { ...captures };
  newCaptures[currentPlayer] += capturedCount;

  const moveRecord = {
    moveNumber: state.moveRecords.length + 1,
    player: currentPlayer,
    position: pos,
    captures: capturedCount,
  };

  return {
    boardSize,
    handicap: state.handicap,
    board: newBoard,
    currentPlayer: opponent,
    captures: newCaptures,
    history: [...state.history, board],
    capturesHistory: [...state.capturesHistory, captures],
    koPoint,
    passCount: 0,
    gameOver: false,
    lastMove: pos,
    moveRecords: [...state.moveRecords, moveRecord],
  };
}

export function pass(state: GameState): GameState {
  if (state.gameOver) return state;

  const newPassCount = state.passCount + 1;
  const opponent: Stone = state.currentPlayer === 'black' ? 'white' : 'black';

  const moveRecord = {
    moveNumber: state.moveRecords.length + 1,
    player: state.currentPlayer,
    position: null,
    captures: 0,
  };

  return {
    ...state,
    currentPlayer: opponent,
    history: [...state.history, state.board],
    capturesHistory: [...state.capturesHistory, state.captures],
    koPoint: null,
    passCount: newPassCount,
    gameOver: newPassCount >= 2,
    lastMove: null,
    moveRecords: [...state.moveRecords, moveRecord],
  };
}

export function resign(state: GameState): GameState {
  return { ...state, gameOver: true };
}

function getTrailingPassCount(records: GameState['moveRecords']): number {
  let count = 0;
  for (let i = records.length - 1; i >= 0; i--) {
    if (records[i].position !== null) break;
    count++;
  }
  return Math.min(count, 2);
}

export function undo(state: GameState): GameState {
  if (state.history.length === 0) return state;

  const newHistory = [...state.history];
  const prevBoard = newHistory.pop()!;

  const newCapturesHistory = [...state.capturesHistory];
  const prevCaptures = newCapturesHistory.pop() || { black: 0, white: 0 };

  const newMoveRecords = [...state.moveRecords];
  newMoveRecords.pop();

  const opponent: Stone = state.currentPlayer === 'black' ? 'white' : 'black';

  // Find last move from the remaining records
  const lastRecord = newMoveRecords.length > 0 ? newMoveRecords[newMoveRecords.length - 1] : null;
  const lastMove = lastRecord?.position || null;

  return {
    ...state,
    board: prevBoard,
    currentPlayer: opponent,
    captures: prevCaptures,
    history: newHistory,
    capturesHistory: newCapturesHistory,
    koPoint: null, // simplified: clear ko after undo
    passCount: getTrailingPassCount(newMoveRecords),
    gameOver: false,
    lastMove,
    moveRecords: newMoveRecords,
  };
}

export function calculateScore(state: GameState, komi: number = 6.5): ScoreResult {
  const { board, boardSize, captures } = state;
  const visited = new Set<string>();
  let blackTerritory = 0;
  let whiteTerritory = 0;
  let blackStones = 0;
  let whiteStones = 0;

  // Count stones
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      if (board[r][c] === 'black') blackStones++;
      else if (board[r][c] === 'white') whiteStones++;
    }
  }

  // Flood fill to find territory
  for (let r = 0; r < boardSize; r++) {
    for (let c = 0; c < boardSize; c++) {
      const key = `${r},${c}`;
      if (board[r][c] !== null || visited.has(key)) continue;

      const region: Position[] = [];
      const borders = new Set<Stone>();
      const queue: Position[] = [{ row: r, col: c }];

      while (queue.length > 0) {
        const cur = queue.pop()!;
        const ck = `${cur.row},${cur.col}`;
        if (visited.has(ck)) continue;
        const stone = board[cur.row][cur.col];
        if (stone !== null) {
          borders.add(stone);
          continue;
        }
        visited.add(ck);
        region.push(cur);
        for (const nb of getNeighbors(cur, boardSize)) {
          if (!visited.has(`${nb.row},${nb.col}`)) queue.push(nb);
        }
      }

      if (borders.size === 1) {
        if (borders.has('black')) blackTerritory += region.length;
        else whiteTerritory += region.length;
      }
    }
  }

  const blackTotal = blackStones + blackTerritory + captures.black;
  const whiteTotal = whiteStones + whiteTerritory + captures.white + komi;

  let winner: Stone | 'tie';
  if (blackTotal > whiteTotal) winner = 'black';
  else if (whiteTotal > blackTotal) winner = 'white';
  else winner = 'tie';

  return {
    blackTerritory,
    whiteTerritory,
    blackStones,
    whiteStones,
    blackCaptures: captures.black,
    whiteCaptures: captures.white,
    blackTotal,
    whiteTotal,
    komi,
    winner,
  };
}
