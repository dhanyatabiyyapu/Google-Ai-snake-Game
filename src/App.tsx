/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Gamepad2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Star } from 'lucide-react';

// --- CONFIGURATION ---
const FIELD_SIZE = 800; // Internal virtual canvas size
const SPEED = 4.5; // Smooth movement speed
const KID_RADIUS = 18;
const FOOD_RADIUS = 15;
const SEGMENT_SPACING = 12;

type GameState = 'READY' | 'PLAYING' | 'GAME_OVER';

interface Point {
  x: number;
  y: number;
}

interface Twinkle {
  x: number;
  y: number;
  time: number;
}

interface BgStar {
  x: number;
  y: number;
  size: number;
  blink: number;
}

export default function App() {
  // --- REACT STATE FOR UI ---
  const [gameState, setGameState] = useState<GameState>('READY');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);

  // --- REFS FOR PHYSICS ENGINE (Prevents React closure issues in loop) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionsRef = useRef<{ [key: string]: () => void }>({});

  const bridge = useRef({
    gameState: 'READY' as GameState,
    score: 0,
    highScore: 0
  });

  const dataRef = useRef({
    head: { x: FIELD_SIZE / 2, y: FIELD_SIZE / 2 },
    vx: 0,
    vy: 0,
    inputQueue: [] as Point[],
    food: { x: 200, y: 200 },
    twinkles: [] as Twinkle[],
    bgStars: Array.from({length: 50}).map(() => ({ x: Math.random() * FIELD_SIZE, y: Math.random() * FIELD_SIZE, size: Math.random() * 2 + 1, blink: Math.random() })) as BgStar[],
    history: [] as Point[],
    targetLength: 0,
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
        safe = Math.hypot(p.x - data.head.x, p.y - data.head.y) > 40;
      }
      data.food = p;
    };

    const spawnKid = () => {
      const d = dataRef.current;
      d.head = { x: FIELD_SIZE / 2, y: FIELD_SIZE / 2 };
      d.vx = 0;
      d.vy = 0;
      d.inputQueue = [];
      d.history = [];
      d.targetLength = 0;
    };

    const doDeath = () => {
      bridge.current.gameState = 'GAME_OVER';
      setGameState('GAME_OVER');
    };

    const doEat = () => {
      dataRef.current.targetLength += 1;
      dataRef.current.twinkles.push({ x: dataRef.current.food.x, y: dataRef.current.food.y, time: performance.now() });
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
        data.vx = nextDir.x;
        data.vy = nextDir.y;
      }

      if (data.vx === 0 && data.vy === 0) return; // Sitting idle

      // Update history trail
      data.history.unshift({ x: data.head.x, y: data.head.y });
      const maxHistory = data.targetLength * SEGMENT_SPACING;
      if (data.history.length > maxHistory) {
        data.history.length = maxHistory; // Truncate excess
      }

      // Move kid
      data.head.x += data.vx;
      data.head.y += data.vy;

      // Wall collision bounds
      if (
        data.head.x < KID_RADIUS || data.head.x > FIELD_SIZE - KID_RADIUS ||
        data.head.y < KID_RADIUS || data.head.y > FIELD_SIZE - KID_RADIUS
      ) {
        doDeath();
        return;
      }

      // Food collision
      if (Math.hypot(data.head.x - data.food.x, data.head.y - data.food.y) < KID_RADIUS + FOOD_RADIUS) {
        doEat();
      }
    };

    const drawGame = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      const data = dataRef.current;
      const time = performance.now();

      ctx.clearRect(0, 0, FIELD_SIZE, FIELD_SIZE);

      const isDead = bridge.current.gameState === 'GAME_OVER';
      const isMoving = data.vx !== 0 || data.vy !== 0;

      // Draw Background Stars
      ctx.save();
      for (const s of data.bgStars) {
         ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(time / 500 + s.blink * 10) * 0.4})`;
         ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      // Simple Meteor
      const meteorTime = time % 4000;
      if (meteorTime < 500) {
         const progress = meteorTime / 500;
         const startX = FIELD_SIZE * 0.8;
         const startY = FIELD_SIZE * 0.2;
         ctx.beginPath();
         ctx.moveTo(startX - progress * 400, startY + progress * 400);
         ctx.lineTo(startX - progress * 400 + 40, startY + progress * 400 - 40);
         ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
         ctx.lineWidth = 2;
         ctx.stroke();
      }
      ctx.restore();

      // Twinkles
      data.twinkles = data.twinkles.filter(t => time - t.time < 800);
      for (const t of data.twinkles) {
        const age = time - t.time;
        const progress = age / 800;
        const tScale = 1 + progress;
        const alpha = 1 - progress;
        
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(time / 100);
        ctx.scale(tScale, tScale);
        ctx.fillStyle = `rgba(253, 224, 71, ${alpha})`; // yellow-300
        ctx.beginPath();
        for (let j=0; j<5; j++) {
           ctx.lineTo(Math.cos((18+j*72)*Math.PI/180)*15, -Math.sin((18+j*72)*Math.PI/180)*15);
           ctx.lineTo(Math.cos((54+j*72)*Math.PI/180)*6, -Math.sin((54+j*72)*Math.PI/180)*6);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw Trail (Constellation)
      if (data.history.length > 0) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(data.head.x, data.head.y);
        for (let i = 0; i < data.history.length; i += 2) {
          ctx.lineTo(data.history[i].x, data.history[i].y);
        }
        ctx.strokeStyle = isDead ? '#475569' : 'rgba(253, 224, 71, 0.4)'; // yellow-300 with opacity
        ctx.lineWidth = 3;
        ctx.stroke();

        for (let i = 0; i < data.history.length; i += SEGMENT_SPACING) {
          ctx.save();
          ctx.translate(data.history[i].x, data.history[i].y);
          ctx.rotate(time / 500 + i);
          
          ctx.fillStyle = isDead ? '#64748b' : '#fde047';
          ctx.beginPath();
          for (let j=0; j<5; j++) {
             ctx.lineTo(Math.cos((18+j*72)*Math.PI/180)*8, -Math.sin((18+j*72)*Math.PI/180)*8);
             ctx.lineTo(Math.cos((54+j*72)*Math.PI/180)*4, -Math.sin((54+j*72)*Math.PI/180)*4);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      // Draw Kid
      ctx.save();
      ctx.translate(data.head.x, data.head.y);
      const angle = (data.vx === 0 && data.vy === 0) ? -Math.PI / 2 : Math.atan2(data.vy, data.vx);
      
      // Add wobble when walking
      const wobble = isMoving && !isDead ? Math.sin(time / 60) * 0.15 : 0;
      ctx.rotate(angle + Math.PI/2 + wobble);
      ctx.scale(1.5, 1.5);
      
      // Bag (scales with score)
      const scoreScale = Math.min(bridge.current.score / 15, 20);
      ctx.fillStyle = isDead ? '#78350f' : '#b45309'; // amber-900 / amber-700
      ctx.beginPath();
      ctx.ellipse(0, 6 + scoreScale, 10 + scoreScale * 0.6, 6 + scoreScale * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Draw star logo on bag
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      for (let j=0; j<5; j++) {
         ctx.lineTo(Math.cos((18+j*72)*Math.PI/180)*4, 6+scoreScale - Math.sin((18+j*72)*Math.PI/180)*4);
         ctx.lineTo(Math.cos((54+j*72)*Math.PI/180)*2, 6+scoreScale - Math.sin((54+j*72)*Math.PI/180)*2);
      }
      ctx.closePath();
      ctx.fill();
      
      // Hands (swinging)
      ctx.fillStyle = isDead ? '#cbd5e1' : '#ffad60';
      const handSwing = isMoving && !isDead ? Math.sin(time / 60) * 4 : 0;
      ctx.fillRect(-14, 2 + handSwing, 6, 6);
      ctx.fillRect(8, 2 - handSwing, 6, 6);

      // Feet (swinging)
      ctx.fillStyle = isDead ? '#475569' : '#334155';
      const footSwing = isMoving && !isDead ? Math.sin(time / 60) * 5 : 0;
      ctx.fillRect(-8, 6 - footSwing, 6, 8);
      ctx.fillRect(2, 6 + footSwing, 6, 8);
      
      // Face
      ctx.fillStyle = isDead ? '#cbd5e1' : '#ffad60'; 
      ctx.fillRect(-10, -10, 20, 20);
      
      // Hair 
      ctx.fillStyle = isDead ? '#64748b' : '#654321';
      ctx.fillRect(-12, -14, 24, 8);
      ctx.fillRect(-12, -6, 4, 10);
      ctx.fillRect(8, -6, 4, 10);
      
      // Eyes
      ctx.fillStyle = isDead ? '#475569' : 'black';
      if (isDead) {
        // X eyes
        ctx.fillRect(-7, -3, 2, 2); ctx.fillRect(-5, -1, 2, 2); ctx.fillRect(-3, -3, 2, 2); ctx.fillRect(-7, 1, 2, 2); ctx.fillRect(-3, 1, 2, 2);
        ctx.fillRect(3, -3, 2, 2); ctx.fillRect(5, -1, 2, 2); ctx.fillRect(7, -3, 2, 2); ctx.fillRect(3, 1, 2, 2); ctx.fillRect(7, 1, 2, 2);
      } else {
        ctx.fillRect(-6, -2, 4, 4);
        ctx.fillRect(2, -2, 4, 4);
      }
      ctx.restore();

      // Draw Food (Star)
      if (bridge.current.gameState !== 'GAME_OVER') {
        const pulse = 1 + Math.sin(time / 150) * 0.1;
        const fX = data.food.x;
        const fY = data.food.y;
        
        ctx.save();
        ctx.translate(fX, fY);
        ctx.rotate(time / 500);
        ctx.scale(pulse, pulse);
        ctx.beginPath();
        for (let j=0; j<5; j++) {
           ctx.lineTo(Math.cos((18+j*72)*Math.PI/180)*FOOD_RADIUS, -Math.sin((18+j*72)*Math.PI/180)*FOOD_RADIUS);
           ctx.lineTo(Math.cos((54+j*72)*Math.PI/180)*(FOOD_RADIUS*0.4), -Math.sin((54+j*72)*Math.PI/180)*(FOOD_RADIUS*0.4));
        }
        ctx.closePath();
        ctx.fillStyle = '#fbbf24'; // amber-400
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#f59e0b';
        ctx.fill();
        ctx.restore();
      }
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
        if (state === 'READY') {
          spawnKid();
          bridge.current.gameState = 'PLAYING';
          setGameState('PLAYING');
        } else if (state === 'GAME_OVER') {
          bridge.current.score = 0;
          bridge.current.gameState = 'READY';
          setScore(0);
          setGameState('READY');
          spawnKid();
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
    spawnKid();
    spawnFood();
    window.addEventListener('keydown', handleKeyDown);
    animationFrameId = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="h-screen w-full bg-slate-950 text-slate-100 flex flex-col p-4 md:p-6 font-sans overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none z-0 opacity-50" style={{ backgroundImage: "radial-gradient(1px 1px at 20px 30px, #ffffff, rgba(0,0,0,0)), radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.8), rgba(0,0,0,0)), radial-gradient(2px 2px at 90px 40px, #ffffff, rgba(0,0,0,0)), radial-gradient(1px 1px at 160px 120px, rgba(255,255,255,0.6), rgba(0,0,0,0))", backgroundRepeat: "repeat", backgroundSize: "150px 150px" }}></div>
      <div className="absolute top-[10%] left-[5%] w-32 h-10 bg-white/5 blur-xl rounded-full pointer-events-none z-0"></div>
      <div className="absolute top-[30%] right-[10%] w-48 h-16 bg-indigo-400/5 blur-2xl rounded-full pointer-events-none z-0"></div>
      
      {/* App Header */}
      <header className="flex justify-between items-center mb-4 md:mb-6 shrink-0 bg-slate-900/80 backdrop-blur border border-slate-800 shadow-lg relative z-10 p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-900/50 rounded-lg flex items-center justify-center border border-indigo-500/30 shadow-inner">
            <Star className="w-5 h-5 md:w-6 md:h-6 text-yellow-400 fill-current" />
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500">
            DStarSeeker
          </h1>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 md:gap-6 flex-1 min-h-0 overflow-y-auto md:overflow-hidden pb-6 md:pb-0 z-10 relative">
        
        {/* Game Window */}
        <section className="col-span-1 md:col-span-8 md:row-span-6 bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-3 md:p-5 flex flex-col shadow-xl relative h-[50vh] md:h-auto min-h-[400px]">
          <div className="w-full h-full flex items-center justify-center relative bg-[#0B1021] rounded-2xl overflow-hidden ring-1 ring-slate-800 shadow-inner">
             
             {/* Night sky subtle gradient inside canvas area */}
             <div className="absolute inset-0 pointer-events-none opacity-30 z-0 bg-gradient-to-b from-indigo-950 to-slate-950"></div>

             {/* Physics Game Canvas */}
             <canvas 
               ref={canvasRef} 
               width={FIELD_SIZE} 
               height={FIELD_SIZE} 
               className="w-full h-full object-contain z-10" 
             />

             {/* UI Overlays inside Canvas Area */}
             {gameState === 'READY' && (
               <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm cursor-pointer transition-colors hover:bg-slate-900/60" onClick={() => actionsRef.current?.action()}>
                  <span className="text-yellow-400 text-lg md:text-xl font-bold uppercase tracking-widest animate-pulse border border-yellow-500/50 px-8 py-3 rounded-full bg-slate-900/80 shadow-lg drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">Start Game</span>
               </div>
             )}

             {gameState === 'GAME_OVER' && (
               <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md">
                  <span className="text-amber-500 text-2xl md:text-4xl font-black uppercase tracking-widest mb-6 italic shadow-black drop-shadow-lg">Game Over</span>
                  <button onClick={() => actionsRef.current?.action()} className="px-8 py-3 bg-indigo-600 border border-indigo-400 text-white hover:bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)] uppercase font-bold text-sm transition-all tracking-widest">
                    Play Again
                  </button>
               </div>
             )}
          </div>

          <div className="mt-4 flex justify-between items-center px-4 w-full text-slate-500">
             <div className="text-[10px] md:text-xs uppercase font-bold tracking-widest text-slate-400">Movement Controls</div>
             {/* D-PAD for visual guide and mobile use */}
             <div className="flex gap-2">
                 <button onClick={() => actionsRef.current?.left()} className="w-10 h-10 md:w-12 md:h-12 border border-slate-700 bg-slate-800 rounded flex items-center justify-center hover:bg-slate-700 transition-colors active:bg-indigo-900"><ChevronLeft className="w-6 h-6 text-slate-400" /></button>
                 <div className="flex flex-col gap-2">
                    <button onClick={() => actionsRef.current?.up()} className="w-10 h-10 md:w-12 md:h-12 border border-slate-700 bg-slate-800 rounded flex items-center justify-center hover:bg-slate-700 transition-colors active:bg-indigo-900"><ChevronUp className="w-6 h-6 text-slate-400" /></button>
                    <button onClick={() => actionsRef.current?.down()} className="w-10 h-10 md:w-12 md:h-12 border border-slate-700 bg-slate-800 rounded flex items-center justify-center hover:bg-slate-700 transition-colors active:bg-indigo-900"><ChevronDown className="w-6 h-6 text-slate-400" /></button>
                 </div>
                 <button onClick={() => actionsRef.current?.right()} className="w-10 h-10 md:w-12 md:h-12 border border-slate-700 bg-slate-800 rounded flex items-center justify-center hover:bg-slate-700 transition-colors active:bg-indigo-900"><ChevronRight className="w-6 h-6 text-slate-400" /></button>
             </div>
          </div>
        </section>

        {/* Right Sidebar - Scoreboard & Stats */}
        <aside className="col-span-1 md:col-span-4 md:row-span-6 flex flex-col gap-4">
            
            {/* Title Banner */}
            <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group shrink-0">
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 blur-[40px] rounded-full" />
                 <div className="flex items-center gap-3 mb-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <Star className="w-3 h-3 text-indigo-400 animate-pulse absolute top-4 left-9" />
                    <Star className="w-2 h-2 text-indigo-300 absolute top-5 left-12" />
                    <h2 className="text-xl font-black tracking-widest uppercase text-slate-100 relative z-10 ml-2">
                      Scoreboard
                    </h2>
                 </div>
                 <p className="text-xs font-medium text-slate-400 relative z-10">Local Statistics & Leaderboard</p>
            </div>

             {/* Scores */}
             <div className="flex-1 flex flex-col gap-4 min-h-0">
               <div className="flex-1 bg-indigo-950/50 border border-indigo-900/50 rounded-3xl p-5 shadow-xl flex flex-col justify-center relative overflow-hidden group">
                   <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none" />
                   <span className="uppercase text-[10px] md:text-xs font-black tracking-widest text-indigo-400 mb-2 mt-1">Current Run</span>
                   <div className="font-mono text-4xl md:text-5xl font-black text-indigo-100 tracking-tight flex items-end gap-2">
                     {score.toString().padStart(4, '0')}
                     <Star className="w-6 h-6 text-yellow-400 mb-2 opacity-80" />
                   </div>
               </div>
               
               <div className="bg-amber-950/30 border border-amber-900/30 rounded-3xl p-5 shadow-xl flex flex-col justify-center shrink-0 relative overflow-hidden">
                   <Star className="w-20 h-20 text-amber-500/5 absolute -top-5 -right-5 pointer-events-none" />
                   <span className="uppercase text-[10px] md:text-xs font-black tracking-widest text-amber-500/70 mb-1">Personal Best</span>
                   <div className="font-mono text-2xl md:text-3xl font-bold text-amber-400">
                     {highScore.toString().padStart(4, '0')}
                   </div>
               </div>
             </div>
        </aside>

      </main>
    </div>
  );
}

