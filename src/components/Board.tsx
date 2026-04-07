import { useState, useEffect } from 'react';
import { GameState, CellData } from '../game/types';
import { GameClient } from '../game/Client';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export default function Board({ 
  gameState, 
  localPlayerId, 
  client,
  privateHints,
  shakeCells
}: { 
  gameState: GameState, 
  localPlayerId: string, 
  client: GameClient,
  privateHints: {r: number, c: number, count: number}[],
  shakeCells: {r: number, c: number}[]
}) {
  const [placedBombs, setPlacedBombs] = useState<{r: number, c: number}[]>([]);
  const [selectedCells, setSelectedCells] = useState<{r: number, c: number}[]>([]);
  const [hoveredCell, setHoveredCell] = useState<{r: number, c: number} | null>(null);

  const localPlayer = gameState.players.find(p => p.id === localPlayerId);
  const isMyTurn = gameState.phase === 'reveal' && gameState.players[gameState.turn].id === localPlayerId;
  const pendingAction = gameState.pendingAction;

  useEffect(() => {
    if (gameState.phase !== 'placement') {
      setPlacedBombs([]);
    }
    setSelectedCells([]);
    setHoveredCell(null);
  }, [gameState.phase, gameState.turn]);

  const handleCellClick = (r: number, c: number) => {
    if (localPlayer?.hp === 0) return;

    if (gameState.phase === 'placement') {
      if (gameState.placedBombsCount[localPlayerId]) return; // Already placed
      
      const exists = placedBombs.findIndex(b => b.r === r && b.c === c);
      if (exists >= 0) {
        setPlacedBombs(prev => prev.filter((_, i) => i !== exists));
      } else if (placedBombs.length < 3) {
        setPlacedBombs(prev => [...prev, {r, c}]);
      }
      return;
    }

    if (gameState.phase === 'reveal' && isMyTurn) {
      if (!pendingAction) {
        client.sendIntent({ type: 'action_reveal', r, c });
      } else {
        // Handle selection for pending action
        const isSelected = selectedCells.some(cell => cell.r === r && cell.c === c);
        
        if (pendingAction.type === 'select_3x3') {
          if (r + 3 > gameState.boardRows || c + 3 > gameState.boardCols) return;
          client.sendIntent({ type: 'action_roulette_select', cells: [{r, c}] });
        } else if (pendingAction.type === 'reveal_2x2') {
          if (r + 2 > gameState.boardRows || c + 2 > gameState.boardCols) return;
          client.sendIntent({ type: 'action_roulette_select', cells: [{r, c}] });
        } else if (pendingAction.type === 'select_1_private' || pendingAction.type === 'reveal_row' || pendingAction.type === 'reveal_col') {
          client.sendIntent({ type: 'action_roulette_select', cells: [{r, c}] });
        } else if (pendingAction.type === 'reveal_n') {
          if (gameState.board[r][c].revealed) return;
          if (isSelected) {
            setSelectedCells(prev => prev.filter(cell => cell.r !== r || cell.c !== c));
          } else {
            const newSelected = [...selectedCells, {r, c}];
            setSelectedCells(newSelected);
            
            let unrevealedCount = 0;
            for (let i = 0; i < gameState.boardRows; i++) {
              for (let j = 0; j < gameState.boardCols; j++) {
                if (!gameState.board[i][j].revealed) unrevealedCount++;
              }
            }
            const requiredCount = Math.min(pendingAction.count || 1, unrevealedCount);
            
            if (newSelected.length === requiredCount) {
              client.sendIntent({ type: 'action_roulette_select', cells: newSelected });
              setSelectedCells([]);
            }
          }
        }
      }
    }
  };

  const confirmPlacement = () => {
    if (placedBombs.length === 3) {
      client.sendIntent({ type: 'place_bombs', bombs: placedBombs });
    }
  };

  const getCellContent = (cell: CellData) => {
    const hintBadge = (cell.isHinted && cell.hint !== undefined) ? (
      <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-md z-10">
        {cell.hint}
      </div>
    ) : null;

    const privateHintBadge = privateHints.find(h => h.r === cell.r && h.c === cell.c) ? (
      <div className="absolute -top-2 -left-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-md z-10">
        {privateHints.find(h => h.r === cell.r && h.c === cell.c)?.count}
      </div>
    ) : null;

    if (cell.revealed) {
      if (cell.bombs.length > 0) {
        return (
          <div className="relative w-full h-full flex items-center justify-center">
            {hintBadge}
            {privateHintBadge}
            {cell.bombs.map((playerId, i) => {
              const p = gameState.players.find(p => p.id === playerId);
              return (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: (i - (cell.bombs.length-1)/2) * 15 }}
                  className="absolute w-6 h-6 rounded-full shadow-lg border-2 border-zinc-900 flex items-center justify-center"
                  style={{ backgroundColor: p?.color || '#ef4444', zIndex: i }}
                >
                  <span className="text-[10px] font-bold text-zinc-900">💣</span>
                </motion.div>
              );
            })}
          </div>
        );
      }
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {hintBadge}
          {privateHintBadge}
          <span className="text-zinc-700 text-xs">✓</span>
        </div>
      );
    }

    // Show own bombs during placement or game
    const hasOwnBomb = cell.bombs.includes(localPlayerId) || placedBombs.some(b => b.r === cell.r && b.c === cell.c);
    if (hasOwnBomb) {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          {hintBadge}
          {privateHintBadge}
          <div className="w-4 h-4 rounded-full opacity-50" style={{ backgroundColor: localPlayer?.color || '#ef4444' }} />
        </div>
      );
    }

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {hintBadge}
        {privateHintBadge}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <div 
        className="grid gap-2 p-4 bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl"
        style={{ 
          gridTemplateColumns: `repeat(${gameState.boardCols}, minmax(0, 1fr))`,
          width: `${gameState.boardCols * 4 + 2}rem`
        }}
      >
        {gameState.board.map((row, r) => 
          row.map((cell, c) => {
            const isSelected = selectedCells.some(s => s.r === r && s.c === c);
            const isShaking = shakeCells.some(s => s.r === r && s.c === c);
            
            // Highlight logic for pending actions
            let isHighlighted = false;
            if (isMyTurn && pendingAction && hoveredCell) {
              const { r: hr, c: hc } = hoveredCell;
              if (pendingAction.type === 'select_3x3') {
                if (hr + 3 <= gameState.boardRows && hc + 3 <= gameState.boardCols) {
                  if (r >= hr && r < hr + 3 && c >= hc && c < hc + 3) isHighlighted = true;
                }
              } else if (pendingAction.type === 'reveal_2x2') {
                if (hr + 2 <= gameState.boardRows && hc + 2 <= gameState.boardCols) {
                  if (r >= hr && r < hr + 2 && c >= hc && c < hc + 2) isHighlighted = true;
                }
              } else if (pendingAction.type === 'reveal_row') {
                if (r === hr) isHighlighted = true;
              } else if (pendingAction.type === 'reveal_col') {
                if (c === hc) isHighlighted = true;
              } else if (pendingAction.type === 'select_1_private') {
                if (r === hr && c === hc) isHighlighted = true;
              }
            }

            return (
              <motion.button
                key={`${r}-${c}`}
                animate={isShaking ? { x: [-4, 4, -4, 4, 0] } : {}}
                transition={{ duration: 0.3 }}
                onClick={() => handleCellClick(r, c)}
                onMouseEnter={() => setHoveredCell({r, c})}
                onMouseLeave={() => setHoveredCell(null)}
                className={twMerge(
                  clsx(
                    "w-14 h-14 rounded-lg flex items-center justify-center text-xl font-bold transition-all duration-200",
                    cell.revealed ? "bg-zinc-800 shadow-inner" : "bg-zinc-700 hover:bg-zinc-600 shadow-md border-b-4 border-zinc-800 active:border-b-0 active:translate-y-1",
                    isSelected && "ring-2 ring-red-500 bg-zinc-600",
                    isHighlighted && "ring-2 ring-blue-500"
                  )
                )}
                disabled={gameState.phase === 'gameover' || (cell.revealed && gameState.phase === 'reveal' && !['select_3x3', 'reveal_row', 'reveal_col', 'reveal_2x2'].includes(pendingAction?.type || ''))}
              >
                {getCellContent(cell)}
              </motion.button>
            );
          })
        )}
      </div>

      {gameState.phase === 'placement' && !gameState.placedBombsCount[localPlayerId] && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-zinc-400">已放置: {placedBombs.length} / 3</div>
          <button
            onClick={confirmPlacement}
            disabled={placedBombs.length !== 3}
            className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认放置
          </button>
        </div>
      )}
      
      {gameState.phase === 'placement' && gameState.placedBombsCount[localPlayerId] === 3 && (
        <div className="text-zinc-400 animate-pulse">等待其他玩家放置...</div>
      )}
    </div>
  );
}
