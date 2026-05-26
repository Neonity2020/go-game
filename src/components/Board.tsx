import { useRef, useEffect, useCallback, useState } from 'react';
import type { GameState, Position } from '../game/types';
import { isValidMove } from '../game/engine';

interface BoardProps {
  state: GameState;
  onMove: (pos: Position) => void;
  disabled?: boolean;
}

const STAR_POINTS: Record<number, [number, number][]> = {
  9: [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]],
  13: [[3, 3], [3, 6], [3, 9], [6, 3], [6, 6], [6, 9], [9, 3], [9, 6], [9, 9]],
  19: [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]],
};

const BOARD_LETTERS = 'ABCDEFGHJKLMNOPQRST';

function positionFromPointer(
  event: React.MouseEvent<HTMLCanvasElement>,
  boardSize: number,
): Position | null {
  const rect = event.currentTarget.getBoundingClientRect();
  const displaySize = rect.width;
  const padding = displaySize * 0.07;
  const cellSize = (displaySize - 2 * padding) / (boardSize - 1);
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const col = Math.round((x - padding) / cellSize);
  const row = Math.round((y - padding) / cellSize);
  const snapX = padding + col * cellSize;
  const snapY = padding + row * cellSize;
  const hitRadius = cellSize * 0.48;

  if (
    row < 0 ||
    row >= boardSize ||
    col < 0 ||
    col >= boardSize ||
    Math.abs(x - snapX) > hitRadius ||
    Math.abs(y - snapY) > hitRadius
  ) {
    return null;
  }

  return { row, col };
}

function drawStone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  stone: 'black' | 'white',
  alpha = 1,
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.arc(x + radius * 0.12, y + radius * 0.16, radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(37, 30, 19, 0.24)';
  ctx.fill();

  const grad = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.42,
    radius * 0.16,
    x,
    y,
    radius,
  );
  if (stone === 'black') {
    grad.addColorStop(0, '#57595f');
    grad.addColorStop(0.5, '#202126');
    grad.addColorStop(1, '#050506');
  } else {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#ece8df');
    grad.addColorStop(1, '#b9b4aa');
  }

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  if (stone === 'white') {
    ctx.strokeStyle = 'rgba(76, 70, 61, 0.45)';
    ctx.lineWidth = Math.max(1, radius * 0.08);
    ctx.stroke();
  }

  ctx.restore();
}

export default function Board({ state, onMove, disabled = false }: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hovered, setHovered] = useState<Position | null>(null);
  const { board, boardSize, lastMove, currentPlayer } = state;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const host = canvas.parentElement;
    const hostRect = host?.getBoundingClientRect();
    const hostStyle = host ? window.getComputedStyle(host) : null;
    const hostPadding = hostStyle
      ? parseFloat(hostStyle.paddingLeft) + parseFloat(hostStyle.paddingRight)
      : 0;
    const hostWidth = (hostRect?.width ?? window.innerWidth - 32) - hostPadding;
    const displaySize = Math.max(240, Math.min(680, hostWidth));
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    ctx.scale(dpr, dpr);

    const padding = displaySize * 0.07;
    const cellSize = (displaySize - 2 * padding) / (boardSize - 1);
    const boardEnd = padding + (boardSize - 1) * cellSize;

    const boardGradient = ctx.createLinearGradient(0, 0, displaySize, displaySize);
    boardGradient.addColorStop(0, '#e7bf72');
    boardGradient.addColorStop(0.52, '#d7a957');
    boardGradient.addColorStop(1, '#c89345');
    ctx.fillStyle = boardGradient;
    ctx.fillRect(0, 0, displaySize, displaySize);

    ctx.strokeStyle = 'rgba(109, 71, 26, 0.22)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const y = (i / 17) * displaySize;
      const wobble = Math.sin(i * 1.9) * displaySize * 0.014;
      ctx.beginPath();
      ctx.moveTo(0, y + wobble);
      ctx.bezierCurveTo(
        displaySize * 0.28,
        y - wobble,
        displaySize * 0.74,
        y + wobble,
        displaySize,
        y - wobble * 0.4,
      );
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(31, 26, 18, 0.82)';
    ctx.lineWidth = 1;
    for (let i = 0; i < boardSize; i++) {
      const pos = padding + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, boardEnd);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(boardEnd, pos);
      ctx.stroke();
    }

    const stars = STAR_POINTS[boardSize] || [];
    ctx.fillStyle = 'rgba(24, 20, 14, 0.9)';
    for (const [r, c] of stars) {
      ctx.beginPath();
      ctx.arc(padding + c * cellSize, padding + r * cellSize, Math.max(2, cellSize * 0.11), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(45, 33, 19, 0.62)';
    ctx.font = `${Math.max(10, cellSize * 0.32)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < boardSize; i++) {
      const label = BOARD_LETTERS[i];
      const pos = padding + i * cellSize;
      ctx.fillText(label, pos, padding * 0.42);
      ctx.fillText(label, pos, displaySize - padding * 0.42);
      ctx.fillText(String(boardSize - i), padding * 0.38, pos);
      ctx.fillText(String(boardSize - i), displaySize - padding * 0.38, pos);
    }

    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const stone = board[r][c];
        if (!stone) continue;
        const x = padding + c * cellSize;
        const y = padding + r * cellSize;
        const radius = cellSize * 0.44;
        drawStone(ctx, x, y, radius, stone);
      }
    }

    if (lastMove) {
      const x = padding + lastMove.col * cellSize;
      const y = padding + lastMove.row * cellSize;
      const markerColor = board[lastMove.row][lastMove.col] === 'black' ? '#f6efe1' : '#1f2024';
      ctx.beginPath();
      ctx.arc(x, y, cellSize * 0.18, 0, Math.PI * 2);
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = Math.max(2, cellSize * 0.06);
      ctx.stroke();
    }

    if (
      hovered &&
      !disabled &&
      !state.gameOver &&
      board[hovered.row][hovered.col] === null &&
      isValidMove(state, hovered)
    ) {
      drawStone(
        ctx,
        padding + hovered.col * cellSize,
        padding + hovered.row * cellSize,
        cellSize * 0.42,
        currentPlayer,
        0.46,
      );
    }
  }, [board, boardSize, currentPlayer, disabled, hovered, lastMove, state]);

  useEffect(() => {
    draw();
    const host = canvasRef.current?.parentElement;
    const observer = host ? new ResizeObserver(draw) : null;
    if (host && observer) observer.observe(host);
    window.addEventListener('resize', draw);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', draw);
    };
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const pos = positionFromPointer(e, boardSize);
    if (pos) onMove(pos);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const pos = positionFromPointer(e, boardSize);
    setHovered(prev => {
      if (!pos) return prev === null ? prev : null;
      if (prev?.row === pos.row && prev.col === pos.col) return prev;
      return pos;
    });
  };

  return (
    <div className="board-frame">
      <canvas
        ref={canvasRef}
        className={`board-canvas${disabled ? ' board-canvas-disabled' : ''}`}
        onClick={handleClick}
        onMouseMove={handlePointerMove}
        onMouseLeave={() => setHovered(null)}
        aria-label={`${boardSize} 路围棋棋盘`}
      />
    </div>
  );
}
