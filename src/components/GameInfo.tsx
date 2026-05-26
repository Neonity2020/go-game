import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Board from './Board';
import type { GameState, MoveRecord, Position, ScoreResult, Stone, AnalysisResult, AnalysisMove } from '../game/types';
import { calculateScore, createInitialState, isValidMove, pass, placeStone, resign, undo } from '../game/engine';
import { getKataGoMove, getKataGoAnalysis } from '../game/katagoClient';

type GameMode = 'pvp' | 'pve';
type AIEngine = 'katago' | 'browser';
type AIResult = Position | 'resign' | null;
type AIWorkerResponse = { id: number; result: AIResult };
type NigiriGuess = 'odd' | 'even';
type NigiriState =
  | { status: 'idle' }
  | { status: 'pending'; hiddenStones: number }
  | { status: 'revealed'; hiddenStones: number; guess: NigiriGuess; correct: boolean; humanColor: Stone };

const BOARD_SIZES = [9, 13, 19] as const;
const DEFAULT_KOMI = 6.5;
const BOARD_LETTERS = 'ABCDEFGHJKLMNOPQRST';

function createNigiri(): NigiriState {
  return {
    status: 'pending',
    hiddenStones: Math.floor(Math.random() * 10) + 1,
  };
}

function opponentOf(player: Stone): Stone {
  return player === 'black' ? 'white' : 'black';
}

function playerLabel(player: Stone, gameMode: GameMode, humanColor: Stone) {
  if (gameMode === 'pve') return player === humanColor ? '你' : 'AI';
  return player === 'black' ? '黑方' : '白方';
}

function colorLabel(player: Stone) {
  return player === 'black' ? '黑' : '白';
}

function guessLabel(guess: NigiriGuess) {
  return guess === 'odd' ? '单数' : '双数';
}

function formatMove(record: MoveRecord, boardSize: number) {
  if (!record.position) return '弃权';
  const col = BOARD_LETTERS[record.position.col] ?? String(record.position.col + 1);
  return `${col}${boardSize - record.position.row}`;
}

function formatWinner(score: ScoreResult, gameMode: GameMode, humanColor: Stone) {
  if (score.winner === 'tie') return '平局';
  return `${playerLabel(score.winner, gameMode, humanColor)}领先`;
}

function scoreLead(score: ScoreResult) {
  const diff = Math.abs(score.blackTotal - score.whiteTotal);
  return diff.toFixed(1);
}

function aiEngineLabel(engine: AIEngine) {
  return engine === 'katago' ? 'KataGo' : '本地 AI';
}

export default function GameApp() {
  const [gameState, setGameState] = useState<GameState>(createInitialState(19));
  const [gameMode, setGameMode] = useState<GameMode>('pvp');
  const [aiEngine, setAiEngine] = useState<AIEngine>('katago');
  const [humanColor, setHumanColor] = useState<Stone>('black');
  const [nigiri, setNigiri] = useState<NigiriState>({ status: 'idle' });
  const [aiThinking, setAiThinking] = useState(false);
  const [komi, setKomi] = useState(DEFAULT_KOMI);
  const [notice, setNotice] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [hoveredAnalysisMove, setHoveredAnalysisMove] = useState<AnalysisMove | null>(null);
  const [winRateHistory, setWinRateHistory] = useState<{ moveNumber: number; blackWinrate: number }[]>([]);

  const { currentPlayer, captures, gameOver, passCount, boardSize, moveRecords } = gameState;

  useEffect(() => {
    let active = true;
    if (!showAnalysis || gameOver) {
      Promise.resolve().then(() => {
        if (active) setAnalysisResult(null);
      });
      return;
    }

    Promise.resolve().then(() => {
      if (active) {
        setAnalysisLoading(true);
        setNotice('');
      }
    });

    getKataGoAnalysis(gameState, komi, 800)
      .then(result => {
        if (!active) return;
        setAnalysisResult(result);
        setAnalysisLoading(false);

        const moveNumber = gameState.moveRecords.length;
        if (result.moves && result.moves.length > 0) {
          const bestMove = result.moves[0];
          const bestWinrate = bestMove.winrate;
          const blackWinrate = result.currentPlayer === 'black' ? bestWinrate : (100 - bestWinrate);
          setWinRateHistory(prev => {
            const filtered = prev.filter(p => p.moveNumber < moveNumber);
            return [...filtered, { moveNumber, blackWinrate }];
          });
        }
      })
      .catch(err => {
        if (!active) return;
        console.error('KataGo analysis error:', err);
        setAnalysisResult(null);
        setAnalysisLoading(false);
        setNotice('KataGo Bridge 未启动，请运行 npm run bridge');
      });

    return () => {
      active = false;
    };
  }, [gameState, komi, showAnalysis, gameOver]);
  const workerRef = useRef<Worker | null>(null);
  const aiPendingRef = useRef(false);
  const aiRequestIdRef = useRef(0);

  const moveCount = moveRecords.length;
  const nigiriPending = gameMode === 'pve' && nigiri.status === 'pending';
  const isAiTurn = gameMode === 'pve' && !nigiriPending && currentPlayer !== humanColor && !gameOver;
  const boardDisabled = gameOver || aiThinking || isAiTurn || nigiriPending;

  const score = useMemo(() => calculateScore(gameState, komi), [gameState, komi]);
  const boardFill = useMemo(() => {
    const occupied = gameState.board.reduce(
      (sum, row) => sum + row.filter(Boolean).length,
      0,
    );
    return Math.round((occupied / (boardSize * boardSize)) * 100);
  }, [boardSize, gameState.board]);
  const recentMoves = moveRecords.slice(-10).reverse();

  const applyAIResult = useCallback((aiResult: AIResult) => {
    if (aiResult === 'resign') {
      setGameState(prev => resign(prev));
    } else if (aiResult) {
      setGameState(prev => placeStone(prev, aiResult));
    } else {
      setGameState(prev => pass(prev));
    }
    setAiThinking(false);
    aiPendingRef.current = false;
  }, []);

  const handleMove = useCallback((pos: Position) => {
    if (gameMode === 'pve' && currentPlayer !== humanColor) return;
    if (!isValidMove(gameState, pos)) {
      setNotice('该位置不可落子');
      return;
    }
    setNotice('');
    setGameState(prev => placeStone(prev, pos));
  }, [currentPlayer, gameMode, gameState, humanColor]);

  const handlePass = () => {
    if (gameMode === 'pve' && currentPlayer !== humanColor) return;
    setNotice('');
    setGameState(prev => pass(prev));
  };

  const handleResign = () => {
    setNotice('');
    setGameState(prev => resign(prev));
  };

  const handleUndo = () => {
    if (aiThinking || moveRecords.length === 0) return;
    setNotice('');
    aiRequestIdRef.current += 1;
    setGameState(prev => {
      let next = undo(prev);
      if (gameMode === 'pve' && next.currentPlayer !== humanColor && next.moveRecords.length > 0) {
        next = undo(next);
      }
      return next;
    });
  };

  const handleNigiriGuess = (guess: NigiriGuess) => {
    if (nigiri.status !== 'pending') return;
    const correct = (nigiri.hiddenStones % 2 === 1 && guess === 'odd') ||
      (nigiri.hiddenStones % 2 === 0 && guess === 'even');
    const nextHumanColor: Stone = correct ? 'black' : 'white';
    setHumanColor(nextHumanColor);
    setNigiri({
      status: 'revealed',
      hiddenStones: nigiri.hiddenStones,
      guess,
      correct,
      humanColor: nextHumanColor,
    });
    setNotice(correct ? '猜中，你执黑先行' : '未猜中，你执白后行');
  };

  const handleNewGame = (size: number, mode: GameMode) => {
    setGameMode(mode);
    setAiThinking(false);
    setNotice('');
    setHumanColor('black');
    setNigiri(mode === 'pve' ? createNigiri() : { status: 'idle' });
    aiRequestIdRef.current += 1;
    aiPendingRef.current = false;
    setWinRateHistory([]);
    setAnalysisResult(null);
    setGameState(createInitialState(size));
  };

  useEffect(() => {
    workerRef.current = new Worker(new URL('../game/aiWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e: MessageEvent<AIWorkerResponse>) => {
      if (e.data.id !== aiRequestIdRef.current) return;
      applyAIResult(e.data.result);
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, [applyAIResult]);

  useEffect(() => {
    if (!isAiTurn || aiPendingRef.current) return;
    aiPendingRef.current = true;
    setAiThinking(true);
    setNotice('');
    const requestId = aiRequestIdRef.current + 1;
    aiRequestIdRef.current = requestId;

    if (aiEngine === 'katago') {
      getKataGoMove(gameState, komi)
        .then(result => {
          if (requestId !== aiRequestIdRef.current) return;
          applyAIResult(result);
        })
        .catch(() => {
          if (requestId !== aiRequestIdRef.current) return;
          setNotice('KataGo bridge 未连接，已改用本地 AI');
          workerRef.current?.postMessage({ id: requestId, state: gameState });
        });
      return;
    }

    workerRef.current?.postMessage({ id: requestId, state: gameState });
  }, [aiEngine, applyAIResult, gameState, isAiTurn, komi]);

  const statusText = () => {
    if (nigiriPending) return '猜先决定执黑';
    if (gameOver) {
      if (passCount >= 2) return `终局，${formatWinner(score, gameMode, humanColor)} ${scoreLead(score)} 目`;
      return `${playerLabel(opponentOf(currentPlayer), gameMode, humanColor)}获胜，对方认输`;
    }
    if (aiThinking) return `${aiEngineLabel(aiEngine)} 正在计算`;
    return `${playerLabel(currentPlayer, gameMode, humanColor)}落子`;
  };

  const statusTone = gameOver || nigiriPending ? 'status-ended' : currentPlayer === 'black' ? 'status-black' : 'status-white';
  const playerColorText = gameMode === 'pve' && !nigiriPending ? `你执${colorLabel(humanColor)}` : null;

  const renderWinRateChart = () => {
    if (winRateHistory.length < 2) return null;
    
    const width = 300;
    const height = 65;
    const padding = { top: 5, right: 5, bottom: 5, left: 25 };
    
    const maxX = Math.max(...winRateHistory.map(p => p.moveNumber));
    const minX = 0;
    
    const getX = (xVal: number) => {
      if (maxX === minX) return padding.left;
      return padding.left + ((xVal - minX) / (maxX - minX)) * (width - padding.left - padding.right);
    };
    
    const getY = (yVal: number) => {
      return padding.top + (1 - yVal / 100) * (height - padding.top - padding.bottom);
    };

    let linePath = '';
    let areaPath = '';
    
    winRateHistory.forEach((pt, idx) => {
      const cx = getX(pt.moveNumber);
      const cy = getY(pt.blackWinrate);
      
      if (idx === 0) {
        linePath = `M ${cx} ${cy}`;
        areaPath = `M ${cx} ${getY(50)} L ${cx} ${cy}`;
      } else {
        linePath += ` L ${cx} ${cy}`;
        areaPath += ` L ${cx} ${cy}`;
      }
      
      if (idx === winRateHistory.length - 1) {
        areaPath += ` L ${cx} ${getY(50)} Z`;
      }
    });

    const midY = getY(50);

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="winrateAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34, 197, 94, 0.4)" />
            <stop offset="100%" stopColor="rgba(56, 189, 248, 0.1)" />
          </linearGradient>
        </defs>
        
        <line x1={padding.left} y1={midY} x2={width - padding.right} y2={midY} stroke="rgba(55, 50, 43, 0.15)" strokeWidth={1} strokeDasharray="3,3" />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="rgba(55, 50, 43, 0.15)" strokeWidth={1} />
        
        <text x={padding.left - 5} y={padding.top + 4} fill="#8a8377" fontSize={8} textAnchor="end">B 100%</text>
        <text x={padding.left - 5} y={midY + 3} fill="#8a8377" fontSize={8} textAnchor="end">50%</text>
        <text x={padding.left - 5} y={height - padding.bottom} fill="#8a8377" fontSize={8} textAnchor="end">W 100%</text>

        <path d={areaPath} fill="url(#winrateAreaGrad)" />
        <path d={linePath} fill="none" stroke="#22c55e" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />

        {winRateHistory.length > 0 && (
          <circle
            cx={getX(winRateHistory[winRateHistory.length - 1].moveNumber)}
            cy={getY(winRateHistory[winRateHistory.length - 1].blackWinrate)}
            r={3.5}
            fill="#22c55e"
            stroke="#ffffff"
            strokeWidth={1.2}
          />
        )}
      </svg>
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="" className="brand-logo" />
          <div>
            <h1>围棋</h1>
            <p>{gameMode === 'pve' ? '人机对弈' : '双人对弈'} · {boardSize} 路棋盘{playerColorText ? ` · ${playerColorText}` : ''}</p>
          </div>
        </div>

        <div className="quick-stats" aria-label="对局概要">
          <span>第 {moveCount} 手</span>
          <span>占用 {boardFill}%</span>
          <span>贴目 {komi.toFixed(1)}</span>
        </div>
      </header>

      <main className="game-layout">
        <section className="board-section" aria-label="棋盘">
          <Board
            state={gameState}
            onMove={handleMove}
            disabled={boardDisabled}
            analysis={analysisResult}
            showAnalysis={showAnalysis}
            hoveredAnalysisMove={hoveredAnalysisMove}
          />
        </section>

        <aside className="side-panel">
          <section className="status-block">
            <div className={`turn-chip ${statusTone}`}>
              {!gameOver && !aiThinking && !nigiriPending && <span className={`stone-dot ${currentPlayer}`} />}
              {aiThinking && <span className="spinner" />}
              <span>{statusText()}</span>
            </div>
            {notice && <div className="notice">{notice}</div>}
          </section>

          {gameMode === 'pve' && (
            <section className="panel-section nigiri-card">
              <div className="section-heading">
                <h2>猜先</h2>
                {nigiri.status === 'revealed' && <span>{nigiri.correct ? '猜中' : '未中'}</span>}
              </div>
              {nigiri.status === 'pending' && (
                <>
                  <div className="nigiri-stones" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="nigiri-actions">
                    <button type="button" onClick={() => handleNigiriGuess('odd')}>单数</button>
                    <button type="button" onClick={() => handleNigiriGuess('even')}>双数</button>
                  </div>
                </>
              )}
              {nigiri.status === 'revealed' && (
                <div className="nigiri-result">
                  <span>AI 取子 {nigiri.hiddenStones}</span>
                  <span>你猜 {guessLabel(nigiri.guess)}</span>
                  <strong>你执{colorLabel(nigiri.humanColor)}</strong>
                </div>
              )}
            </section>
          )}

          <section className="panel-section captures-grid" aria-label="提子数">
            <div>
              <span className="section-label">{playerLabel('black', gameMode, humanColor)}</span>
              <strong>{captures.black}</strong>
              <small>黑方提子</small>
            </div>
            <div>
              <span className="section-label">{playerLabel('white', gameMode, humanColor)}</span>
              <strong>{captures.white}</strong>
              <small>白方提子</small>
            </div>
          </section>

          <section className="panel-section action-row" aria-label="对局操作">
            <button type="button" onClick={handleUndo} disabled={aiThinking || moveRecords.length === 0}>
              悔棋
            </button>
            <button type="button" onClick={handlePass} disabled={boardDisabled}>
              弃权
            </button>
            <button type="button" className="danger-button" onClick={handleResign} disabled={gameOver || nigiriPending}>
              认输
            </button>
          </section>

          <section className="panel-section ai-analysis-card">
            <div className="section-heading">
              <h2>AI 智能复盘</h2>
              <button
                type="button"
                className={`analysis-toggle-btn ${showAnalysis ? 'active' : ''}`}
                onClick={() => {
                  setShowAnalysis(!showAnalysis);
                  setHoveredAnalysisMove(null);
                }}
              >
                {showAnalysis ? '已开启' : '已关闭'}
              </button>
            </div>
            
            {showAnalysis && (
              <div className="analysis-box">
                {analysisLoading && (
                  <div className="analysis-spinner-box">
                    <span className="spinner" />
                    <span>KataGo 深度分析中...</span>
                  </div>
                )}
                
                {!analysisLoading && !analysisResult && (
                  <div className="analysis-status-msg">
                    <span>暂无分析数据，请确保 KataGo Bridge 已运行</span>
                  </div>
                )}

                {!analysisLoading && analysisResult && analysisResult.moves && (
                  <div className="analysis-details">
                    {winRateHistory.length > 1 && (
                      <div className="winrate-history-chart">
                        <div className="chart-heading">胜率曲线</div>
                        <div className="chart-svg-container">
                          {renderWinRateChart()}
                        </div>
                      </div>
                    )}

                    <div className="ai-candidates">
                      <div className="candidates-heading">推荐候选落子点</div>
                      <ol className="candidates-list">
                        {analysisResult.moves.slice(0, 4).map((move, idx) => (
                          <li
                            key={idx}
                            className={`candidate-list-item rank-${idx + 1}`}
                            onMouseEnter={() => setHoveredAnalysisMove(move)}
                            onMouseLeave={() => setHoveredAnalysisMove(null)}
                          >
                            <span className="rank-num">#{idx + 1}</span>
                            <span className="coord-text">{move.gtpMove}</span>
                            <div className="candidate-stats">
                              <span className="rate-text">{Math.round(move.winrate)}% 胜率</span>
                              <span className="lead-text">
                                {move.scoreLead > 0 ? `+${move.scoreLead.toFixed(1)}` : move.scoreLead.toFixed(1)} 目
                              </span>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <div className="analysis-card-footer">💡 悬停在候选点上可在棋盘预览后续变化图 (PV)</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <h2>形势</h2>
              <label className="komi-control">
                贴目
                <input
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  value={komi}
                  onChange={event => setKomi(Number(event.target.value) || 0)}
                />
              </label>
            </div>
            <div className="score-summary">
              <div>
                <span>黑</span>
                <strong>{score.blackTotal.toFixed(1)}</strong>
                <small>子 {score.blackStones} · 空 {score.blackTerritory}</small>
              </div>
              <div>
                <span>白</span>
                <strong>{score.whiteTotal.toFixed(1)}</strong>
                <small>子 {score.whiteStones} · 空 {score.whiteTerritory}</small>
              </div>
            </div>
            <p className="score-lead">
              {formatWinner(score, gameMode, humanColor)} {scoreLead(score)} 目
            </p>
          </section>

          <section className="panel-section">
            <div className="section-heading">
              <h2>新对局</h2>
            </div>
            <div className="segmented-control" role="group" aria-label="对局模式">
              <button
                type="button"
                className={gameMode === 'pvp' ? 'active' : ''}
                onClick={() => handleNewGame(boardSize, 'pvp')}
              >
                双人
              </button>
              <button
                type="button"
                className={gameMode === 'pve' ? 'active' : ''}
                onClick={() => handleNewGame(boardSize, 'pve')}
              >
                人机
              </button>
            </div>
            <div className="segmented-control size-control" role="group" aria-label="棋盘尺寸">
              {BOARD_SIZES.map(size => (
                <button
                  key={size}
                  type="button"
                  className={boardSize === size ? 'active' : ''}
                  onClick={() => handleNewGame(size, gameMode)}
                >
                  {size}路
                </button>
              ))}
            </div>
          </section>

          {gameMode === 'pve' && (
            <section className="panel-section">
              <div className="section-heading">
                <h2>AI 引擎</h2>
              </div>
              <div className="segmented-control" role="group" aria-label="AI 引擎">
                <button
                  type="button"
                  className={aiEngine === 'katago' ? 'active' : ''}
                  onClick={() => setAiEngine('katago')}
                  disabled={aiThinking}
                >
                  KataGo
                </button>
                <button
                  type="button"
                  className={aiEngine === 'browser' ? 'active' : ''}
                  onClick={() => setAiEngine('browser')}
                  disabled={aiThinking}
                >
                  本地
                </button>
              </div>
            </section>
          )}

          <section className="panel-section move-list-section">
            <div className="section-heading">
              <h2>手顺</h2>
              <span>{moveCount ? `最近 ${recentMoves.length} 手` : '暂无'}</span>
            </div>
            <ol className="move-list">
              {recentMoves.map(record => (
                <li key={record.moveNumber}>
                  <span>{record.moveNumber}</span>
                  <b>{playerLabel(record.player, gameMode, humanColor)}</b>
                  <em>{formatMove(record, boardSize)}</em>
                  {record.captures > 0 && <small>提 {record.captures}</small>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </main>
    </div>
  );
}
