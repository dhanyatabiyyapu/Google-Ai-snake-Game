/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Trophy, RefreshCw, Gamepad2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Music, Volume2 } from 'lucide-react';

// --- CONFIGURATION ---
const GRID_SIZE = 20;
const CELL_SIZE = 100 / GRID_SIZE; // percentage per cell
const INITIAL_SNAKE = [{ x: 10, y: 10 }, { x: 10, y: 11 }, { x: 10, y: 12 }];
const INITIAL_DIR = { x: 0, y: -1 };

// AI Generated / Public Domain Dummy Tracks
const TRACKS = [
  {
    id: 1,
    title: "Cybernetic Horizon",
    artist: "Neon Synth",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    cover: "https://images.unsplash.com/photo-1614850715649-1d0106293cb1?auto=format&fit=crop&q=80&w=300&h=300"
  },
  {
    id: 2,
    title: "Digital Flow",
    artist: "Neural Network",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    cover: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&q=80&w=300&h=300"
  },
  {
    id: 3,
    title: "Bitstream Protocol",
    artist: "The Void Process",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    cover: "https://images.unsplash.com/photo-1618331835717-801e976710b2?auto=format&fit=crop&q=80&w=300&h=300"
  }
];

export default function App() {
  // --- SNAKE GAME STATE ---
  const [gameState, setGameState] = useState({
    snake: INITIAL_SNAKE,
    food: { x: 5, y: 5 },
    direction: INITIAL_DIR,
    gameOver: false,
    isStarted: false,
    score: 0,
    highScore: 0
  });
  
  const nextDirection = useRef(INITIAL_DIR);

  // --- MUSIC PLAYER STATE ---
  const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const activeTrack = TRACKS[currentTrackIdx];

  // --- SNAKE GAME LOGIC ---
  const resetGame = () => {
    setGameState(prev => ({
      ...prev,
      snake: INITIAL_SNAKE,
      food: { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) },
      direction: INITIAL_DIR,
      gameOver: false,
      isStarted: true,
      score: 0
    }));
    nextDirection.current = INITIAL_DIR;
  };

  const triggerDirection = (dirStr: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (gameState.gameOver) return;
    if (!gameState.isStarted) {
      setGameState(prev => ({ ...prev, isStarted: true }));
    }
    if (dirStr === 'UP') nextDirection.current = { x: 0, y: -1 };
    if (dirStr === 'DOWN') nextDirection.current = { x: 0, y: 1 };
    if (dirStr === 'LEFT') nextDirection.current = { x: -1, y: 0 };
    if (dirStr === 'RIGHT') nextDirection.current = { x: 1, y: 0 };
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === "Space") {
        if (gameState.gameOver) resetGame();
        else if (!gameState.isStarted) setGameState(prev => ({ ...prev, isStarted: true }));
        return;
      }

      if (gameState.gameOver) return;
      if (!gameState.isStarted && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
        setGameState(prev => ({ ...prev, isStarted: true }));
      }

      switch (e.code) {
        case "ArrowUp": case "KeyW": nextDirection.current = { x: 0, y: -1 }; break;
        case "ArrowDown": case "KeyS": nextDirection.current = { x: 0, y: 1 }; break;
        case "ArrowLeft": case "KeyA": nextDirection.current = { x: -1, y: 0 }; break;
        case "ArrowRight": case "KeyD": nextDirection.current = { x: 1, y: 0 }; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.gameOver, gameState.isStarted]);

  // Game Loop
  useEffect(() => {
    if (gameState.gameOver || !gameState.isStarted) return;

    // Increase speed as score increases (maxes out around ~50ms)
    const speed = Math.max(55, 140 - (gameState.score / 10) * 4);
    
    const interval = setInterval(() => {
      setGameState(prev => {
        if (prev.gameOver || !prev.isStarted) return prev;

        const currentDir = nextDirection.current;

        // Prevent 180 reversing if there's length > 1
        if (prev.snake.length > 1) {
          if (prev.direction.x !== 0 && currentDir.x === -prev.direction.x) {
            currentDir.x = prev.direction.x;
          }
          if (prev.direction.y !== 0 && currentDir.y === -prev.direction.y) {
            currentDir.y = prev.direction.y;
          }
        }

        const head = prev.snake[0];
        const newHead = { x: head.x + currentDir.x, y: head.y + currentDir.y };

        // 1. Wall Collision
        if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
          return { ...prev, gameOver: true, direction: currentDir };
        }
        
        // 2. Self Collision
        if (prev.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          return { ...prev, gameOver: true, direction: currentDir };
        }

        const newSnake = [newHead, ...prev.snake];
        let newFood = prev.food;
        let newScore = prev.score;
        let newHighScore = prev.highScore;

        // 3. Food Collection
        if (newHead.x === newFood.x && newHead.y === newFood.y) {
          newScore += 10;
          if (newScore > newHighScore) newHighScore = newScore;
          
          // Generate new food that's not on the snake
          let isValidFood = false;
          while (!isValidFood) {
            newFood = {
              x: Math.floor(Math.random() * GRID_SIZE),
              y: Math.floor(Math.random() * GRID_SIZE)
            };
            isValidFood = !newSnake.some(s => s.x === newFood.x && s.y === newFood.y);
          }
        } else {
          newSnake.pop(); // Remove tail if we didn't eat
        }

        return {
          ...prev,
          snake: newSnake,
          food: newFood,
          direction: currentDir,
          score: newScore,
          highScore: newHighScore
        };
      });
    }, speed);

    return () => clearInterval(interval);
  }, [gameState.gameOver, gameState.isStarted, gameState.score]);

  // --- MUSIC PLAYER LOGIC ---
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    setCurrentTrackIdx(prev => (prev + 1) % TRACKS.length);
    setIsPlaying(true); // Persist playing state onto next track
  };

  const prevTrack = () => {
    setCurrentTrackIdx(prev => (prev - 1 + TRACKS.length) % TRACKS.length);
    setIsPlaying(true);
  };

  // Keep track playing automatically when it switches
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      // Must wait slightly or catch promise rejections on fast switches
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => console.log('Audio loading:', e));
      }
    }
  }, [currentTrackIdx, isPlaying]);

  // Update Progress Bar
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateProgress = () => setProgress((audio.currentTime / audio.duration) * 100 || 0);
    audio.addEventListener('timeupdate', updateProgress);
    return () => audio.removeEventListener('timeupdate', updateProgress);
  }, []);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pos * audioRef.current.duration;
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen w-full bg-[#020617] text-slate-100 flex flex-col p-4 md:p-6 font-sans overflow-hidden">
      {/* App Header */}
      <header className="flex justify-between items-center mb-4 md:mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-cyan-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <div className="w-4 h-4 md:w-6 md:h-6 border-2 border-slate-900"></div>
          </div>
          <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
            NeonStrike FM
          </h1>
        </div>
        <div className="flex gap-2 md:gap-4 hidden sm:flex">
          <div className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-900/50 border border-slate-800 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400">
            Session: 00:42:15
          </div>
          <div className="px-3 py-1.5 md:px-4 md:py-2 bg-slate-900/50 border border-slate-800 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest text-cyan-400">
            Network: Stable
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 md:gap-6 flex-1 min-h-0 overflow-y-auto md:overflow-hidden pb-6 md:pb-0">
        
        {/* Music Player Card */}
        <section className="col-span-1 md:col-span-3 md:row-span-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          {isPlaying && (
            <div className="absolute top-0 right-0 p-4">
              <div className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse"></div>
            </div>
          )}
          
          <div className="space-y-4">
            <div className="w-full aspect-square bg-gradient-to-br from-slate-800 to-slate-950 rounded-2xl border border-slate-700 flex items-center justify-center p-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
              
              <img 
                 src={activeTrack.cover} 
                 alt={activeTrack.title} 
                 className={`absolute inset-0 w-full h-full object-cover opacity-40 transition-transform duration-[20s] ease-linear overflow-hidden ${isPlaying ? 'scale-125' : 'scale-100'}`} 
              />

              <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-[3px] md:border-4 border-fuchsia-500/30 flex items-center justify-center relative z-10 backdrop-blur-sm">
                <div className="w-[72px] h-[72px] md:w-24 md:h-24 rounded-full border-[3px] md:border-4 border-fuchsia-500 flex items-center justify-center bg-slate-900 shadow-[0_0_30px_rgba(217,70,239,0.3)]">
                  {isPlaying ? (
                     <div className="w-3 h-3 md:w-4 md:h-4 bg-fuchsia-500 rounded-full animate-bounce"></div>
                  ) : (
                     <div className="w-3 h-3 md:w-4 md:h-4 bg-fuchsia-500 rounded-full"></div>
                  )}
                </div>
              </div>
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold truncate text-fuchsia-400">{activeTrack.title}</h2>
              <p className="text-xs md:text-sm text-slate-400">{activeTrack.artist}</p>
            </div>
          </div>

          <div className="space-y-4 md:space-y-6 mt-4 md:mt-0">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500 tracking-tighter">
                <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
                <span>{formatTime(audioRef.current?.duration || 0)}</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden cursor-pointer" onClick={handleSeek}>
                <div className="h-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-75" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
            <div className="flex justify-between items-center px-2">
              <button onClick={prevTrack} className="p-2 text-slate-400 hover:text-white transition-colors">
                 <SkipBack className="w-5 h-5 md:w-6 md:h-6 fill-current" />
              </button>
              <button onClick={togglePlay} className="w-12 h-12 md:w-14 md:h-14 bg-white rounded-full flex items-center justify-center text-slate-950 shadow-xl hover:scale-105 active:scale-95 transition-all">
                {isPlaying ? 
                  <Pause className="w-6 h-6 md:w-8 md:h-8 fill-current" /> : 
                  <Play className="w-6 h-6 md:w-8 md:h-8 fill-current translate-x-0.5" />
                }
              </button>
              <button onClick={nextTrack} className="p-2 text-slate-400 hover:text-white transition-colors">
                 <SkipForward className="w-5 h-5 md:w-6 md:h-6 fill-current" />
              </button>
            </div>
          </div>
        </section>

        {/* Game Window */}
        <section className="col-span-1 md:col-span-6 md:row-span-6 bg-black border-2 border-cyan-500/50 rounded-3xl p-3 md:p-4 flex flex-col shadow-[0_0_50px_rgba(6,182,212,0.15)] overflow-hidden h-[500px] md:h-auto">
          <div className="flex justify-between items-center mb-3 md:mb-4 px-1 md:px-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-green-500">Engine Active</span>
            </div>
            <div className="flex gap-4">
              <div className="text-right">
                <p className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Current Score</p>
                <p className="text-xl md:text-2xl font-mono font-bold text-cyan-400">{gameState.score.toString().padStart(4, '0')}</p>
              </div>
            </div>
          </div>
          
          {/* Snake Grid Simulation using our logic */}
          <div className="flex-1 bg-slate-950/50 border border-slate-900 rounded-xl relative overflow-hidden">
            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-5 z-0" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }}></div>

            {/* Render Food */}
            <div className="absolute bg-red-500 rounded-sm shadow-[0_0_12px_rgba(239,68,68,0.8)] z-10" 
                 style={{ left: `${gameState.food.x * CELL_SIZE}%`, top: `${gameState.food.y * CELL_SIZE}%`, width: `${CELL_SIZE}%`, height: `${CELL_SIZE}%` }} />
            
            {/* Render Snake */}
            {gameState.snake.map((segment, i) => {
              const isHead = i === 0;
              return (
                <div 
                  key={i} 
                  className={`absolute rounded-[2px] transition-all duration-75 ${isHead ? 'bg-cyan-500 border-t border-l border-white/30 shadow-[0_0_15px_rgba(6,182,212,0.9)] z-20' : 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)] z-10'}`}
                  style={{ 
                    left: `${segment.x * CELL_SIZE}%`, 
                    top: `${segment.y * CELL_SIZE}%`, 
                    width: `${CELL_SIZE}%`, 
                    height: `${CELL_SIZE}%`
                  }} 
                />
              );
            })}

            {/* Overlays for Ready / Game Over */}
            {!gameState.isStarted && !gameState.gameOver && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer transition-colors hover:bg-black/50" onClick={() => triggerDirection('UP')}>
                 <span className="text-cyan-400 text-lg md:text-xl font-bold uppercase tracking-widest animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">Start Protocol</span>
              </div>
            )}

            {gameState.gameOver && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                 <span className="text-fuchsia-500 text-xl md:text-2xl font-black uppercase tracking-widest mb-4 drop-shadow-[0_0_10px_rgba(217,70,239,0.8)]">System Failure</span>
                 <button onClick={resetGame} className="px-6 py-2 border border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black rounded uppercase font-bold text-xs md:text-sm transition-colors tracking-widest">
                   Reboot Sequence
                 </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-center gap-8">
            <div className="flex flex-col items-center">
              <div className="grid grid-cols-3 gap-1">
                <div className=""></div>
                <div className="w-8 h-8 md:w-10 md:h-10 border border-slate-700 rounded flex items-center justify-center text-xs md:text-sm text-slate-500 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => triggerDirection('UP')}>W</div>
                <div className=""></div>
                <div className="w-8 h-8 md:w-10 md:h-10 border border-slate-700 rounded flex items-center justify-center text-xs md:text-sm text-slate-500 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => triggerDirection('LEFT')}>A</div>
                <div className="w-8 h-8 md:w-10 md:h-10 border border-cyan-500/40 rounded flex items-center justify-center text-xs md:text-sm text-cyan-400 bg-cyan-500/10 cursor-pointer hover:bg-cyan-500/30 transition-colors" onClick={() => triggerDirection('DOWN')}>S</div>
                <div className="w-8 h-8 md:w-10 md:h-10 border border-slate-700 rounded flex items-center justify-center text-xs md:text-sm text-slate-500 cursor-pointer hover:bg-slate-800 transition-colors" onClick={() => triggerDirection('RIGHT')}>D</div>
              </div>
              <p className="text-[9px] md:text-[10px] uppercase font-bold text-slate-600 mt-2">Manual Controls Backup</p>
            </div>
          </div>
        </section>

        {/* Stats Card */}
        <section className="col-span-1 md:col-span-3 md:row-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-4 md:p-5 flex flex-col gap-3">
          <h3 className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">Leaderboard</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-1.5 md:py-1 border-b border-slate-800/50">
              <span className="text-xs font-medium text-slate-300 tracking-wide">01. HIGH SCORE</span>
              <span className="text-xs font-mono text-cyan-400">{gameState.highScore.toString().padStart(4, '0')}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 md:py-1 border-b border-slate-800/50">
              <span className="text-xs font-medium text-slate-300 tracking-wide">02. CURRENT RUN</span>
              <span className="text-xs font-mono text-amber-400">{gameState.score.toString().padStart(4, '0')}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 md:py-1 border-b border-slate-800/50">
              <span className="text-xs font-medium text-slate-500 tracking-wide">03. NEXT GOAL</span>
              <span className="text-xs font-mono text-slate-500">{Math.max(gameState.highScore + 100, 100).toString().padStart(4, '0')}</span>
            </div>
          </div>
        </section>

        {/* Playlist Card */}
        <section className="col-span-1 md:col-span-3 md:row-span-4 bg-slate-900/80 border border-slate-800 rounded-3xl p-4 md:p-5 flex flex-col">
          <h3 className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] mb-4">Upcoming / Tracklist</h3>
          <div className="flex-1 space-y-2 md:space-y-3 overflow-y-auto pr-1">
            {TRACKS.map((track, idx) => {
              const isActive = idx === currentTrackIdx;
              return (
                <div 
                   key={track.id} 
                   onClick={() => { setCurrentTrackIdx(idx); setIsPlaying(true); }}
                   className={`flex gap-3 items-center p-2 rounded-xl transition-colors cursor-pointer ${isActive ? 'bg-cyan-500/10 border border-cyan-500/20' : 'hover:bg-slate-800/40'}`}
                >
                  <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center bg-slate-800 overflow-hidden ${isActive ? '' : 'border border-slate-700'}`}>
                    {isActive && isPlaying ? (
                      <>
                        <div className="w-1.5 h-4 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-1.5 h-6 bg-cyan-400 rounded-full mx-0.5 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-1.5 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                      </>
                    ) : (
                      <Music className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${isActive ? 'text-cyan-400' : 'text-slate-200'}`}>{track.title}</p>
                    <p className="text-[10px] text-slate-500 uppercase">{isActive ? (isPlaying ? 'Playing Now' : 'Paused') : 'Queued'}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => setIsPlaying(!isPlaying)} className="mt-4 w-full py-2.5 border border-slate-700 rounded-xl text-[10px] md:text-xs uppercase font-bold text-slate-400 hover:text-white hover:border-slate-500 transition-colors">
            {isPlaying ? 'Pause Queue' : 'Start Queue'}
          </button>
        </section>

        {/* Visualizer Card (Hidden on very small screens to fit cleanly) */}
        <section className="hidden md:flex flex-col col-span-3 row-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-5 justify-end gap-1 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-t from-fuchsia-500/5 to-transparent pointer-events-none"></div>
          <div className="flex items-end justify-between h-16 px-2 relative z-10 w-full opacity-80">
            {[20, 60, 90, 40, 80, 30, 70, 100, 50, 80, 30, 60, 40, 90].map((h, i) => (
              <div 
                key={i} 
                className={`w-1 rounded-t-full ${i % 2 === 0 ? 'bg-fuchsia-500' : 'bg-cyan-500'}`} 
                style={{ 
                   height: isPlaying ? `${Math.floor(Math.random() * 60) + 20}%` : '8%',
                   transition: 'height 0.15s ease-out'
                }}
              ></div>
            ))}
          </div>
          <p className="text-[9px] uppercase font-bold text-center text-slate-600 mt-2 tracking-widest relative z-10">Audio Spectral Output</p>
        </section>

      </main>

      {/* Hidden Audio Player Element */}
      <audio 
        ref={audioRef} 
        src={activeTrack.url} 
        onEnded={nextTrack} 
        preload="auto"
      />
    </div>
  );
}
