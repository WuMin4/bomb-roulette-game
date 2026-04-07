import { GameState } from '../game/types';
import { GameClient } from '../game/Client';

export default function ActionPanel({ gameState, localPlayerId, client }: { gameState: GameState, localPlayerId: string, client: GameClient }) {
  const localPlayer = gameState.players.find(p => p.id === localPlayerId);
  const isMyTurn = gameState.phase === 'reveal' && gameState.players[gameState.turn].id === localPlayerId;

  if (gameState.phase === 'gameover') {
    return (
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 flex flex-col items-center gap-4">
        <h3 className="text-xl font-bold text-white">游戏结束</h3>
        {localPlayer?.isHost && (
          <button
            onClick={() => client.sendIntent({ type: 'play_again' })}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors"
          >
            再来一局
          </button>
        )}
      </div>
    );
  }

  if (gameState.phase !== 'reveal') return null;

  return (
    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 flex flex-col gap-4">
      <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">操作面板</h3>
      
      {isMyTurn ? (
        <div className="space-y-3">
          <div className="text-zinc-200 font-medium text-center py-2 bg-zinc-800 rounded-lg">
            你的回合
          </div>
          
          {!gameState.pendingAction ? (
            <div className="space-y-2">
              <p className="text-xs text-zinc-400 text-center">点击棋盘翻开一个格子，或使用轮盘</p>
              <button
                onClick={() => client.sendIntent({ type: 'action_roulette' })}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
              >
                <span>🎲</span> 随机轮盘
              </button>
            </div>
          ) : (
            <div className="p-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg text-center space-y-2">
              <div className="text-indigo-300 font-medium">
                {getPendingActionText(gameState.pendingAction.type, gameState.pendingAction.count)}
              </div>
              <p className="text-xs text-zinc-400">请在棋盘上进行选择</p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-6 text-zinc-500">
          等待 {gameState.players[gameState.turn]?.name} 操作...
        </div>
      )}
    </div>
  );
}

function getPendingActionText(type: string, count?: number) {
  switch (type) {
    case 'select_3x3': return '请选择一个 3x3 区域的左上角';
    case 'select_1_private': return '请选择一个格子私密查看';
    case 'reveal_n': return `请选择 ${count} 个格子翻开`;
    case 'reveal_row': return '请选择要翻开的一行';
    case 'reveal_col': return '请选择要翻开的一列';
    case 'reveal_2x2': return '请选择一个 2x2 区域的左上角';
    default: return '请操作';
  }
}
