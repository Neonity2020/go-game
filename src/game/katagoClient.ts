import type { GameState, Position } from './types';

export type KataGoMoveResult = Position | 'resign' | null;

const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:3107';

function bridgeUrl() {
  return (import.meta.env.VITE_KATAGO_BRIDGE_URL || DEFAULT_BRIDGE_URL).replace(/\/$/, '');
}

function isPosition(value: unknown): value is Position {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isInteger((value as Position).row) &&
    Number.isInteger((value as Position).col)
  );
}

export async function getKataGoMove(state: GameState, komi: number): Promise<KataGoMoveResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(`${bridgeUrl()}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, komi }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`KataGo bridge returned ${response.status}`);
    }

    const data = await response.json() as { result?: unknown };
    if (data.result === 'resign') return 'resign';
    if (data.result === null || typeof data.result === 'undefined') return null;
    if (isPosition(data.result)) return data.result;
    throw new Error('KataGo bridge returned an invalid move');
  } finally {
    window.clearTimeout(timeout);
  }
}
