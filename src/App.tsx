/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Heart, Gamepad2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Apple } from 'lucide-react';

// --- CONFIGURATION ---
const FIELD_SIZE = 800; // Internal virtual canvas size
const SPEED = 3.5; // Smooth movement speed
const SEGMENT_SPACING = 6; // History distance between body segments
const INITIAL_LENGTH = 3;
const SNAKE_RADIUS = 10;
const FOOD_RADIUS = 13;

type GameState = 'READY' | 'PLAYING' | 'DIED' | 'GAME_OVER';

interface Point {
  x: number;
  y: number;
}

export default function App() {
  // --- REACT STATE FOR UI ---
  const [gameState, setGameState] = useState<GameState>('READY');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);

  // --- REFS FOR PHYSICS ENGINE (Prevents React closure issues in loop) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionsRef = useRef<{ [key: string]: () => void }>({});

  const bridge = useRef({
    gameState: 'READY' as GameState,
    score: 0,
    highScore: 0,
    lives: 3
  });

  const dataRef = useRef({
    head: { x: FIELD_SIZE / 2, y: FIELD_SIZE / 2 },
    history: [] as Point[],
    vx: 0,
    vy: 0,
    inputQueue: [] as Point[],
    targetLength: INITIAL_LENGTH,
    food: { x: 200, y: 200 },
  });

  // --- GAME ENGINE ---
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let accumulator = 0;
    const timeStep = 1000 / 60; // Fixed 60FPS tick

    const spawnFood = () => {
      const data = dataRef.current;
      let p = { x: 0, y: 0 };
      let safe = false;
      while (!safe) {
        p = {
          x: 50 + Math.random() * (FIELD_SIZE - 100),
          y: 50 + Math.random() * (FIELD_SIZE - 100)
        };
        safe = true;
        for (const part of data.history) {
          if (Math.hypot(p.x - part.x, p.y - part.y) < SNAKE_RADIUS + FOOD_RADIUS) {
            safe = false;
            break;
          }
        }
      }
      data.food = p;
    };

    const spawnSnake = () => {
      const d = dataRef.current;
      d.head = { x: FIELD_SIZE / 2, y: FIELD_SIZE / 2 };
      d.vx = 0;
      d.vy = 0;
      d.inputQueue = [];
      d.targetLength = INITIAL_LENGTH;
      d.history = [];
      // Build a static tail downwards initially
      for (let i = 0; i < INITIAL_LENGTH * SEGMENT_SPACING; i++) {
        d.history.push({ x: d.head.x, y: d.head.y + i * SPEED });
      }
    };

    const doDeath = () => {
      bridge.current.lives -= 1;
      setLives(bridge.current.lives);

      if (bridge.current.lives > 0) {
        bridge.current.gameState = 'DIED';
        setGameState('DIED');
      } else {
        bridge.current.gameState = 'GAME_OVER';
        setGameState('GAME_OVER');
      }
    };

    const doEat = () => {
      dataRef.current.targetLength += 4;
      spawnFood();
      bridge.current.score += 10;
      if (bridge.current.score > bridge.current.highScore) {
        bridge.current.highScore = bridge.current.score;
        setHighScore(bridge.current.highScore);
      }
      setScore(bridge.current.score);
    };

    const updateGame = () => {
      if (bridge.current.gameState !== 'PLAYING') return;

      const data = dataRef.current;

      // Process input queue
      if (data.inputQueue.length > 0) {
        const nextDir = data.inputQueue.shift()!;
        if (data.vx === 0 && data.vy === 0) {
          // First move from rest: orientation fix
          data.vx = nextDir.x;
          data.vy = nextDir.y;
          data.history = [];
          for (let i = 0; i < data.targetLength * SEGMENT_SPACING; i++) {
            data.history.push({
              x: data.head.x - (data.vx !== 0 ? Math.sign(data.vx) * SPEED * i : 0),
              y: data.head.y - (data.vy !== 0 ? Math.sign(data.vy) * SPEED * i : 0)
            });
          }
        } else {
          // Prevent 180 reversing
          if (!(data.vx !== 0 && nextDir.x === -data.vx) && !(data.vy !== 0 && nextDir.y === -data.vy)) {
            data.vx = nextDir.x;
            data.vy = nextDir.y;
          }
        }
      }

      if (data.vx === 0 && data.vy === 0) return; // Sitting idle

      // Move head
      data.head.x += data.vx;
      data.head.y += data.vy;

      // Update history trail
      data.history.unshift({ x: data.head.x, y: data.head.y });
      const maxHistory = data.targetLength * SEGMENT_SPACING;
      if (data.history.length > maxHistory) {
        data.history.length = maxHistory; // Truncate excess
      }

      // Wall collision bounds
      if (
        data.head.x < SNAKE_RADIUS || data.head.x > FIELD_SIZE - SNAKE_RADIUS ||
        data.head.y < SNAKE_RADIUS || data.head.y > FIELD_SIZE - SNAKE_RADIUS
      ) {
        doDeath();
        return;
      }

      // Self collision (skip immediate neck segments)
      for (let i = SEGMENT_SPACING * 3; i < data.history.length; i += SEGMENT_SPACING) {
        const part = data.history[i];
        if (Math.hypot(data.head.x - part.x, data.head.y - part.y) < SNAKE_RADIUS * 1.5) {
          doDeath();
          return;
        }
      }

      // Food collision
      if (Math.hypot(data.head.x - data.food.x, data.head.y - data.food.y) < SNAKE_RADIUS + FOOD_RADIUS) {
        doEat();
      }
    };

    const drawGame = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const data = dataRef.current;

      ctx.clearRect(0, 0, FIELD_SIZE, FIELD_SIZE);

      // Draw active body trail
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(data.head.x, data.head.y);
      for (let i = 0; i < data.history.length; i += SEGMENT_SPACING) {
        ctx.lineTo(data.history[i].x, data.history[i].y);
      }
      ctx.strokeStyle = bridge.current.gameState === 'DIED' || bridge.current.gameState === 'GAME_OVER' ? '#94a3b8' : '#10b981';
      ctx.lineWidth = SNAKE_RADIUS * 2;
      ctx.shadowBlur = 0;
      ctx.stroke();

      // Draw detail scales over the path
      ctx.fillStyle = bridge.current.gameState === 'PLAYING' ? '#059669' : '#64748b';
      for (let i = 0; i < data.history.length; i += SEGMENT_SPACING * 2) {
        ctx.beginPath();
        ctx.arc(data.history[i].x, data.history[i].y, SNAKE_RADIUS * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Head
      ctx.beginPath();
      ctx.arc(data.head.x, data.head.y, SNAKE_RADIUS + 2, 0, Math.PI * 2);
      ctx.fillStyle = bridge.current.gameState === 'PLAYING' ? '#059669' : '#64748b';
      ctx.fill();

      // Eyes
      const angle = (data.vx === 0 && data.vy === 0) ? -Math.PI / 2 : Math.atan2(data.vy, data.vx);
      const eyeDist = SNAKE_RADIUS * 0.6;
      const eyeOffset = Math.PI / 3.5;

      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(data.head.x + Math.cos(angle - eyeOffset) * eyeDist, data.head.y + Math.sin(angle - eyeOffset) * eyeDist, 3, 0, Math.PI * 2);
      ctx.arc(data.head.x + Math.cos(angle + eyeOffset) * eyeDist, data.head.y + Math.sin(angle + eyeOffset) * eyeDist, 3, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(data.head.x + Math.cos(angle - eyeOffset) * eyeDist + Math.cos(angle), data.head.y + Math.sin(angle - eyeOffset) * eyeDist + Math.sin(angle), 1.5, 0, Math.PI * 2);
      ctx.arc(data.head.x + Math.cos(angle + eyeOffset) * eyeDist + Math.cos(angle), data.head.y + Math.sin(angle + eyeOffset) * eyeDist + Math.sin(angle), 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Draw Food (Apple)
      const time = performance.now();
      const pulse = 1 + Math.sin(time / 150) * 0.05;
      const fX = data.food.x;
      const fY = data.food.y;
      
      ctx.beginPath();
      ctx.arc(fX, fY, FOOD_RADIUS * pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      
      // Apple leaf
      ctx.beginPath();
      ctx.ellipse(fX + 4, fY - 10, 5, 2.5, Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.fill();
    };

    const loop = (time: DOMHighResTimeStamp) => {
      animationFrameId = requestAnimationFrame(loop);
      const dt = time - lastTime;
      lastTime = time;

      accumulator += Math.min(dt, 50); // cap max dt
      while (accumulator >= timeStep) {
        accumulator -= timeStep;
        updateGame();
      }
      drawGame();
    };

    // --- INPUT ROUTING ---
    const triggerAction = (code: string) => {
      const state = bridge.current.gameState;

      if (code === 'Space') {
        if (state === 'READY' || state === 'DIED') {
          spawnSnake();
          bridge.current.gameState = 'PLAYING';
          setGameState('PLAYING');
        } else if (state === 'GAME_OVER') {
          bridge.current.score = 0;
          bridge.current.lives = 3;
          bridge.current.gameState = 'READY';
          setScore(0);
          setLives(3);
          setGameState('READY');
          spawnSnake();
          spawnFood();
        }
        return;
      }

      if (state !== 'PLAYING') return;

      let dir = null;
      if (code === 'ArrowUp' || code === 'KeyW') dir = { x: 0, y: -SPEED };
      if (code === 'ArrowDown' || code === 'KeyS') dir = { x: 0, y: SPEED };
      if (code === 'ArrowLeft' || code === 'KeyA') dir = { x: -SPEED, y: 0 };
      if (code === 'ArrowRight' || code === 'KeyD') dir = { x: SPEED, y: 0 };

      if (dir) dataRef.current.inputQueue.push(dir);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      triggerAction(e.code);
    };

    actionsRef.current = {
      up: () => triggerAction('ArrowUp'),
      down: () => triggerAction('ArrowDown'),
      left: () => triggerAction('ArrowLeft'),
      right: () => triggerAction('ArrowRight'),
      action: () => triggerAction('Space'),
    };

    // Init
    spawnSnake();
    spawnFood();
    window.addEventListener('keydown', handleKeyDown);
    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="h-screen w-full bg-slate-50 text-slate-800 flex flex-col p-4 md:p-6 font-sans overflow-hidden">
      {/* App Header */}
      <header className="flex justify-between items-center mb-4 md:mb-6 shrink-0 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-red-100 rounded-lg flex items-center justify-center border border-red-200 shadow-sm">
            <Apple className="w-5 h-5 md:w-6 md:h-6 text-red-500 fill-current" />
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-lime-600">
            DSnake Eater
          </h1>
        </div>
        <div className="flex gap-2 md:gap-4">
          <div className="px-3 py-1.5 md:px-4 md:py-2 bg-green-50 border border-green-200 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest text-green-600 flex items-center gap-2 shadow-sm">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             System Active
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 md:gap-6 flex-1 min-h-0 overflow-y-auto md:overflow-hidden pb-6 md:pb-0">
        
        {/* Game Window */}
        <section className="col-span-1 md:col-span-8 md:row-span-6 bg-white border border-slate-200 rounded-3xl p-3 md:p-5 flex flex-col shadow-md relative h-[50vh] md:h-auto min-h-[400px]">
          <div className="w-full h-full flex items-center justify-center relative bg-green-50 rounded-2xl overflow-hidden ring-1 ring-slate-200 shadow-inner">
             
             {/* Grid Pattern Overlay */}
             <div className="absolute inset-0 pointer-events-none opacity-40 z-0" style={{ backgroundImage: "linear-gradient(#cbd5e1 1px, transparent 1px), linear-gradient(90deg, #cbd5e1 1px, transparent 1px)", backgroundSize: "5%" }}></div>

             {/* Physics Game Canvas */}
             <canvas 
               ref={canvasRef} 
               width={FIELD_SIZE} 
               height={FIELD_SIZE} 
               className="w-full h-full object-contain z-10" 
             />

             {/* UI Overlays inside Canvas Area */}
             {gameState === 'READY' && (
               <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm cursor-pointer transition-colors hover:bg-white/80" onClick={() => actionsRef.current?.action()}>
                  <span className="text-emerald-600 text-lg md:text-xl font-bold uppercase tracking-widest animate-pulse border border-emerald-300 px-8 py-3 rounded-full bg-white shadow-sm">Start Game</span>
               </div>
             )}

             {gameState === 'DIED' && (
               <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm cursor-pointer transition-colors hover:bg-white/90" onClick={() => actionsRef.current?.action()}>
                  <span className="text-orange-500 text-xl md:text-2xl font-black uppercase tracking-widest mb-3">Ouch!</span>
                  <span className="text-slate-600 text-xs font-bold tracking-widest uppercase border border-slate-300 px-6 py-2 rounded-full bg-white shadow-sm">Tap / Space to Try Again</span>
               </div>
             )}

             {gameState === 'GAME_OVER' && (
               <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md">
                  <span className="text-rose-500 text-2xl md:text-4xl font-black uppercase tracking-widest mb-6 italic shadow-black drop-shadow-sm">Game Over</span>
                  <button onClick={() => actionsRef.current?.action()} className="px-8 py-3 bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 rounded-full shadow-lg uppercase font-bold text-sm transition-all tracking-widest">
                    Play Again
                  </button>
               </div>
             )}
          </div>

          <div className="mt-4 flex justify-between items-center px-4 w-full text-slate-500">
             <div className="text-[10px] md:text-xs uppercase font-bold tracking-widest text-slate-400">Movement Controls</div>
             {/* D-PAD for visual guide and mobile use */}
             <div className="flex gap-2">
                 <button onClick={() => actionsRef.current?.left()} className="w-10 h-10 md:w-12 md:h-12 border border-slate-200 bg-white rounded flex items-center justify-center hover:bg-slate-50 transition-colors active:bg-emerald-100"><ChevronLeft className="w-6 h-6 text-slate-500" /></button>
                 <div className="flex flex-col gap-2">
                    <button onClick={() => actionsRef.current?.up()} className="w-10 h-10 md:w-12 md:h-12 border border-slate-200 bg-white rounded flex items-center justify-center hover:bg-slate-50 transition-colors active:bg-emerald-100"><ChevronUp className="w-6 h-6 text-slate-500" /></button>
                    <button onClick={() => actionsRef.current?.down()} className="w-10 h-10 md:w-12 md:h-12 border border-slate-200 bg-white rounded flex items-center justify-center hover:bg-slate-50 transition-colors active:bg-emerald-100"><ChevronDown className="w-6 h-6 text-slate-500" /></button>
                 </div>
                 <button onClick={() => actionsRef.current?.right()} className="w-10 h-10 md:w-12 md:h-12 border border-slate-200 bg-white rounded flex items-center justify-center hover:bg-slate-50 transition-colors active:bg-emerald-100"><ChevronRight className="w-6 h-6 text-slate-500" /></button>
             </div>
          </div>
        </section>

        {/* Right Sidebar - Scoreboard & Stats */}
        <aside className="col-span-1 md:col-span-4 md:row-span-6 flex flex-col gap-4">
            
            {/* Title Banner */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden group shrink-0">
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-100 blur-[40px] rounded-full" />
                 <div className="flex items-center gap-3 mb-2">
                    <Trophy className="w-5 h-5 text-emerald-500" />
                    <h2 className="text-xl font-black tracking-widest uppercase text-slate-800 relative z-10">
                      Scoreboard
                    </h2>
                 </div>
                 <p className="text-xs font-medium text-slate-500 relative z-10">Local Statistics & Leaderboard</p>
            </div>

            {/* Lives / Integrity */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col gap-4 shrink-0">
                 <div className="flex items-center justify-between">
                     <span className="uppercase text-[10px] md:text-xs font-black tracking-widest text-slate-400">Available Lives</span>
                     <span className="font-mono text-slate-600 text-sm font-bold">{lives} MAX</span>
                 </div>
                 <div className="flex justify-center gap-3 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                     {[...Array(3)].map((_, i) => (
                          <Heart 
                             key={i} 
                             className={`w-10 h-10 transition-all duration-300 ${i < lives ? 'text-rose-500 fill-current scale-100' : 'text-slate-200 scale-75'}`} 
                          />
                     ))}
                 </div>
            </div>

             {/* Scores */}
             <div className="flex-1 flex flex-col gap-4 min-h-0">
               <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-3xl p-5 shadow-sm flex flex-col justify-center relative overflow-hidden group">
                   <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/50 blur-[50px] rounded-full pointer-events-none" />
                   <span className="uppercase text-[10px] md:text-xs font-black tracking-widest text-emerald-700 mb-2">Current Run</span>
                   <div className="font-mono text-5xl md:text-6xl font-black text-emerald-900 tracking-tight">
                     {score.toString().padStart(4, '0')}
                   </div>
               </div>
               
               <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 shadow-sm flex flex-col justify-center shrink-0">
                   <span className="uppercase text-[10px] md:text-xs font-black tracking-widest text-amber-700 mb-1">Personal Best</span>
                   <div className="font-mono text-3xl font-bold text-amber-900">
                     {highScore.toString().padStart(4, '0')}
                   </div>
               </div>
             </div>
        </aside>

      </main>
    </div>
  );
}

