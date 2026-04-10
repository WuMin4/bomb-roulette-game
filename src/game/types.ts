export type Phase = 'lobby' | 'placement' | 'reveal' | 'gameover';

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  hp: number;
  color: string;
  isHost: boolean;
  connectionId?: string; // PeerJS connection ID
  rank?: number;
  score: number;
}

export interface CellData {
  r: number;
  c: number;
  revealed: boolean;
  bombs: string[]; // Array of player IDs who placed a bomb here
  hint?: number; // Used for 3x3 or 1x1 hint
  isHinted?: boolean; // If true, the hint is visible
}

export interface GameState {
  roomId: string;
  phase: Phase;
  players: Player[];
  board: CellData[][];
  turn: number; // Index in players array
  turnDirection: 1 | -1;
  pendingAction: PendingAction | null;
  logs: string[];
  winnerIds: string[];
  boardRows: number;
  boardCols: number;
  placedBombsCount: Record<string, number>; // playerId -> count
}

export type PendingActionType = 
  | 'select_3x3'
  | 'select_1_private'
  | 'reveal_n'
  | 'reveal_row'
  | 'reveal_col'
  | 'reveal_2x2';

export interface PendingAction {
  playerId: string;
  type: PendingActionType;
  count?: number; // For reveal_n
  selected?: {r: number, c: number}[]; // For reveal_n
}

export type ClientIntent = 
  | { type: 'join', name: string }
  | { type: 'add_ai' }
  | { type: 'start_game' }
  | { type: 'place_bombs', bombs: {r: number, c: number}[] }
  | { type: 'action_reveal', r: number, c: number }
  | { type: 'action_roulette' }
  | { type: 'action_roulette_select', cells: {r: number, c: number}[] }
  | { type: 'play_again' };

export type ServerMessage = 
  | { type: 'state', state: GameState }
  | { type: 'private_hint', r: number, c: number, count: number }
  | { type: 'error', message: string }
  | { type: 'shake', r: number, c: number }
  | { type: 'damage', playerId: string };
