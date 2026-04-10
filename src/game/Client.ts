import { Peer, DataConnection } from 'peerjs';
import { ClientIntent, GameState, ServerMessage } from './types';

export class GameClient {
  peer: Peer | null = null;
  conn: DataConnection | null = null;
  onStateChange: (state: GameState) => void;
  onPrivateMessage: (msg: ServerMessage) => void;
  onError: (msg: string) => void;

  constructor(
    onStateChange: (state: GameState) => void,
    onPrivateMessage: (msg: ServerMessage) => void,
    onError: (msg: string) => void
  ) {
    this.onStateChange = onStateChange;
    this.onPrivateMessage = onPrivateMessage;
    this.onError = onError;
  }

  async connect(roomId: string, name: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.peer = new Peer();
      
      this.peer.on('open', (id) => {
        const hostId = `roulette-minesweeper-${roomId}`;
        this.conn = this.peer!.connect(hostId);
        
        this.conn.on('open', () => {
          this.sendIntent({ type: 'join', name });
          resolve(id);
        });

        this.conn.on('data', (data: any) => {
          const msg = data as ServerMessage;
          if (msg.type === 'state') {
            this.onStateChange(msg.state);
          } else {
            this.onPrivateMessage(msg);
          }
        });

        this.conn.on('error', (err) => {
          this.onError('连接错误: ' + err.message);
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        this.onError('PeerJS 错误: ' + err.message);
        reject(err);
      });
    });
  }

  sendIntent(intent: ClientIntent) {
    if (this.conn && this.conn.open) {
      this.conn.send(intent);
    }
  }
}
