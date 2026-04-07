import { useState } from 'react';

export default function Lobby({ onCreate, onJoin }: { onCreate: (name: string) => void, onJoin: (roomId: string, name: string) => void }) {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');

  if (mode === 'menu') {
    return (
      <div className="flex flex-col items-center gap-6 p-8 bg-zinc-900/80 rounded-2xl border border-zinc-800 shadow-2xl w-full max-w-md">
        <h1 className="text-4xl font-bold tracking-widest text-white mb-4">轮盘扫雷</h1>
        <button 
          onClick={() => setMode('create')}
          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium text-lg transition-colors"
        >
          创建房间
        </button>
        <button 
          onClick={() => setMode('join')}
          className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium text-lg transition-colors"
        >
          加入房间
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-8 bg-zinc-900/80 rounded-2xl border border-zinc-800 shadow-2xl w-full max-w-md">
      <h2 className="text-2xl font-bold text-white mb-2">
        {mode === 'create' ? '创建房间' : '加入房间'}
      </h2>
      
      <div className="w-full space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">玩家昵称</label>
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)}
            placeholder="输入你的名字"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 transition-colors"
          />
        </div>

        {mode === 'join' && (
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">房间号</label>
            <input 
              type="text" 
              value={roomId} 
              onChange={e => setRoomId(e.target.value)}
              placeholder="6位数字"
              maxLength={6}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 transition-colors font-mono"
            />
          </div>
        )}
      </div>

      <div className="w-full flex gap-4 mt-4">
        <button 
          onClick={() => setMode('menu')}
          className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
        >
          返回
        </button>
        <button 
          onClick={() => {
            if (!name.trim()) return;
            if (mode === 'create') onCreate(name);
            else if (roomId.length === 6) onJoin(roomId, name);
          }}
          disabled={!name.trim() || (mode === 'join' && roomId.length !== 6)}
          className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          确定
        </button>
      </div>
    </div>
  );
}
