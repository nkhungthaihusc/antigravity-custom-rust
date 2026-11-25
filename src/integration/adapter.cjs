const fs = require('node:fs/promises');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { CdpClient } = require('./cdp.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function supportedTarget(target) {
  try { const u = new URL(target.url); return target.type === 'page' && /antigravity/i.test(target.title) && ['https:', 'http:'].includes(u.protocol) && ['127.0.0.1', 'localhost'].includes(u.hostname); } catch { return false; }
}
class RuntimeAdapter extends EventEmitter {
  constructor(onCommand) { super(); this.onCommand = onCommand; this.state = 'disconnected'; }
  setState(state, message) { this.state = state; this.message = message; this.emit('status', { state, message }); }
  async connect(endpoint, data) {
    await this.disconnect();
    this.setState('connecting', 'Đang tìm cửa sổ Antigravity App…');
    this.client = await CdpClient.connect(endpoint);
    this.client.on('closed', () => this.setState('disconnected', 'App đã đóng kết nối.'));
    for (let i = 0; i < 40; i++) {
      const { targetInfos } = await this.client.send('Target.getTargets');
      const target = targetInfos.find(supportedTarget);
      if (target) {
        this.origin = new URL(target.url).origin;
        this.sessionId = (await this.client.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
        await this.client.send('Runtime.enable', {}, this.sessionId);
        await this.client.send('Page.enable', {}, this.sessionId);
        await this.client.send('Runtime.addBinding', { name: '__agcCommand' }, this.sessionId);
        this.client.on('event', event => {
          if (event.sessionId !== this.sessionId || event.method !== 'Runtime.bindingCalled' || event.params.name !== '__agcCommand') return;
          try { const command = JSON.parse(event.params.payload); if (['select', 'settings', 'remove'].includes(command.type)) Promise.resolve(this.onCommand(command)).catch(() => {}); } catch {}
        });
        await this.apply(data);
        this.setState('connected', 'Đã gắn bảng Custom cho phiên hiện tại.');
        return;
      }
      await delay(750);
    }
    throw new Error('Chưa nhận diện được giao diện App. Phiên bản này có thể chưa tương thích.');
  }
  async expression(data) {
    const source = await fs.readFile(path.join(__dirname, 'runtime.js'), 'utf8');
    return `(${source})(${JSON.stringify({ ...data, origin: this.origin })})`;
  }
  async apply(data) {
    if (!this.client || !this.sessionId) return;
    const expression = await this.expression(data);
    if (this.scriptId) await this.client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: this.scriptId }, this.sessionId).catch(() => {});
    this.scriptId = (await this.client.send('Page.addScriptToEvaluateOnNewDocument', { source: `addEventListener('DOMContentLoaded',()=>{${expression}}, {once:true});` }, this.sessionId)).identifier;
    const result = await this.client.send('Runtime.evaluate', { expression, returnByValue: true }, this.sessionId);
    if (result.exceptionDetails || result.result?.value?.installed !== true) throw new Error('Không gắn được bảng Custom vào trang App.');
  }
  async disconnect() {
    if (this.client && this.sessionId) {
      if (this.scriptId) await this.client.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: this.scriptId }, this.sessionId).catch(() => {});
      await this.client.send('Runtime.evaluate', { expression: 'window.__agcCleanup?.()', returnByValue: true }, this.sessionId).catch(() => {});
      await this.client.send('Target.detachFromTarget', { sessionId: this.sessionId }).catch(() => {});
    }
    this.client?.close(); this.client = null; this.sessionId = null; this.scriptId = null;
    this.setState('disconnected', 'Chưa kết nối.');
  }
}
module.exports = { RuntimeAdapter, supportedTarget };
