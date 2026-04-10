import { Peer, DataConnection } from 'peerjs';
import { GameState, Player, ClientIntent, ServerMessage, CellData, PendingAction } from './types';

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'];

export class GameHost {
  peer: Peer | null = null;
  connections: DataConnection[] = [];
  state: GameState;
  onStateChange: (state: GameState) => void;
  onPrivateMessage: (msg: ServerMessage) => void;

  constructor(onStateChange: (state: GameState) => void, onPrivateMessage: (msg: ServerMessage) => void) {
    this.onStateChange = onStateChange;
    this.onPrivateMessage = onPrivateMessage;
    this.state = this.getInitialState('');
  }

  getInitialState(roomId: string): GameState {
    return {
      roomId,
      phase: 'lobby',
      players: [],
      board: [],
      turn: 0,
      turnDirection: 1,
      pendingAction: null,
      logs: [],
      winnerIds: [],
      boardRows: 0,
      boardCols: 0,
      placedBombsCount: {}
    };
  }

  async init() {
    let id = '';
    while (true) {
      id = Math.floor(100000 + Math.random() * 900000).toString();
      const peerId = `roulette-minesweeper-${id}`;
      this.peer = new Peer(peerId);
      
      try {
        await new Promise<void>((resolve, reject) => {
          this.peer!.on('open', () => resolve());
          this.peer!.on('error', (err) => reject(err));
        });
        break; // Success
      } catch (e: any) {
        if (e.type === 'unavailable-id') {
          this.peer!.destroy();
          continue; // Try again
        }
        throw e;
      }
    }

    this.state.roomId = id;
    this.broadcastState();

    this.peer.on('connection', (conn) => {
      this.connections.push(conn);
      conn.on('data', (data: any) => {
        this.handleIntent(conn.peer, data as ClientIntent);
      });
      conn.on('close', () => {
        this.connections = this.connections.filter(c => c !== conn);
        // Handle disconnect if needed
      });
    });
  }

  broadcastState() {
    // Hide other players' bombs during placement phase
    const stateToSend = JSON.parse(JSON.stringify(this.state)) as GameState;
    
    this.onStateChange(this.state); // Local update (host sees everything? No, host is also a player, we should filter for local too, but let's handle filtering in the client or here)
    
    for (const conn of this.connections) {
      const player = this.state.players.find(p => p.connectionId === conn.peer);
      const customizedState = this.customizeStateForPlayer(stateToSend, player?.id);
      conn.send({ type: 'state', state: customizedState });
    }
  }

  customizeStateForPlayer(state: GameState, playerId?: string): GameState {
    const customized = JSON.parse(JSON.stringify(state)) as GameState;
    if (customized.phase === 'placement') {
      for (let r = 0; r < customized.boardRows; r++) {
        for (let c = 0; c < customized.boardCols; c++) {
          const cell = customized.board[r][c];
          if (playerId) {
            cell.bombs = cell.bombs.filter(id => id === playerId);
          } else {
            cell.bombs = [];
          }
        }
      }
    }
    return customized;
  }

  log(msg: string) {
    this.state.logs.push(msg);
    if (this.state.logs.length > 50) this.state.logs.shift();
  }

  handleIntent(connectionId: string, intent: ClientIntent) {
    const player = this.state.players.find(p => p.connectionId === connectionId);
    
    switch (intent.type) {
      case 'join':
        if (this.state.phase !== 'lobby') return;
        if (this.state.players.length >= 4) return;
        this.state.players.push({
          id: connectionId,
          name: intent.name,
          isAI: false,
          hp: 3,
          color: COLORS[this.state.players.length],
          isHost: this.state.players.length === 0,
          connectionId,
          score: 0
        });
        this.log(`${intent.name} 加入了房间`);
        this.broadcastState();
        break;
      case 'add_ai':
        if (this.state.phase !== 'lobby') return;
        if (this.state.players.length >= 4) return;
        if (!player?.isHost) return;
        const aiCount = this.state.players.filter(p => p.isAI).length;
        this.state.players.push({
          id: `ai-${Math.random()}`,
          name: `AI ${aiCount + 1}`,
          isAI: true,
          hp: 3,
          color: COLORS[this.state.players.length],
          isHost: false,
          score: 0
        });
        this.log(`添加了 AI ${aiCount + 1}`);
        this.broadcastState();
        break;
      case 'start_game':
        if (this.state.phase !== 'lobby') return;
        if (!player?.isHost) return;
        if (this.state.players.length < 2) return;
        this.startGame();
        break;
      case 'place_bombs':
        if (this.state.phase !== 'placement') return;
        if (!player) return;
        if (this.state.placedBombsCount[player.id]) return; // Already placed
        if (intent.bombs.length !== 3) return;
        
        for (const b of intent.bombs) {
          this.state.board[b.r][b.c].bombs.push(player.id);
        }
        this.state.placedBombsCount[player.id] = 3;
        this.log(`${player.name} 已放置炸弹`);
        
        this.checkAllBombsPlaced();
        this.broadcastState();
        break;
      case 'action_reveal':
        if (this.state.phase !== 'reveal') return;
        if (!player || this.state.players[this.state.turn].id !== player.id) return;
        if (this.state.pendingAction) return;
        this.handleReveal(player, intent.r, intent.c);
        break;
      case 'action_roulette':
        if (this.state.phase !== 'reveal') return;
        if (!player || this.state.players[this.state.turn].id !== player.id) return;
        if (this.state.pendingAction) return;
        this.handleRoulette(player);
        break;
      case 'action_roulette_select':
        if (this.state.phase !== 'reveal') return;
        if (!player || this.state.players[this.state.turn].id !== player.id) return;
        if (!this.state.pendingAction) return;
        this.handleRouletteSelect(player, intent.cells);
        break;
      case 'play_again':
        if (this.state.phase !== 'gameover') return;
        if (!player?.isHost) return;
        this.resetGame();
        break;
    }
  }

  startGame() {
    const pCount = this.state.players.length;
    if (pCount === 4) { this.state.boardRows = 5; this.state.boardCols = 7; }
    else if (pCount === 3) { this.state.boardRows = 5; this.state.boardCols = 6; }
    else { this.state.boardRows = 4; this.state.boardCols = 6; }

    this.state.board = Array.from({ length: this.state.boardRows }, (_, r) => 
      Array.from({ length: this.state.boardCols }, (_, c) => ({
        r, c, revealed: false, bombs: []
      }))
    );

    this.state.players.forEach(p => {
      p.hp = 3;
      p.rank = undefined;
    });
    this.state.placedBombsCount = {};
    this.state.phase = 'placement';
    this.state.logs = ['游戏开始，请放置炸弹（3枚）'];
    
    // Auto place for AIs
    this.state.players.filter(p => p.isAI).forEach(ai => {
      const bombs: {r: number, c: number}[] = [];
      while (bombs.length < 3) {
        const r = Math.floor(Math.random() * this.state.boardRows);
        const c = Math.floor(Math.random() * this.state.boardCols);
        if (!bombs.find(b => b.r === r && b.c === c)) {
          bombs.push({r, c});
        }
      }
      for (const b of bombs) {
        this.state.board[b.r][b.c].bombs.push(ai.id);
      }
      this.state.placedBombsCount[ai.id] = 3;
    });

    this.checkAllBombsPlaced();
    this.broadcastState();
  }

  checkAllBombsPlaced() {
    const allPlaced = this.state.players.every(p => this.state.placedBombsCount[p.id] === 3);
    if (allPlaced) {
      this.state.phase = 'reveal';
      this.state.turn = Math.floor(Math.random() * this.state.players.length);
      this.state.turnDirection = 1;
      this.log('所有玩家已放置炸弹，翻格阶段开始！');
      this.log(`当前回合: ${this.state.players[this.state.turn].name}`);
      this.processAITurn();
    }
  }

  nextTurn() {
    if (this.state.phase !== 'reveal') return;
    
    const alivePlayers = this.state.players.filter(p => p.hp > 0);
    if (alivePlayers.length <= 1) {
      this.endGame();
      return;
    }

    let next = this.state.turn;
    do {
      next = (next + this.state.turnDirection + this.state.players.length) % this.state.players.length;
    } while (this.state.players[next].hp <= 0);
    
    this.state.turn = next;
    this.state.pendingAction = null;
    this.log(`当前回合: ${this.state.players[this.state.turn].name}`);
    this.broadcastState();
    this.processAITurn();
  }

  endGame() {
    this.state.phase = 'gameover';
    const alive = this.state.players.filter(p => p.hp > 0);
    if (alive.length === 1) {
      alive[0].rank = 1;
      this.log(`游戏结束！${alive[0].name} 获胜！`);
    } else {
      this.log(`游戏结束！平局！`);
    }
    
    const scoreMap = [4, 2, 1, 0];
    this.state.players.forEach(p => {
      if (p.rank && p.rank >= 1 && p.rank <= 4) {
        p.score += scoreMap[p.rank - 1];
      }
    });

    this.broadcastState();
  }

  resetGame() {
    this.state.phase = 'lobby';
    this.state.players.forEach(p => {
      p.hp = 3;
      p.rank = undefined;
    });
    this.state.board = [];
    this.state.logs = ['房间已重置，等待开始'];
    this.broadcastState();
  }

  async handleReveal(player: Player, r: number, c: number) {
    const cell = this.state.board[r][c];
    if (cell.revealed) return;

    await this.revealCells(player, [{r, c}]);
    if (player.hp > 0) {
      this.nextTurn();
    }
  }

  async revealCells(player: Player, cells: {r: number, c: number}[]) {
    for (const pos of cells) {
      if (player.hp <= 0) break;
      const cell = this.state.board[pos.r][pos.c];
      if (cell.revealed) continue;

      // Shake animation
      this.broadcastMessage({ type: 'shake', r: pos.r, c: pos.c });
      await new Promise(res => setTimeout(res, 300));

      cell.revealed = true;
      const bombsCount = cell.bombs.length;
      
      if (bombsCount > 0) {
        player.hp -= bombsCount;
        this.log(`${player.name} 翻到了 ${bombsCount} 个炸弹！剩余血量: ${player.hp}`);
        this.broadcastMessage({ type: 'damage', playerId: player.id });
        await new Promise(res => setTimeout(res, 500));
        
        if (player.hp <= 0) {
          player.hp = 0;
          this.log(`${player.name} 被淘汰了！`);
          // Assign rank based on remaining players
          const aliveCount = this.state.players.filter(p => p.hp > 0).length;
          player.rank = aliveCount + 1;
        }
      } else {
        this.log(`${player.name} 翻开了安全格`);
      }
      this.broadcastState();
      await new Promise(res => setTimeout(res, 200));
    }
    
    if (player.hp <= 0) {
      this.nextTurn();
    }
  }

  broadcastMessage(msg: ServerMessage) {
    this.onPrivateMessage(msg); // Local
    for (const conn of this.connections) {
      conn.send(msg);
    }
  }

  sendPrivateMessage(playerId: string, msg: ServerMessage) {
    if (this.state.players.find(p => p.id === playerId)?.connectionId === 'local') {
      this.onPrivateMessage(msg);
      return;
    }
    const conn = this.connections.find(c => c.peer === this.state.players.find(p => p.id === playerId)?.connectionId);
    if (conn) conn.send(msg);
  }

  handleRoulette(player: Player) {
    const rand = Math.floor(Math.random() * 32);
    let action = '';
    
    if (rand < 6) {
      action = 'skip';
      this.log(`${player.name} 轮盘：跳过本回合`);
      this.nextTurn();
    } else if (rand < 10) {
      action = 'reverse';
      this.state.turnDirection *= -1;
      this.log(`${player.name} 轮盘：跳过本回合并反转顺序`);
      this.nextTurn();
    } else if (rand < 14) {
      this.state.pendingAction = { playerId: player.id, type: 'select_3x3' };
      this.log(`${player.name} 轮盘：选择3x3区域显示炸弹数`);
      this.broadcastState();
    } else if (rand < 16) {
      this.state.pendingAction = { playerId: player.id, type: 'select_1_private' };
      this.log(`${player.name} 轮盘：选择1个格子私密显示炸弹数`);
      this.broadcastState();
    } else if (rand < 20) {
      this.state.pendingAction = { playerId: player.id, type: 'reveal_n', count: 2, selected: [] };
      this.log(`${player.name} 轮盘：翻2个格子`);
      this.broadcastState();
    } else if (rand < 26) {
      this.state.pendingAction = { playerId: player.id, type: 'reveal_n', count: 3, selected: [] };
      this.log(`${player.name} 轮盘：翻3个格子`);
      this.broadcastState();
    } else if (rand < 27) {
      this.state.pendingAction = { playerId: player.id, type: 'reveal_n', count: 4, selected: [] };
      this.log(`${player.name} 轮盘：翻4个格子`);
      this.broadcastState();
    } else if (rand < 28) {
      this.state.pendingAction = { playerId: player.id, type: 'reveal_row' };
      this.log(`${player.name} 轮盘：翻一整行`);
      this.broadcastState();
    } else if (rand < 30) {
      this.state.pendingAction = { playerId: player.id, type: 'reveal_col' };
      this.log(`${player.name} 轮盘：翻一整列`);
      this.broadcastState();
    } else {
      this.state.pendingAction = { playerId: player.id, type: 'reveal_2x2' };
      this.log(`${player.name} 轮盘：翻2x2区域`);
      this.broadcastState();
    }
    
    if (player.isAI && this.state.pendingAction) {
      this.processAIPendingAction(player);
    }
  }

  async handleRouletteSelect(player: Player, cells: {r: number, c: number}[]) {
    const action = this.state.pendingAction;
    if (!action || action.playerId !== player.id) return;

    this.state.pendingAction = null; // Clear first to prevent double clicks

    if (action.type === 'select_3x3') {
      const {r, c} = cells[0];
      let count = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const nr = r + i, nc = c + j;
          if (nr < this.state.boardRows && nc < this.state.boardCols) {
            count += this.state.board[nr][nc].bombs.length;
          }
        }
      }
      this.log(`${player.name} 探测了区域，共有 ${count} 个炸弹`);
      this.state.board[r][c].hint = count;
      this.state.board[r][c].isHinted = true;
      this.broadcastState();
      this.nextTurn();
    } else if (action.type === 'select_1_private') {
      const {r, c} = cells[0];
      const count = this.state.board[r][c].bombs.length;
      this.sendPrivateMessage(player.id, { type: 'private_hint', r, c, count });
      this.log(`${player.name} 私密探测了一个格子`);
      this.nextTurn();
    } else if (action.type === 'reveal_n') {
      await this.revealCells(player, cells);
      if (player.hp > 0) this.nextTurn();
    } else if (action.type === 'reveal_row') {
      const r = cells[0].r;
      const toReveal = [];
      for (let c = 0; c < this.state.boardCols; c++) {
        if (!this.state.board[r][c].revealed) toReveal.push({r, c});
      }
      await this.revealCells(player, toReveal);
      if (player.hp > 0) this.nextTurn();
    } else if (action.type === 'reveal_col') {
      const c = cells[0].c;
      const toReveal = [];
      for (let r = 0; r < this.state.boardRows; r++) {
        if (!this.state.board[r][c].revealed) toReveal.push({r, c});
      }
      await this.revealCells(player, toReveal);
      if (player.hp > 0) this.nextTurn();
    } else if (action.type === 'reveal_2x2') {
      const {r, c} = cells[0];
      const toReveal = [];
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          const nr = r + i, nc = c + j;
          if (nr < this.state.boardRows && nc < this.state.boardCols && !this.state.board[nr][nc].revealed) {
            toReveal.push({r: nr, c: nc});
          }
        }
      }
      await this.revealCells(player, toReveal);
      if (player.hp > 0) this.nextTurn();
    }
  }

  processAITurn() {
    const player = this.state.players[this.state.turn];
    if (!player || !player.isAI || player.hp <= 0) return;

    setTimeout(() => {
      if (this.state.phase !== 'reveal' || this.state.players[this.state.turn].id !== player.id) return;
      
      // AI logic: 20% roulette, 80% reveal random unrevealed cell
      if (Math.random() < 0.2) {
        this.handleRoulette(player);
      } else {
        const unrevealed = [];
        for (let r = 0; r < this.state.boardRows; r++) {
          for (let c = 0; c < this.state.boardCols; c++) {
            if (!this.state.board[r][c].revealed) unrevealed.push({r, c});
          }
        }
        if (unrevealed.length > 0) {
          const target = unrevealed[Math.floor(Math.random() * unrevealed.length)];
          this.handleReveal(player, target.r, target.c);
        } else {
          this.nextTurn();
        }
      }
    }, 1500);
  }

  processAIPendingAction(player: Player) {
    setTimeout(() => {
      const action = this.state.pendingAction;
      if (!action || action.playerId !== player.id) return;

      const unrevealed = [];
      for (let r = 0; r < this.state.boardRows; r++) {
        for (let c = 0; c < this.state.boardCols; c++) {
          if (!this.state.board[r][c].revealed) unrevealed.push({r, c});
        }
      }

      if (unrevealed.length === 0) {
        this.state.pendingAction = null;
        this.nextTurn();
        return;
      }

      if (action.type === 'select_3x3') {
        const validCells = [];
        for (let r = 0; r <= this.state.boardRows - 3; r++) {
          for (let c = 0; c <= this.state.boardCols - 3; c++) {
            validCells.push({r, c});
          }
        }
        const target = validCells[Math.floor(Math.random() * validCells.length)];
        this.handleRouletteSelect(player, [target]);
      } else if (action.type === 'reveal_2x2') {
        const validCells = [];
        for (let r = 0; r <= this.state.boardRows - 2; r++) {
          for (let c = 0; c <= this.state.boardCols - 2; c++) {
            let hasUnrevealed = false;
            for (let i = 0; i < 2; i++) {
              for (let j = 0; j < 2; j++) {
                if (!this.state.board[r+i][c+j].revealed) hasUnrevealed = true;
              }
            }
            if (hasUnrevealed) {
              validCells.push({r, c});
            }
          }
        }
        const target = validCells[Math.floor(Math.random() * validCells.length)];
        this.handleRouletteSelect(player, [target]);
      } else if (action.type === 'select_1_private') {
        const target = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        this.handleRouletteSelect(player, [target]);
      } else if (action.type === 'reveal_n') {
        const count = Math.min(action.count || 1, unrevealed.length);
        const selected = [];
        for (let i = 0; i < count; i++) {
          const idx = Math.floor(Math.random() * unrevealed.length);
          selected.push(unrevealed[idx]);
          unrevealed.splice(idx, 1);
        }
        this.handleRouletteSelect(player, selected);
      } else if (action.type === 'reveal_row') {
        const target = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        this.handleRouletteSelect(player, [target]);
      } else if (action.type === 'reveal_col') {
        const target = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        this.handleRouletteSelect(player, [target]);
      }
    }, 1500);
  }
}
