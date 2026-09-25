import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  RotateCcw,
  Trophy,
  Bot,
  Users,
  Volume2,
  VolumeX,
  Sparkles,
  ArrowLeft,
  Flame,
  Zap,
} from 'lucide-react';

type Player = 'X' | 'O';
type CellValue = Player | null;
type BoardState = CellValue[];
type GameMode = 'ai' | 'pvp';
type Difficulty = 'easy' | 'medium' | 'hard';

const WINNING_COMBOS = [
  [0, 1, 2], // Row 1
  [3, 4, 5], // Row 2
  [6, 7, 8], // Row 3
  [0, 3, 6], // Col 1
  [1, 4, 7], // Col 2
  [2, 5, 8], // Col 3
  [0, 4, 8], // Diag 1
  [2, 4, 6], // Diag 2
];

// Web Audio API Synthesizer for rich interactive game sounds without external audio assets
class SoundFX {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playMove(player: Player) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const freq = player === 'X' ? 523.25 : 659.25; // C5 vs E5
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  playWin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = this.ctx.currentTime + idx * 0.1;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    });
  }

  playDraw() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(150, this.ctx.currentTime + 0.25);
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }
}

const sounds = new SoundFX();

export const TicTacToePage: React.FC<{ onNavigate?: (path: string) => void }> = ({ onNavigate }) => {
  const [board, setBoard] = useState<BoardState>(Array(9).fill(null));
  const [turn, setTurn] = useState<Player>('X');
  const [winner, setWinner] = useState<Player | 'draw' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Settings
  const [gameMode, setGameMode] = useState<GameMode>('ai');
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Stats
  const [scores, setScores] = useState({ x: 0, o: 0, draws: 0, streak: 0 });
  const [history, setHistory] = useState<BoardState[]>([]);

  // Canvas ref for victory particle fireworks
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Check victory status
  const checkWinner = useCallback((currentBoard: BoardState): { winner: Player | 'draw' | null; line: number[] | null } => {
    for (const combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (currentBoard[a] && currentBoard[a] === currentBoard[b] && currentBoard[a] === currentBoard[c]) {
        return { winner: currentBoard[a] as Player, line: combo };
      }
    }
    if (currentBoard.every((cell) => cell !== null)) {
      return { winner: 'draw', line: null };
    }
    return { winner: null, line: null };
  }, []);

  // Launch particle confetti
  const launchConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
    }> = [];

    const colors = ['#06B6D4', '#F43F5E', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.5) * 12 - 4,
        size: Math.random() * 7 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
      });
    }

    let frame = 0;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let active = false;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.alpha -= 0.015;

        if (p.alpha > 0) {
          active = true;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      });

      frame++;
      if (active && frame < 120) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    animate();
  }, []);

  // Minimax algorithm for unbeatable AI
  const minimax = useCallback((b: BoardState, depth: number, isMaximizing: boolean): { score: number; index?: number } => {
    const res = checkWinner(b);
    if (res.winner === 'O') return { score: 10 - depth };
    if (res.winner === 'X') return { score: depth - 10 };
    if (res.winner === 'draw') return { score: 0 };

    const availableIndices = b.map((val, idx) => (val === null ? idx : null)).filter((val): val is number => val !== null);

    if (isMaximizing) {
      let maxScore = -Infinity;
      let bestMove = availableIndices[0];
      for (const idx of availableIndices) {
        b[idx] = 'O';
        const evaluation = minimax(b, depth + 1, false);
        b[idx] = null;
        if (evaluation.score > maxScore) {
          maxScore = evaluation.score;
          bestMove = idx;
        }
      }
      return { score: maxScore, index: bestMove };
    } else {
      let minScore = Infinity;
      let bestMove = availableIndices[0];
      for (const idx of availableIndices) {
        b[idx] = 'X';
        const evaluation = minimax(b, depth + 1, true);
        b[idx] = null;
        if (evaluation.score < minScore) {
          minScore = evaluation.score;
          bestMove = idx;
        }
      }
      return { score: minScore, index: bestMove };
    }
  }, [checkWinner]);

  // AI Move calculation based on selected difficulty
  const getAiMove = useCallback((currentBoard: BoardState): number => {
    const available = currentBoard.map((val, idx) => (val === null ? idx : null)).filter((val): val is number => val !== null);

    if (available.length === 0) return -1;

    // Easy: purely random
    if (difficulty === 'easy') {
      return available[Math.floor(Math.random() * available.length)];
    }

    // Medium: check if AI can win or block player, else random
    if (difficulty === 'medium') {
      // 1. Can AI win immediately?
      for (const idx of available) {
        currentBoard[idx] = 'O';
        if (checkWinner(currentBoard).winner === 'O') {
          currentBoard[idx] = null;
          return idx;
        }
        currentBoard[idx] = null;
      }
      // 2. Can player win immediately? Block them!
      for (const idx of available) {
        currentBoard[idx] = 'X';
        if (checkWinner(currentBoard).winner === 'X') {
          currentBoard[idx] = null;
          return idx;
        }
        currentBoard[idx] = null;
      }
      // 3. Otherwise 50% random or take center
      if (currentBoard[4] === null && Math.random() > 0.4) return 4;
      return available[Math.floor(Math.random() * available.length)];
    }

    // Hard: Minimax (Mathematically flawless)
    const { index } = minimax(currentBoard, 0, true);
    return index ?? available[0];
  }, [difficulty, checkWinner, minimax]);

  // Handle cell click by human player
  const handleCellClick = (index: number) => {
    if (board[index] !== null || winner !== null || isAiThinking) return;

    sounds.playMove(turn);
    const newBoard = [...board];
    newBoard[index] = turn;
    setBoard(newBoard);
    setHistory((prev) => [...prev, board]);

    const result = checkWinner(newBoard);
    if (result.winner) {
      setWinner(result.winner);
      setWinningLine(result.line);
      if (result.winner === 'draw') {
        sounds.playDraw();
        setScores((prev) => ({ ...prev, draws: prev.draws + 1, streak: 0 }));
      } else {
        sounds.playWin();
        launchConfetti();
        setScores((prev) => ({
          ...prev,
          x: result.winner === 'X' ? prev.x + 1 : prev.x,
          o: result.winner === 'O' ? prev.o + 1 : prev.o,
          streak: result.winner === 'X' ? prev.streak + 1 : 0,
        }));
      }
      return;
    }

    // Switch turns
    const nextPlayer: Player = turn === 'X' ? 'O' : 'X';
    setTurn(nextPlayer);

    // If gameMode is AI, trigger AI response
    if (gameMode === 'ai' && nextPlayer === 'O') {
      setIsAiThinking(true);
      setTimeout(() => {
        const aiIndex = getAiMove(newBoard);
        if (aiIndex !== -1) {
          sounds.playMove('O');
          newBoard[aiIndex] = 'O';
          setBoard([...newBoard]);
          const aiResult = checkWinner(newBoard);
          if (aiResult.winner) {
            setWinner(aiResult.winner);
            setWinningLine(aiResult.line);
            if (aiResult.winner === 'draw') {
              sounds.playDraw();
              setScores((prev) => ({ ...prev, draws: prev.draws + 1, streak: 0 }));
            } else {
              sounds.playWin();
              setScores((prev) => ({ ...prev, o: prev.o + 1, streak: 0 }));
            }
          } else {
            setTurn('X');
          }
        }
        setIsAiThinking(false);
      }, 350);
    }
  };

  // Keyboard navigation (Keys 1-9)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = parseInt(e.key, 10);
      if (key >= 1 && key <= 9) {
        handleCellClick(key - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Reset current round
  const handleResetRound = () => {
    setBoard(Array(9).fill(null));
    setTurn('X');
    setWinner(null);
    setWinningLine(null);
    setIsAiThinking(false);
    setHistory([]);
  };

  // Reset entire match and scoreboard
  const handleResetScores = () => {
    handleResetRound();
    setScores({ x: 0, o: 0, draws: 0, streak: 0 });
  };

  // Undo move
  const handleUndo = () => {
    if (history.length === 0 || winner !== null || isAiThinking) return;
    const previousBoard = history[history.length - 1];
    setBoard(previousBoard);
    setHistory((prev) => prev.slice(0, -1));
    setTurn('X');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at top, #1E1B4B 0%, #0F172A 70%, #020617 100%)',
        color: '#F8FAFC',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'clamp(1rem, 3vw, 2.5rem)',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Background ambient decorative glow */}
      <div
        style={{
          position: 'absolute',
          top: '-150px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Confetti canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      />

      {/* Navigation and sound control bar */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={() => (onNavigate ? onNavigate('/management/dashboard') : window.history.back())}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#E2E8F0',
            padding: '0.5rem 0.9rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            transition: 'all 0.2s',
          }}
        >
          <ArrowLeft size={16} />
          <span>Dashboard</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              sounds.enabled = next;
            }}
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: soundEnabled ? '#38BDF8' : '#94A3B8',
              padding: '0.5rem',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '0.3rem 0.85rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700, color: '#A5B4FC', marginBottom: '0.5rem' }}>
          <Zap size={14} color="#818CF8" />
          <span>CAMPUSLY BREAK ROOM • TIC-TAC-TOE</span>
        </div>
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 2.75rem)',
            fontWeight: 900,
            margin: '0.2rem 0',
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #FFFFFF 0%, #CBD5E1 50%, #94A3B8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Tic-Tac-Toe
        </h1>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#94A3B8' }}>
          Challenge the unbeatable Minimax AI or play with a friend.
        </p>
      </div>

      {/* Mode & Difficulty Selector Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(30, 41, 59, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '1rem',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Game Mode Selector */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              setGameMode('ai');
              handleResetRound();
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1rem',
              borderRadius: '10px',
              border: 'none',
              background: gameMode === 'ai' ? 'linear-gradient(135deg, #4F46E5, #3730A3)' : 'rgba(255, 255, 255, 0.05)',
              color: gameMode === 'ai' ? '#FFFFFF' : '#94A3B8',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Bot size={16} />
            <span>vs AI Bot</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setGameMode('pvp');
              handleResetRound();
            }}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1rem',
              borderRadius: '10px',
              border: 'none',
              background: gameMode === 'pvp' ? 'linear-gradient(135deg, #4F46E5, #3730A3)' : 'rgba(255, 255, 255, 0.05)',
              color: gameMode === 'pvp' ? '#FFFFFF' : '#94A3B8',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Users size={16} />
            <span>2 Players (PvP)</span>
          </button>
        </div>

        {/* AI Difficulty Pills (only visible in AI mode) */}
        {gameMode === 'ai' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.4rem', borderRadius: '10px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', marginLeft: '0.5rem' }}>AI Level:</span>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((lvl) => {
              const active = difficulty === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    setDifficulty(lvl);
                    handleResetRound();
                  }}
                  style={{
                    flex: 1,
                    padding: '0.35rem 0.6rem',
                    borderRadius: '7px',
                    border: 'none',
                    background: active ? '#6366F1' : 'transparent',
                    color: active ? '#FFFFFF' : '#94A3B8',
                    fontSize: '0.775rem',
                    fontWeight: active ? 800 : 600,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {lvl === 'hard' ? 'Unbeatable' : lvl}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Scoreboard Cards */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.05em' }}>PLAYER X</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF', marginTop: '0.15rem' }}>{scores.x}</div>
        </div>

        <div style={{ background: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.05em' }}>TIES</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF', marginTop: '0.15rem' }}>{scores.draws}</div>
        </div>

        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FB7185', letterSpacing: '0.05em' }}>{gameMode === 'ai' ? 'BOT O' : 'PLAYER O'}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF', marginTop: '0.15rem' }}>{scores.o}</div>
        </div>

        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FBBF24', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
            <Flame size={13} /> STREAK
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FDE047', marginTop: '0.15rem' }}>{scores.streak}</div>
        </div>
      </div>

      {/* Turn & Status Indicator Banner */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          background: winner
            ? winner === 'draw'
              ? 'rgba(148, 163, 184, 0.15)'
              : winner === 'X'
              ? 'rgba(6, 182, 212, 0.2)'
              : 'rgba(244, 63, 94, 0.2)'
            : 'rgba(30, 41, 59, 0.8)',
          border: winner
            ? winner === 'draw'
              ? '1px solid #94A3B8'
              : winner === 'X'
              ? '1px solid #06B6D4'
              : '1px solid #F43F5E'
            : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          fontSize: '1rem',
          fontWeight: 800,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          transition: 'all 0.3s ease',
        }}
      >
        {winner ? (
          winner === 'draw' ? (
            <span style={{ color: '#E2E8F0' }}>🤝 It's a Draw! Well played!</span>
          ) : (
            <span style={{ color: winner === 'X' ? '#38BDF8' : '#FB7185', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trophy size={18} />
              {gameMode === 'ai' && winner === 'O' ? '🤖 Bot Won the Round!' : `🎉 Player ${winner} Wins!`}
            </span>
          )
        ) : isAiThinking ? (
          <span style={{ color: '#FBBF24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={16} />
            AI Bot is thinking...
          </span>
        ) : (
          <span>
            Current Turn: <strong style={{ color: turn === 'X' ? '#38BDF8' : '#FB7185' }}>{turn}</strong>
          </span>
        )}
      </div>

      {/* 3x3 Tic Tac Toe Grid Board */}
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          aspectRatio: '1 / 1',
          background: 'rgba(15, 23, 42, 0.85)',
          border: '2px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap: '12px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 2px 4px rgba(255, 255, 255, 0.05)',
          position: 'relative',
        }}
      >
        {board.map((cell, idx) => {
          const isWinningCell = winningLine?.includes(idx);
          const isHovered = hoverIndex === idx && cell === null && !winner && !isAiThinking;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCellClick(idx)}
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
              disabled={cell !== null || winner !== null || isAiThinking}
              aria-label={`Cell ${idx + 1}, currently ${cell || 'empty'}`}
              style={{
                background: isWinningCell
                  ? winner === 'X'
                    ? 'rgba(6, 182, 212, 0.25)'
                    : 'rgba(244, 63, 94, 0.25)'
                  : isHovered
                  ? 'rgba(255, 255, 255, 0.06)'
                  : 'rgba(30, 41, 59, 0.65)',
                border: isWinningCell
                  ? winner === 'X'
                    ? '2px solid #06B6D4'
                    : '2px solid #F43F5E'
                  : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: cell === null && !winner && !isAiThinking ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                position: 'relative',
                boxShadow: isWinningCell ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none',
              }}
            >
              {cell === 'X' && (
                <svg width="58" height="58" viewBox="0 0 60 60" style={{ filter: 'drop-shadow(0 0 8px #06B6D4)' }}>
                  <line x1="15" y1="15" x2="45" y2="45" stroke="#06B6D4" strokeWidth="7" strokeLinecap="round" />
                  <line x1="45" y1="15" x2="15" y2="45" stroke="#06B6D4" strokeWidth="7" strokeLinecap="round" />
                </svg>
              )}

              {cell === 'O' && (
                <svg width="58" height="58" viewBox="0 0 60 60" style={{ filter: 'drop-shadow(0 0 8px #F43F5E)' }}>
                  <circle cx="30" cy="30" r="16" fill="none" stroke="#F43F5E" strokeWidth="7" strokeLinecap="round" />
                </svg>
              )}

              {/* Ghost preview marker on hover */}
              {isHovered && (
                <div style={{ opacity: 0.25 }}>
                  {turn === 'X' ? (
                    <svg width="48" height="48" viewBox="0 0 60 60">
                      <line x1="15" y1="15" x2="45" y2="45" stroke="#38BDF8" strokeWidth="6" strokeLinecap="round" />
                      <line x1="45" y1="15" x2="15" y2="45" stroke="#38BDF8" strokeWidth="6" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="48" height="48" viewBox="0 0 60 60">
                      <circle cx="30" cy="30" r="16" fill="none" stroke="#FB7185" strokeWidth="6" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Control Buttons (New Round, Reset Match) */}
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          display: 'flex',
          gap: '0.75rem',
          marginTop: '1.5rem',
        }}
      >
        <button
          type="button"
          onClick={handleResetRound}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.45rem',
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #4F46E5, #3730A3)',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.875rem',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
            transition: 'all 0.2s',
          }}
        >
          <RotateCcw size={16} />
          <span>New Round</span>
        </button>

        <button
          type="button"
          onClick={handleUndo}
          disabled={history.length === 0 || winner !== null || isAiThinking}
          style={{
            padding: '0.75rem 0.9rem',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: history.length === 0 || winner !== null ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.08)',
            color: history.length === 0 || winner !== null ? '#475569' : '#CBD5E1',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: history.length === 0 || winner !== null ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
          title="Undo last move"
        >
          Undo
        </button>

        <button
          type="button"
          onClick={handleResetScores}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: 'rgba(255, 255, 255, 0.06)',
            color: '#94A3B8',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="Reset score counters"
        >
          Reset Scores
        </button>
      </div>

      {/* Helper footer */}
      <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748B' }}>
        Tip: You can use your keyboard numpad or numbers 1-9 to place moves quickly.
      </div>
    </div>
  );
};
