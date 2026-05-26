import type { GameState, Position, Stone } from './types';

function getNeighbors(pos: Position, size: number): Position[] {
  const { row, col } = pos;
  const n: Position[] = [];
  if (row > 0) n.push({ row: row - 1, col });
  if (row < size - 1) n.push({ row: row + 1, col });
  if (col > 0) n.push({ row, col: col - 1 });
  if (col < size - 1) n.push({ row, col: col + 1 });
  return n;
}

function getGroup(board: (Stone | null)[][], pos: Position, size: number): Position[] {
  const stone = board[pos.row][pos.col];
  if (!stone) return [];
  const visited = new Set<number>();
  const group: Position[] = [];
  const queue = [pos.row * size + pos.col];
  while (queue.length > 0) {
    const idx = queue.pop()!;
    if (visited.has(idx)) continue;
    visited.add(idx);
    const r = (idx / size) | 0, c = idx % size;
    group.push({ row: r, col: c });
    for (const nb of getNeighbors({ row: r, col: c }, size)) {
      const ni = nb.row * size + nb.col;
      if (!visited.has(ni) && board[nb.row][nb.col] === stone) queue.push(ni);
    }
  }
  return group;
}

function getLiberties(board: (Stone | null)[][], group: Position[], size: number): number {
  let libs = 0;
  const seen = new Set<number>();
  for (const pos of group) {
    for (const nb of getNeighbors(pos, size)) {
      const ni = nb.row * size + nb.col;
      if (board[nb.row][nb.col] === null && !seen.has(ni)) { seen.add(ni); libs++; }
    }
  }
  return libs;
}

function simulateAndCapture(board: (Stone | null)[][], pos: Position, player: Stone, size: number): { board: (Stone | null)[][]; captured: number; valid: boolean } {
  const b = board.map(r => [...r]);
  b[pos.row][pos.col] = player;
  const opp: Stone = player === 'black' ? 'white' : 'black';
  let cap = 0;
  for (const nb of getNeighbors(pos, size)) {
    if (b[nb.row][nb.col] === opp) {
      const g = getGroup(b, nb, size);
      if (getLiberties(b, g, size) === 0) {
        cap += g.length;
        for (const p of g) b[p.row][p.col] = null;
      }
    }
  }
  const own = getGroup(b, pos, size);
  if (getLiberties(b, own, size) === 0) return { board, captured: 0, valid: false };
  return { board: b, captured: cap, valid: true };
}

function estimateScore(board: (Stone | null)[][], size: number): number {
  const visited = new Set<number>();
  let bs = 0, ws = 0, bt = 0, wt = 0;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 'black') bs++;
      else if (board[r][c] === 'white') ws++;
    }
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) {
      const i = r * size + c;
      if (board[r][c] !== null || visited.has(i)) continue;
      const region: number[] = [];
      let bBorder = false, wBorder = false;
      const q = [i];
      while (q.length > 0) {
        const idx = q.pop()!;
        if (visited.has(idx)) continue;
        const cr = (idx / size) | 0, cc = idx % size;
        const s = board[cr][cc];
        if (s !== null) { if (s === 'black') bBorder = true; else wBorder = true; continue; }
        visited.add(idx);
        region.push(idx);
        for (const nb of getNeighbors({ row: cr, col: cc }, size)) q.push(nb.row * size + nb.col);
      }
      if (bBorder && !wBorder) bt += region.length;
      else if (wBorder && !bBorder) wt += region.length;
    }
  return (bs + bt) - (ws + wt);
}

function playout(board: (Stone | null)[][], player: Stone, size: number, maxMoves: number): number {
  let cur = player;
  const b = board.map(r => [...r]);
  let pass = 0, moves = 0;
  while (pass < 2 && moves < maxMoves) {
    // Collect legal moves quickly
    const moves_list: Position[] = [];
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (b[r][c] === null) {
          const res = simulateAndCapture(b, { row: r, col: c }, cur, size);
          if (res.valid) moves_list.push({ row: r, col: c });
        }
    if (moves_list.length === 0) { pass++; }
    else {
      pass = 0;
      const pos = moves_list[Math.floor(Math.random() * moves_list.length)];
      const res = simulateAndCapture(b, pos, cur, size);
      for (let r = 0; r < size; r++)
        for (let c = 0; c < size; c++) b[r][c] = res.board[r][c];
    }
    cur = cur === 'black' ? 'white' : 'black';
    moves++;
  }
  return estimateScore(b, size);
}

export function getAIMove(state: GameState): Position | null {
  const { board, boardSize: sz, currentPlayer: me, koPoint } = state;
  const opp: Stone = me === 'black' ? 'white' : 'black';
  const moveNum = state.history.length;

  // Collect all legal moves
  const legal: Position[] = [];
  for (let r = 0; r < sz; r++)
    for (let c = 0; c < sz; c++)
      if (board[r][c] === null) {
        if (koPoint && koPoint.row === r && koPoint.col === c) continue;
        const res = simulateAndCapture(board, { row: r, col: c }, me, sz);
        if (res.valid) legal.push({ row: r, col: c });
      }
  if (legal.length === 0) return null;

  // Opening: play star points
  if (moveNum === 0) {
    const stars = [[2,2],[2,sz-3],[sz>>1,sz>>1],[sz-3,2],[sz-3,sz-3]].filter(([r,c]) => board[r]?.[c] === null);
    if (stars.length) { const [r,c] = stars[Math.floor(Math.random() * stars.length)]; return { row: r, col: c }; }
  }

  // Score candidates heuristically
  const scored = legal.map(pos => {
    let s = 0;
    const res = simulateAndCapture(board, pos, me, sz);
    if (res.captured > 0) s += 50 + res.captured * 20;
    for (const nb of getNeighbors(pos, sz)) {
      if (board[nb.row][nb.col] === me) {
        const g = getGroup(board, nb, sz);
        const l = getLiberties(board, g, sz);
        if (l === 1) s += 40; else if (l === 2) s += 10;
      }
    }
    if (res.valid) {
      for (const nb of getNeighbors(pos, sz)) {
        if (res.board[nb.row]?.[nb.col] === opp) {
          const g = getGroup(res.board, nb, sz);
          if (getLiberties(res.board, g, sz) === 1) s += 25;
        }
      }
    }
    const edge = Math.min(pos.row, pos.col, sz - 1 - pos.row, sz - 1 - pos.col);
    if (moveNum < sz * 4) { if (edge === 0) s -= 8; else if (edge >= 2 && edge <= 4) s += 3; }
    let adj = 0;
    for (const nb of getNeighbors(pos, sz)) if (board[nb.row][nb.col] !== null) adj++;
    if (adj === 1) s += 5; else if (adj >= 3) s -= 10;
    return { pos, s };
  });
  scored.sort((a, b) => b.s - a.s);

  // MCTS on top candidates
  const sims = sz <= 9 ? 30 : sz <= 13 ? 15 : 8;
  const maxP = sz <= 9 ? 30 : sz <= 13 ? 40 : 50;
  const topN = Math.min(6, scored.length);
  let bestPos = scored[0].pos, bestWins = -1;

  for (let i = 0; i < topN; i++) {
    const { pos } = scored[i];
    const res = simulateAndCapture(board, pos, me, sz);
    if (!res.valid) continue;
    let wins = 0;
    for (let j = 0; j < sims; j++) {
      const sc = playout(res.board, opp, sz, maxP);
      if (me === 'black' ? sc > 0 : sc < 0) wins++;
    }
    if (wins > bestWins) { bestWins = wins; bestPos = pos; }
  }
  return bestPos;
}
