import { GameState } from '../game/types';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export default function PlayerList({ gameState, localPlayerId, damagePlayer }: { gameState: GameState, localPlayerId: string, damagePlayer: string | null }) {
  return (
    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
      <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider">玩家列表</h3>
      <div className="space-y-3">
        {gameState.players.map((player, idx) => {
          const isTurn = gameState.phase === 'reveal' && gameState.turn === idx;
          const isDead = player.hp <= 0;
          const isDamaged = damagePlayer === player.id;

          return (
            <motion.div 
              key={player.id}
              animate={isDamaged ? { x: [-5, 5, -5, 5, 0], backgroundColor: ['#ef4444', 'transparent'] } : {}}
              transition={{ duration: 0.4 }}
              className={twMerge(
                clsx(
                  "flex items-center justify-between p-3 rounded-lg border transition-all",
                  isTurn ? "border-zinc-500 bg-zinc-800" : "border-zinc-800 bg-zinc-900/50",
                  isDead && "opacity-50 grayscale"
                )
              )}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full shadow-sm"
                  style={{ backgroundColor: player.color }}
                />
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-200">
                    {player.name} {player.id === localPlayerId && '(你)'}
                  </span>
                  <div className="flex gap-2 text-xs">
                    <span className="text-yellow-500">得分: {player.score || 0}</span>
                    {isDead && player.rank && (
                      <span className="text-red-400">第 {player.rank} 名</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div 
                    key={i}
                    className={clsx(
                      "w-3 h-4 rounded-sm transition-colors",
                      i < player.hp ? "bg-red-500" : "bg-zinc-800"
                    )}
                  />
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
