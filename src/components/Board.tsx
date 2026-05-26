import { useRef, useEffect, useCallback } from 'react';
import type { GameState, Position } from '../game/types';

interface BoardProps {
  state: GameState;
  onMove: (pos: Position) => void;
}

const STAR_POINTS: Record<number, [number, number][]> = {
  9: [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]],
  13: [[3, 3], [3, 6], [3, 9], [6, 3], [6, 6], [6, 9], [9, 3], [9, 6], [9, 9]],
  19: [[3, 3], [3, 9], [3, 15], [9, 3], [9, 9], [9, 15], [15, 3], [15, 9], [15, 15]],
};

export default function Board({ state, onMove }: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { board, boardSize, lastMove } = state;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displaySize = Math.min(600, window.innerWidth - 40);
    canvas.style.width = `${displaySize}px`;
    canvas.style.height = `${displaySize}px`;
    canvas.width = displaySize * dpr;
    canvas.height = displaySize * dpr;
    ctx.scale(dpr, dpr);

    const padding = displaySize * 0.04;
    const cellSize = (displaySize - 2 * padding) / (boardSize - 1);

    // Background
    ctx.fillStyle = '#DCB35C';
    ctx.fillRect(0, 0, displaySize, displaySize);

    // Grid lines
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < boardSize; i++) {
      const pos = padding + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, padding + (boardSize - 1) * cellSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(padding + (boardSize - 1) * cellSize, pos);
      ctx.stroke();
    }

    // Star points
    const stars = STAR_POINTS[boardSize] || [];
    ctx.fillStyle = '#1a1a1a';
    for (const [r, c] of stars) {
      ctx.beginPath();
      ctx.arc(padding + c * cellSize, padding + r * cellSize, cellSize * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stones
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const stone = board[r][c];
        if (!stone) continue;
        const x = padding + c * cellSize;
        const y = padding + r * cellSize;
        const radius = cellSize * 0.44;

        // Shadow
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Stone
        const grad = ctx.createRadialGradient(
          x - radius * 0.3, y - radius * 0.3, radius * 0.1,
          x, y, radius
        );
        if (stone === 'black') {
          grad.addColorStop(0, '#555');
          grad.addColorStop(1, '#111');
        } else {
          grad.addColorStop(0, '#fff');
          grad.addColorStop(1, '#ccc');
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    // Last move marker
    if (lastMove) {
      const x = padding + lastMove.col * cellSize;
      const y = padding + lastMove.row * cellSize;
      ctx.beginPath();
      ctx.arc(x, y, cellSize * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = board[lastMove.row][lastMove.col] === 'black' ? '#fff' : '#111';
      ctx.fill();
    }
  }, [board, boardSize, lastMove]);

  useEffect(() => {
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [draw]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const displaySize = rect.width;
    const padding = displaySize * 0.04;
    const cellSize = (displaySize - 2 * padding) / (boardSize - 1);

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.round((x - padding) / cellSize);
    const row = Math.round((y - padding) / cellSize);

    if (row >= 0 && row < boardSize && col >= 0 && col < boardSize) {
      onMove({ row, col });
    }
  };

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ cursor: 'pointer', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}
    />
  );
}
