// Run explicitly after updating the native helper and closing both applications.
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { discoverExecutable } = require('../src/core/discovery.cjs');
const installer = require('../src/native/installer.cjs');
const { resolveDataDirectory, syncPassword } = require('../src/core/profile.cjs');
(async () => {
  if (process.platform === 'win32') {
    const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', "@(Get-Process -Name Antigravity,antigravity-custom-launcher,'Antigravity Custom' -ErrorAction SilentlyContinue).Count"], { windowsHide: true, timeout: 6000 });
    if (Number(stdout.trim()) > 0) throw new Error('Hãy đóng Antigravity và launcher trước khi đồng bộ mật khẩu.');
  }
  const executable = await discoverExecutable();
  if (!executable) throw new Error('Chưa tìm thấy Antigravity App.');
  const info = await installer.inspect(executable);
  if (!info.installed) throw new Error('Bản tích hợp native chưa được kiểm chứng checksum.');
  const runtime = path.resolve(info.mod, info.manifest.runtimeRelative);
  const relative = path.relative(info.mod, runtime);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Đường dẫn runtime không hợp lệ.');
  if (require(path.join(runtime, 'core/security.cjs')).PASSWORD_FORMAT_VERSION !== 2) throw new Error('Hãy cập nhật tích hợp native trước khi đồng bộ mật khẩu Rust cũ.');
  const source = process.argv[2] || path.join(process.env.LOCALAPPDATA, 'antigravity', 'custom', 'data');
  const target = await resolveDataDirectory();
  const result = await syncPassword(source, target);
  console.log(JSON.stringify({ changed: result.changed, backupCreated: !!result.backup }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
