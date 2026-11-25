const { EventEmitter } = require('node:events');
class CdpClient extends EventEmitter {
  constructor(socket) {
    super(); this.socket = socket; this.nextId = 1; this.pending = new Map();
    socket.addEventListener('message', event => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (message.id) {
        const pending = this.pending.get(message.id); if (!pending) return;
        clearTimeout(pending.timer); this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
      } else this.emit('event', message);
    });
    socket.addEventListener('close', () => { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('Kết nối App đã đóng.')); } this.pending.clear(); this.emit('closed'); });
    socket.addEventListener('error', () => {});
  }
  static async connect(url) {
    const u = new URL(url);
    if (u.protocol !== 'ws:' || u.hostname !== '127.0.0.1' || !u.port || !u.pathname.startsWith('/devtools/browser/')) throw new Error('Từ chối endpoint ngoài máy cục bộ.');
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => { const timer = setTimeout(() => { socket.close(); reject(new Error('Hết thời gian kết nối App.')); }, 7000); socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true }); socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('Không kết nối được App.')); }, { once: true }); });
    return new CdpClient(socket);
  }
  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 7000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  close() { this.socket.close(); }
}
module.exports = { CdpClient };
