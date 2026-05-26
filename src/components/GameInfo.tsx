import { useState, useEffect, useCallback, useRef } from 'react';
import Board from './Board';
import type { GameState, Position } from '../game/types';
import { createInitialState, placeStone, pass, resign } from '../game/engine';

type GameMode = 'pvp' | 'pve';

const BOARD_SIZES = [9, 13, 19] as const;

export default function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState(19));
  const [gameMode, setGameMode] = useState<GameMode>('pvp');
  const [aiThinking, setAiThinking] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const aiPendingRef = useRef(false);

  const { currentPlayer, captures, gameOver, passCount, boardSize } = gameState;
  const moveCount = gameState.history.length;

  const isAiTurn = gameMode === 'pve' && currentPlayer === 'white' && !gameOver;

  const handleMove = useCallback((pos: { row: number; col: number }) => {
    if (gameMode === 'pve' && currentPlayer === 'white') return;
    setGameState(prev => placeStone(prev, pos));
  }, [gameMode, currentPlayer]);

  const handlePass = () => {
    if (gameMode === 'pve' && currentPlayer === 'white') return;
    setGameState(prev => pass(prev));
  };

  const handleResign = () => {
    setGameState(prev => resign(prev));
  };

  const handleNewGame = (size: number, mode: GameMode) => {
    setGameMode(mode);
    setAiThinking(false);
    aiPendingRef.current = false;
    setGameState(createInitialState(size));
  };

  // Init worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../game/aiWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e: MessageEvent<Position | 'resign' | null>) => {
      const aiResult = e.data;
      if (aiResult === 'resign') {
        setGameState(prev => resign(prev));
      } else if (aiResult) {
        setGameState(prev => placeStone(prev, aiResult));
      } else {
        setGameState(prev => pass(prev));
      }
      setAiThinking(false);
      aiPendingRef.current = false;
    };
    return () => { workerRef.current?.terminate(); };
  }, []);

  // AI move
  useEffect(() => {
    if (!isAiTurn || aiPendingRef.current) return;
    aiPendingRef.current = true;
    setAiThinking(true);
    workerRef.current?.postMessage({ state: gameState });
  }, [isAiTurn, gameState]);

  const statusText = () => {
    if (gameOver) {
      if (passCount >= 2) return '对局结束（双方弃权）';
      return `${currentPlayer === 'black' ? '白方' : '黑方'}获胜（对方认输）`;
    }
    if (aiThinking) return 'AI 思考中...';
    const playerName = gameMode === 'pve'
      ? (currentPlayer === 'black' ? '你' : 'AI')
      : (currentPlayer === 'black' ? '黑方' : '白方');
    return `${playerName}落子`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <img src="/logo.png" alt="围棋" style={styles.logo} />
        <h1 style={styles.title}>围棋</h1>
      </div>

      <div style={styles.main}>
        <Board state={gameState} onMove={handleMove} />

        <div style={styles.panel}>
          <div style={styles.status}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              {!gameOver && !aiThinking && (
                <span style={{
                  ...styles.stoneIndicator,
                  background: currentPlayer === 'black'
                    ? 'radial-gradient(circle at 35% 35%, #555, #111)'
                    : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                  border: currentPlayer === 'white' ? '1px solid #999' : 'none',
                }} />
              )}
              {aiThinking && <span style={styles.spinner} />}
              {statusText()}
            </span>
          </div>

          <div style={styles.captures}>
            <div style={styles.captureItem}>
              <span style={{ ...styles.captureStone, background: 'radial-gradient(circle at 35% 35%, #555, #111)' }} />
              {gameMode === 'pve' ? '你' : '黑方'}提子: {captures.black}
            </div>
            <div style={styles.captureItem}>
              <span style={{ ...styles.captureStone, background: 'radial-gradient(circle at 35% 35%, #fff, #ccc)', border: '1px solid #999' }} />
              {gameMode === 'pve' ? 'AI' : '白方'}提子: {captures.white}
            </div>
          </div>

          <div style={styles.moveCount}>第 {moveCount} 手</div>

          {!gameOver && !aiThinking && (
            <div style={styles.actions}>
              <button onClick={handlePass} style={styles.button}>弃权 (Pass)</button>
              <button onClick={handleResign} style={{ ...styles.button, ...styles.resignButton }}>认输</button>
            </div>
          )}

          <div style={styles.newGame}>
            <div style={styles.newGameLabel}>新对局</div>
            <div style={styles.modeButtons}>
              <button
                onClick={() => handleNewGame(boardSize, 'pvp')}
                style={{ ...styles.modeButton, ...(gameMode === 'pvp' ? styles.modeButtonActive : {}) }}
              >
                双人对战
              </button>
              <button
                onClick={() => handleNewGame(boardSize, 'pve')}
                style={{ ...styles.modeButton, ...(gameMode === 'pve' ? styles.modeButtonActive : {}) }}
              >
                人机对战
              </button>
            </div>
            <div style={styles.sizeButtons}>
              {BOARD_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => handleNewGame(size, gameMode)}
                  style={{
                    ...styles.sizeButton,
                    ...(boardSize === size ? styles.sizeButtonActive : {}),
                  }}
                >
                  {size}×{size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const spinnerKeyframes = `
@keyframes spin {
  to { transform: rotate(360deg); }
}
`;
const styleSheet = document.createElement('style');
styleSheet.textContent = spinnerKeyframes;
document.head.appendChild(styleSheet);

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#1a1a2e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#e0e0e0',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 600,
    color: '#f0d060',
    letterSpacing: '8px',
  },
  main: {
    display: 'flex',
    gap: '24px',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  panel: {
    background: '#16213e',
    borderRadius: '12px',
    padding: '24px',
    minWidth: '220px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    border: '1px solid #2a3a5e',
  },
  status: {
    fontSize: '18px',
    fontWeight: 600,
    textAlign: 'center' as const,
    padding: '8px',
  },
  spinner: {
    display: 'inline-block',
    width: 16,
    height: 16,
    border: '2px solid #2a3a5e',
    borderTopColor: '#f0d060',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  stoneIndicator: {
    display: 'inline-block',
    width: 20,
    height: 20,
    borderRadius: '50%',
    verticalAlign: 'middle',
  },
  captures: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  captureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: '14px',
  },
  captureStone: {
    display: 'inline-block',
    width: 16,
    height: 16,
    borderRadius: '50%',
    flexShrink: 0,
  },
  moveCount: {
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#888',
  },
  actions: {
    display: 'flex',
    gap: 8,
  },
  button: {
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderRadius: 8,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    background: '#2a3a5e',
    color: '#e0e0e0',
    transition: 'background 0.2s',
  },
  resignButton: {
    background: '#5e2a2a',
  },
  newGame: {
    borderTop: '1px solid #2a3a5e',
    paddingTop: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 8,
  },
  newGameLabel: {
    fontSize: '14px',
    color: '#888',
  },
  modeButtons: {
    display: 'flex',
    gap: 6,
  },
  modeButton: {
    flex: 1,
    padding: '8px',
    border: '1px solid #2a3a5e',
    borderRadius: 6,
    background: 'transparent',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    transition: 'all 0.2s',
  },
  modeButtonActive: {
    background: '#2a3a5e',
    color: '#f0d060',
    borderColor: '#f0d060',
  },
  sizeButtons: {
    display: 'flex',
    gap: 6,
  },
  sizeButton: {
    flex: 1,
    padding: '8px',
    border: '1px solid #2a3a5e',
    borderRadius: 6,
    background: 'transparent',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '13px',
    transition: 'all 0.2s',
  },
  sizeButtonActive: {
    background: '#2a3a5e',
    color: '#f0d060',
    borderColor: '#f0d060',
  },
};
