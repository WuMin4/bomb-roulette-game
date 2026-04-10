import { useState, useEffect, useRef } from 'react';
import { GameHost } from './game/Host';
import { GameClient } from './game/Client';
import { GameState, ServerMessage, Player } from './game/types';
import Lobby from './components/Lobby';
import Board from './components/Board';
import PlayerList from './components/PlayerList';
import ActionPanel from './components/ActionPanel';
import { Toaster, toast } from 'react-hot-toast';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [localPlayerId, setLocalPlayerId] = useState<string>('');
  const [privateHints, setPrivateHints] = useState<{r: number, c: number, count: number}[]>([]);
  const [shakeCells, setShakeCells] = useState<{r: number, c: number}[]>([]);
  const [damagePlayer, setDamagePlayer] = useState<string | null>(null);
  
  const hostRef = useRef<GameHost | null>(null);
  const clientRef = useRef<GameClient | null>(null);

  const handleStateChange = (state: GameState) => {
    setGameState(state);
  };

  useEffect(() => {
    if (gameState?.phase === 'placement') {
      setPrivateHints([]);
    }
  }, [gameState?.phase]);

  const handlePrivateMessage = (msg: ServerMessage) => {
    if (msg.type === 'private_hint') {
      setPrivateHints(prev => [...prev, {r: msg.r, c: msg.c, count: msg.count}]);
      toast(`该格子有 ${msg.count} 个炸弹`, { icon: '🔍' });
    } else if (msg.type === 'shake') {
      setShakeCells(prev => [...prev, {r: msg.r, c: msg.c}]);
      setTimeout(() => {
        setShakeCells(prev => prev.filter(c => c.r !== msg.r || c.c !== msg.c));
      }, 500);
    } else if (msg.type === 'damage') {
      setDamagePlayer(msg.playerId);
      if (msg.playerId === localPlayerId) {
        // Red flash effect for local player
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-red-500/30 pointer-events-none z-50 transition-opacity duration-300';
        document.body.appendChild(overlay);
        setTimeout(() => {
          overlay.style.opacity = '0';
          setTimeout(() => overlay.remove(), 300);
        }, 100);
      }
      setTimeout(() => setDamagePlayer(null), 500);
    }
  };

  const createRoom = async (name: string) => {
    const host = new GameHost(handleStateChange, handlePrivateMessage);
    await host.init();
    hostRef.current = host;
    
    // Connect to self
    const client = new GameClient(handleStateChange, handlePrivateMessage, (err) => toast.error(err));
    const id = await client.connect(host.state.roomId, name);
    setLocalPlayerId(id);
    clientRef.current = client;
  };

  const joinRoom = async (roomId: string, name: string) => {
    const client = new GameClient(handleStateChange, handlePrivateMessage, (err) => toast.error(err));
    const id = await client.connect(roomId, name);
    setLocalPlayerId(id);
    clientRef.current = client;
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex items-center justify-center">
        <Lobby onCreate={createRoom} onJoin={joinRoom} />
        <Toaster position="top-center" />
      </div>
    );
  }

  const localPlayer = gameState.players.find(p => p.id === localPlayerId);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col">
      <header className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
        <h1 className="text-xl font-bold tracking-wider">轮盘扫雷</h1>
        <div className="text-zinc-400">房间号: <span className="text-white font-mono tracking-widest">{gameState.roomId}</span></div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-4 gap-6 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          {gameState.phase === 'lobby' ? (
            <div className="text-center space-y-6">
              <h2 className="text-2xl font-medium">等待玩家加入...</h2>
              <div className="text-zinc-400">当前人数: {gameState.players.length}/4</div>
              {localPlayer?.isHost && (
                <div className="flex gap-4 justify-center">
                  <button 
                    onClick={() => clientRef.current?.sendIntent({ type: 'add_ai' })}
                    disabled={gameState.players.length >= 4}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50"
                  >
                    添加 AI
                  </button>
                  <button 
                    onClick={() => clientRef.current?.sendIntent({ type: 'start_game' })}
                    disabled={gameState.players.length < 2}
                    className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-md font-medium transition-colors disabled:opacity-50"
                  >
                    开始游戏
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Board 
              gameState={gameState} 
              localPlayerId={localPlayerId} 
              client={clientRef.current!} 
              privateHints={privateHints}
              shakeCells={shakeCells}
            />
          )}
        </div>

        <div className="w-full md:w-80 flex flex-col gap-4">
          <PlayerList gameState={gameState} localPlayerId={localPlayerId} damagePlayer={damagePlayer} />
          <ActionPanel gameState={gameState} localPlayerId={localPlayerId} client={clientRef.current!} />
          
          <div className="flex-1 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 overflow-y-auto flex flex-col">
            <h3 className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wider">游戏日志</h3>
            <div className="flex-1 space-y-1 text-sm flex flex-col">
              {[...gameState.logs].reverse().map((log, i) => (
                <div key={i} className="text-zinc-300">{log}</div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Toaster position="top-center" theme="dark" />
    </div>
  );
}
