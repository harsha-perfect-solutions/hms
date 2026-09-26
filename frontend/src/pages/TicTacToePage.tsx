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
  Undo2,
  Keyboard,
} from 'lucide-react';

export type Player = 'X' | 'O';
export type CellValue = Player | null;
export type BoardState = CellValue[];
export type GameMode = 'ai' | 'pvp';
export type Difficulty = 'easy' | 'medium' | 'hard';

interface HistoryStep {
  board: BoardState;
  turn: Player;
}

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

// Web Audio API Synthesizer with zero external assets
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
    try {
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
    } catch {}
  }

  playWin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C arpeggio
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = this.ctx.currentTime + idx * 0.09;
        osc.frequency.setValueAtTime(freq, startTime);
        osc.type = 'triangle';
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch {}
  }

  playDraw() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(240, this.ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(160, this.ctx.currentTime + 0.25);
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.25);
    } catch {}
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
  const [playerSide, setPlayerSide] = useState<Player>('X');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Stats & Complete State History for Bug-Free Undo
  const [scores, setScores] = useState({ x: 0, o: 0, draws: 0, streak: 0 });
  const [history, setHistory] = useState<HistoryStep[]>([]);

  // Synchronous State References (Guarantees zero stale closures & race conditions)
  const boardRef = useRef<BoardState>(board);
  boardRef.current = board;
  const turnRef = useRef<Player>(turn);
  turnRef.current = turn;
  const winnerRef = useRef<Player | 'draw' | null>(winner);
  winnerRef.current = winner;
  const isAiThinkingRef = useRef<boolean>(isAiThinking);
  isAiThinkingRef.current = isAiThinking;
  const gameModeRef = useRef<GameMode>(gameMode);
  gameModeRef.current = gameMode;
  const playerSideRef = useRef<Player>(playerSide);
  playerSideRef.current = playerSide;
  const historyRef = useRef<HistoryStep[]>(history);
  historyRef.current = history;

  const aiTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, []);

  // Check victory condition
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

  // Confetti fireworks on win
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

    const colors = ['#06B6D4', '#F43F5E', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#38BDF8'];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.5) * 14 - 4,
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
        p.vy += 0.25;
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

  // Minimax algorithm without side effects
  const minimax = useCallback((b: BoardState, depth: number, isMaximizing: boolean, aiMark: Player, humanMark: Player): { score: number; index?: number } => {
    const res = checkWinner(b);
    if (res.winner === aiMark) return { score: 10 - depth };
    if (res.winner === humanMark) return { score: depth - 10 };
    if (res.winner === 'draw') return { score: 0 };

    const availableIndices = b.map((val, idx) => (val === null ? idx : null)).filter((val): val is number => val !== null);

    if (isMaximizing) {
      let maxScore = -Infinity;
      let bestMove = availableIndices[0];
      for (const idx of availableIndices) {
        b[idx] = aiMark;
        const evaluation = minimax(b, depth + 1, false, aiMark, humanMark);
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
        b[idx] = humanMark;
        const evaluation = minimax(b, depth + 1, true, aiMark, humanMark);
        b[idx] = null;
        if (evaluation.score < minScore) {
          minScore = evaluation.score;
          bestMove = idx;
        }
      }
      return { score: minScore, index: bestMove };
    }
  }, [checkWinner]);

  // AI Move calculation
  const getAiMove = useCallback((currentBoard: BoardState, aiMark: Player, humanMark: Player): number => {
    const boardCopy = [...currentBoard];
    const available = boardCopy.map((val, idx) => (val === null ? idx : null)).filter((val): val is number => val !== null);

    if (available.length === 0) return -1;

    // Optimization: If board is completely empty, instant pick center or random corner
    if (available.length === 9) {
      const cornersAndCenter = [0, 2, 4, 6, 8];
      return cornersAndCenter[Math.floor(Math.random() * cornersAndCenter.length)];
    }

    // Easy mode: pure random
    if (difficulty === 'easy') {
      return available[Math.floor(Math.random() * available.length)];
    }

    // Medium mode: win or block, else smart heuristic
    if (difficulty === 'medium') {
      // 1. Can AI win immediately?
      for (const idx of available) {
        boardCopy[idx] = aiMark;
        if (checkWinner(boardCopy).winner === aiMark) {
          boardCopy[idx] = null;
          return idx;
        }
        boardCopy[idx] = null;
      }
      // 2. Can human win immediately? Block!
      for (const idx of available) {
        boardCopy[idx] = humanMark;
        if (checkWinner(boardCopy).winner === humanMark) {
          boardCopy[idx] = null;
          return idx;
        }
        boardCopy[idx] = null;
      }
      // 3. Prefer center
      if (boardCopy[4] === null && Math.random() > 0.3) return 4;
      return available[Math.floor(Math.random() * available.length)];
    }

    // Hard (Unbeatable) mode: Minimax
    const { index } = minimax(boardCopy, 0, true, aiMark, humanMark);
    return index !== undefined ? index : available[0];
  }, [difficulty, checkWinner, minimax]);

  // Trigger AI turn with snapshot history
  const triggerAiTurn = useCallback((_boardAfterPlayer: BoardState, currentTurn: Player) => {
    const humanMark = playerSideRef.current;
    const aiMark: Player = humanMark === 'X' ? 'O' : 'X';

    if (currentTurn !== aiMark) return;

    setIsAiThinking(true);
    if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);

    aiTimeoutRef.current = setTimeout(() => {
      const currentLiveBoard = boardRef.current;
      // Safety check: ensure board hasn't been reset while waiting
      if (winnerRef.current !== null) {
        setIsAiThinking(false);
        return;
      }

      const aiIndex = getAiMove(currentLiveBoard, aiMark, humanMark);
      if (aiIndex !== -1 && currentLiveBoard[aiIndex] === null) {
        // Record state before AI move into history
        setHistory((prev) => [...prev, { board: [...currentLiveBoard], turn: aiMark }]);

        sounds.playMove(aiMark);
        const nextBoard = [...currentLiveBoard];
        nextBoard[aiIndex] = aiMark;
        setBoard(nextBoard);

        const aiResult = checkWinner(nextBoard);
        if (aiResult.winner) {
          setWinner(aiResult.winner);
          setWinningLine(aiResult.line);
          if (aiResult.winner === 'draw') {
            sounds.playDraw();
            setScores((prev) => ({ ...prev, draws: prev.draws + 1, streak: 0 }));
          } else {
            sounds.playWin();
            setScores((prev) => ({
              ...prev,
              x: aiResult.winner === 'X' ? prev.x + 1 : prev.x,
              o: aiResult.winner === 'O' ? prev.o + 1 : prev.o,
              streak: aiResult.winner === humanMark ? prev.streak + 1 : 0,
            }));
          }
        } else {
          setTurn(humanMark);
        }
      }
      setIsAiThinking(false);
      aiTimeoutRef.current = null;
    }, 280);
  }, [getAiMove, checkWinner]);

  // Reset current round
  const handleResetRound = useCallback((preferredSide?: Player, preferredMode?: GameMode) => {
    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
    }
    const emptyBoard: BoardState = Array(9).fill(null);
    setBoard(emptyBoard);
    setTurn('X');
    setWinner(null);
    setWinningLine(null);
    setIsAiThinking(false);
    setHistory([]);

    const activeSide = preferredSide || playerSideRef.current;
    const activeMode = preferredMode || gameModeRef.current;

    // If user is playing as 'O' vs AI, AI takes the opening 'X' move
    if (activeMode === 'ai' && activeSide === 'O') {
      triggerAiTurn(emptyBoard, 'X');
    }
  }, [triggerAiTurn]);

  // Handle cell click
  const handleCellClick = useCallback((index: number) => {
    const currentB = boardRef.current;
    const currentTurn = turnRef.current;
    const activeWinner = winnerRef.current;
    const thinking = isAiThinkingRef.current;
    const mode = gameModeRef.current;
    const side = playerSideRef.current;

    // Strict validation
    if (currentB[index] !== null || activeWinner !== null || thinking) return;
    if (mode === 'ai' && currentTurn !== side) return;

    // Record state before human move into history
    setHistory((prev) => [...prev, { board: [...currentB], turn: currentTurn }]);

    sounds.playMove(currentTurn);
    const newBoard = [...currentB];
    newBoard[index] = currentTurn;
    setBoard(newBoard);

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
          streak: result.winner === side ? prev.streak + 1 : 0,
        }));
      }
      return;
    }

    const nextPlayer: Player = currentTurn === 'X' ? 'O' : 'X';
    setTurn(nextPlayer);

    if (mode === 'ai') {
      triggerAiTurn(newBoard, nextPlayer);
    }
  }, [checkWinner, launchConfetti, triggerAiTurn]);

  // Undo move properly for both PvP and AI modes
  const handleUndo = useCallback(() => {
    const currentHistory = historyRef.current;
    if (currentHistory.length === 0 || isAiThinkingRef.current) return;

    if (aiTimeoutRef.current) {
      clearTimeout(aiTimeoutRef.current);
      aiTimeoutRef.current = null;
      setIsAiThinking(false);
    }

    const mode = gameModeRef.current;
    const side = playerSideRef.current;

    if (mode === 'ai') {
      // In AI mode:
      // If AI has already played after human's move (history has 2+ steps), rollback 2 steps
      // If human just moved and won (history has 1 step or AI hadn't moved), rollback 1 step
      const stepsToRevert = currentHistory.length >= 2 ? 2 : 1;
      const targetStep = currentHistory[currentHistory.length - stepsToRevert];

      setBoard(targetStep.board);
      setTurn(side);
      setHistory((prev) => prev.slice(0, prev.length - stepsToRevert));
    } else {
      // In PvP mode: rollback 1 step
      const targetStep = currentHistory[currentHistory.length - 1];
      setBoard(targetStep.board);
      setTurn(targetStep.turn);
      setHistory((prev) => prev.slice(0, -1));
    }

    setWinner(null);
    setWinningLine(null);
  }, []);

  // Keyboard navigation & Shortcuts (Keys 1-9, Numpad, R=Reset, U=Undo, M=Mute)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept typing if user is in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      // Reset shortcut
      if (e.key === 'r' || e.key === 'R') {
        handleResetRound();
        return;
      }

      // Undo shortcut (U or Ctrl+Z)
      if (e.key === 'u' || e.key === 'U' || (e.ctrlKey && (e.key === 'z' || e.key === 'Z'))) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Mute shortcut
      if (e.key === 'm' || e.key === 'M') {
        setSoundEnabled((prev) => {
          sounds.enabled = !prev;
          return !prev;
        });
        return;
      }

      // Standard top row 1-9 (1=top-left, 9=bottom-right)
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        handleCellClick(num - 1);
        return;
      }

      // Numpad support
      const numpadMap: Record<string, number> = {
        Numpad7: 0,
        Numpad8: 1,
        Numpad9: 2,
        Numpad4: 3,
        Numpad5: 4,
        Numpad6: 5,
        Numpad1: 6,
        Numpad2: 7,
        Numpad3: 8,
      };
      if (numpadMap[e.code] !== undefined) {
        handleCellClick(numpadMap[e.code]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCellClick, handleResetRound, handleUndo]);

  // Reset entire match score counters
  const handleResetScores = () => {
    handleResetRound();
    setScores({ x: 0, o: 0, draws: 0, streak: 0 });
  };

  const isHumanTurn = gameMode === 'pvp' || turn === playerSide;

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
      {/* Background ambient lighting */}
      <div
        style={{
          position: 'absolute',
          top: '-150px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.18) 0%, transparent 70%)',
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

      {/* Navigation bar */}
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <button
          type="button"
          onClick={() => (onNavigate ? onNavigate('/management/blocks') : window.history.back())}
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
          <span>Back to HMS</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              sounds.enabled = next;
            }}
            title={soundEnabled ? 'Mute Sounds (Press M)' : 'Unmute Sounds (Press M)'}
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
              transition: 'all 0.2s',
            }}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            padding: '0.3rem 0.85rem',
            borderRadius: '9999px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#A5B4FC',
            marginBottom: '0.5rem',
          }}
        >
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
          Test your skills against unbeatable Minimax AI or challenge a roommate in 2P mode.
        </p>
      </div>

      {/* Mode & Side Selector Card */}
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
              handleResetRound(playerSide, 'ai');
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
              handleResetRound(playerSide, 'pvp');
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

        {/* AI Options: Side Selection & Difficulty */}
        {gameMode === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', width: '70px' }}>Your Side:</span>
              <div style={{ display: 'flex', gap: '0.4rem', flex: 1 }}>
                <button
                  type="button"
                  onClick={() => {
                    setPlayerSide('X');
                    handleResetRound('X', 'ai');
                  }}
                  style={{
                    flex: 1,
                    padding: '0.35rem 0.6rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: playerSide === 'X' ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    color: playerSide === 'X' ? '#38BDF8' : '#94A3B8',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: playerSide === 'X' ? '#06B6D4' : 'transparent',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Play as X (First)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlayerSide('O');
                    handleResetRound('O', 'ai');
                  }}
                  style={{
                    flex: 1,
                    padding: '0.35rem 0.6rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: playerSide === 'O' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    color: playerSide === 'O' ? '#FB7185' : '#94A3B8',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: playerSide === 'O' ? '#F43F5E' : 'transparent',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Play as O (AI First)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.4rem', borderRadius: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', marginLeft: '0.5rem', width: '60px' }}>AI Level:</span>
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
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38BDF8', letterSpacing: '0.05em' }}>
            {gameMode === 'ai' ? (playerSide === 'X' ? 'YOU (X)' : 'BOT (X)') : 'PLAYER X'}
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF', marginTop: '0.15rem' }}>{scores.x}</div>
        </div>

        <div style={{ background: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.05em' }}>TIES</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF', marginTop: '0.15rem' }}>{scores.draws}</div>
        </div>

        <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: '12px', padding: '0.75rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FB7185', letterSpacing: '0.05em' }}>
            {gameMode === 'ai' ? (playerSide === 'O' ? 'YOU (O)' : 'BOT (O)') : 'PLAYER O'}
          </div>
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
          marginBottom: '1.25rem',
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
              {gameMode === 'ai'
                ? winner === playerSide
                  ? '🎉 You Won! Amazing Strategy!'
                  : '🤖 AI Bot Won! Try another match!'
                : `🎉 Player ${winner} Wins!`}
            </span>
          )
        ) : isAiThinking ? (
          <span style={{ color: '#FBBF24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Sparkles size={16} />
            AI Bot is calculating move...
          </span>
        ) : (
          <span>
            Current Turn:{' '}
            <strong style={{ color: turn === 'X' ? '#38BDF8' : '#FB7185' }}>
              {turn} {gameMode === 'ai' ? (turn === playerSide ? '(Your Turn)' : '(AI Turn)') : ''}
            </strong>
          </span>
        )}
      </div>

      {/* 3x3 Grid Board */}
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
          const isHovered = hoverIndex === idx && cell === null && !winner && !isAiThinking && isHumanTurn;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleCellClick(idx)}
              onMouseEnter={() => setHoverIndex(idx)}
              onMouseLeave={() => setHoverIndex(null)}
              disabled={cell !== null || winner !== null || isAiThinking || !isHumanTurn}
              aria-label={`Cell ${idx + 1}, currently ${cell || 'empty'}`}
              style={{
                background: isWinningCell
                  ? winner === 'X'
                    ? 'rgba(6, 182, 212, 0.3)'
                    : 'rgba(244, 63, 94, 0.3)'
                  : isHovered
                  ? 'rgba(255, 255, 255, 0.07)'
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
                cursor: cell === null && !winner && !isAiThinking && isHumanTurn ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                position: 'relative',
                boxShadow: isWinningCell ? '0 0 22px rgba(6, 182, 212, 0.5)' : 'none',
                transform: isWinningCell ? 'scale(1.02)' : 'none',
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

      {/* Control Buttons (New Round, Undo, Reset Match) */}
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          display: 'flex',
          gap: '0.65rem',
          marginTop: '1.25rem',
        }}
      >
        <button
          type="button"
          onClick={() => handleResetRound()}
          style={{
            flex: 1.2,
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
          title="Start fresh round (Key: R)"
        >
          <RotateCcw size={16} />
          <span>New Round</span>
        </button>

        <button
          type="button"
          onClick={handleUndo}
          disabled={history.length === 0 || isAiThinking}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.75rem 0.9rem',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            background: history.length === 0 || isAiThinking ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.08)',
            color: history.length === 0 || isAiThinking ? '#475569' : '#CBD5E1',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: history.length === 0 || isAiThinking ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
          title="Undo last move (Key: U)"
        >
          <Undo2 size={15} />
          <span>Undo</span>
        </button>

        <button
          type="button"
          onClick={handleResetScores}
          style={{
            padding: '0.75rem 0.9rem',
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
          Reset
        </button>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div
        style={{
          marginTop: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          color: '#64748B',
          background: 'rgba(15, 23, 42, 0.5)',
          padding: '0.4rem 0.8rem',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <Keyboard size={14} color="#818CF8" />
        <span>
          Shortcuts: <strong>1-9</strong> or <strong>Numpad</strong> to place moves • <strong>R</strong> New Round • <strong>U</strong> Undo • <strong>M</strong> Mute
        </span>
      </div>
    </div>
  );
};
