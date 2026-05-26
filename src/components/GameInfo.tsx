import { useState } from 'react';
import Board from './Board';
import type { GameState } from '../game/types';
import { createInitialState, placeStone, pass, resign } from '../game/engine';

const BOARD_SIZES = [9, 13, 19] as const;

export default function App() {
  const [gameState, setGameState] = useState<GameState>(createInitialState(19));

  const handleMove = (pos: { row: number; col: number }) => {
    setGameState(prev => placeStone(prev, pos));
  };

  const handlePass = () => {
    setGameState(prev => pass(prev));
  };

  const handleResign = () => {
    setGameState(prev => resign(prev));
  };

  const handleNewGame = (size: number) => {
    setGameState(createInitialState(size));
  };

  const { currentPlayer, captures, gameOver, passCount, boardSize } = gameState;
  const moveCount = gameState.history.length;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>围棋</h1>

      <div style={styles.main}>
        <Board state={gameState} onMove={handleMove} />

        <div style={styles.panel}>
          <div style={styles.status}>
            {gameOver ? (
              passCount >= 2 ? (
                <span>对局结束（双方弃权）</span>
              ) : (
                <span>
                  {currentPlayer === 'black' ? '白方' : '黑方'}获胜（对方认输）
                </span>
              )
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  ...styles.stoneIndicator,
                  background: currentPlayer === 'black'
                    ? 'radial-gradient(circle at 35% 35%, #555, #111)'
                    : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
                  border: currentPlayer === 'white' ? '1px solid #999' : 'none',
                }} />
                {currentPlayer === 'black' ? '黑方' : '白方'}落子
              </span>
            )}
          </div>

          <div style={styles.captures}>
            <div style={styles.captureItem}>
              <span style={{ ...styles.captureStone, background: 'radial-gradient(circle at 35% 35%, #555, #111)' }} />
              黑方提子: {captures.black}
            </div>
            <div style={styles.captureItem}>
              <span style={{ ...styles.captureStone, background: 'radial-gradient(circle at 35% 35%, #fff, #ccc)', border: '1px solid #999' }} />
              白方提子: {captures.white}
            </div>
          </div>

          <div style={styles.moveCount}>第 {moveCount} 手</div>

          {!gameOver && (
            <div style={styles.actions}>
              <button onClick={handlePass} style={styles.button}>弃权 (Pass)</button>
              <button onClick={handleResign} style={{ ...styles.button, ...styles.resignButton }}>认输</button>
            </div>
          )}

          <div style={styles.newGame}>
            <div style={styles.newGameLabel}>新对局</div>
            <div style={styles.sizeButtons}>
              {BOARD_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => handleNewGame(size)}
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
  title: {
    margin: '0 0 20px 0',
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
  },
  newGameLabel: {
    fontSize: '14px',
    color: '#888',
    marginBottom: 8,
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
