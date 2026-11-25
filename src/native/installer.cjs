// Electron normally treats *.asar as virtual directories. Archive replacement
// must use original-fs; community source files inside our own ASAR use normal fs.
const sourceFs=require('node:fs/promises');
const fs=process.versions.electron?require('original-fs').promises:sourceFs;
const path=require('node:path');
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {validateExecutable}=require('../core/discovery.cjs');
const run=promisify(execFile);
const SUPPORTED_VERSIONS=[
 {version:'2.35.1',asarHash:'9f0aad7274795d7fbde04931d96b348dcfc5f3d81d7373e6b70aeb09307442df',overlayHash:'a4b2cc2ae9e73c81fcec511dee72d60f0d8cb1ba1f02a6170896bb595267bb1f'},
 {version:'2.34.0',asarHash:'8934adef0622c9271c92eea950a71848764a66f7b10023ccbd82e54b959adb0e',overlayHash:'a4b2cc2ae9e73c81fcec511dee72d60f0d8cb1ba1f02a6170896bb595267bb1f'}
];
const SUPPORTED=SUPPORTED_VERSIONS[0];
const findSupportedByAsarHash=h=>SUPPORTED_VERSIONS.find(v=>v.asarHash===h);
const MOD_VERSION='0.4.2';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function inside(root,target){const rel=path.relative(path.resolve(root),path.resolve(target));if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw new Error('Đường dẫn mod không nằm trong thư mục dự kiến.');return target;}
function readAsar(buffer){const jsonLength=buffer.readUInt32LE(12),header=JSON.parse(buffer.subarray(16,16+jsonLength).toString('utf8'));return {header,jsonLength,dataOffset:8+buffer.readUInt32LE(4)};}
function getEntry(header,rel){let entry=header;for(const part of rel.split('/'))entry=entry.files[part];return entry;}
function patchAsar(original){
 const spec=findSupportedByAsarHash(hash(original));
 if(!spec)throw new Error('Bản App chưa được hỗ trợ hoặc app.asar đã thay đổi. Chưa ghi file nào.');
 const {header,jsonLength,dataOffset}=readAsar(original),entry=getEntry(header,'dist/loadingOverlay.js');
 const start=dataOffset+Number(entry.offset),old=original.subarray(start,start+entry.size);
 if(hash(old)!==spec.overlayHash)throw new Error('Không nhận diện được module splash gốc.');
 const shim=`"use strict";\nconst utils=require("./utils");\nmodule.exports=require(require("node:path").join(process.resourcesPath,"agc-custom","releases","${MOD_VERSION}","overlay.cjs")).create({getHubWebContents:win=>utils.getHubWebContents(win),getHubView:win=>utils.getHubView?.(win)});\n`;
 if(Buffer.byteLength(shim)>entry.size)throw new Error('Patch vượt quá vùng module gốc.');
 const replacement=Buffer.alloc(entry.size,32);replacement.write(shim);entry.integrity.hash=hash(replacement);entry.integrity.blocks=[hash(replacement)];
 const newHeader=Buffer.from(JSON.stringify(header));if(newHeader.length!==jsonLength)throw new Error('Cấu trúc ASAR không phù hợp để patch giữ nguyên offset.');
 const patched=Buffer.from(original);newHeader.copy(patched,16);replacement.copy(patched,start);return patched;
}
async function inspect(executable){
 const file=await validateExecutable(executable),resources=path.join(path.dirname(file),'resources'),asarPath=path.join(resources,'app.asar'),mod=path.join(resources,'agc-custom');
 let manifest;try{manifest=JSON.parse(await fs.readFile(path.join(mod,'install.json'),'utf8'));}catch{}
 const bytes=await fs.readFile(asarPath),currentHash=hash(bytes);
 const matchedSpec=findSupportedByAsarHash(currentHash)||(manifest?.product==='antigravity-custom-native'?findSupportedByAsarHash(manifest.originalHash):null);
 const installed=Boolean(manifest?.product==='antigravity-custom-native'&&manifest.patchedHash===currentHash&&findSupportedByAsarHash(manifest.originalHash));
 return {executable:file,resources,asarPath,mod,manifest,currentHash,installed,supported:Boolean(findSupportedByAsarHash(currentHash))||installed,appVersion:matchedSpec?.version||SUPPORTED.version};
}
async function running(){if(process.platform!=='win32')return false;const {stdout}=await run('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-Command',"@(Get-Process -Name Antigravity -ErrorAction SilentlyContinue).Count"],{windowsHide:true,timeout:6000});return Number(stdout.trim())>0;}
async function copyOwnTree(source,destination){const stat=await sourceFs.stat(source);if(stat.isDirectory()){await fs.mkdir(destination,{recursive:true});for(const name of await sourceFs.readdir(source))await copyOwnTree(path.join(source,name),path.join(destination,name));}else{await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,await sourceFs.readFile(source));}}
async function install(executable,{dataDirectory,sourceRoot=path.resolve(__dirname,'..'),allowTestCopy=false,force=false}={}){
 const info=await inspect(executable);
 if(info.installed&&info.manifest.modVersion===MOD_VERSION&&!force){
  if(!allowTestCopy&&await running())throw new Error('Hãy đóng Antigravity App hoàn toàn trước khi cài tích hợp.');
  const mod=inside(info.resources,info.mod),runtime=inside(mod,path.join(mod,'releases',MOD_VERSION));await fs.mkdir(runtime,{recursive:true});
  for(const [source,dest] of [['native/overlay.cjs','overlay.cjs'],['native/preload.cjs','preload.cjs'],['native/splash.html','splash.html'],['native/splash.css','splash.css'],['native/splash.mjs','splash.mjs'],['native/settings-preload.cjs','settings-preload.cjs'],['native/settings.cjs','settings.cjs'],['native/music.cjs','music.cjs'],['native/music-preload.cjs','music-preload.cjs'],['native/music.html','music.html'],['native/music.js','music.js'],['native/white-gundam.png','white-gundam.png'],['native/white-gundam.mp4','white-gundam.mp4'],['renderer','renderer'],['core','core'],['integration/runtime.js','runtime.js'],['../assets/audio','audio']]){
    const destination=inside(runtime,path.join(runtime,dest));await copyOwnTree(path.join(sourceRoot,source),destination);
  }
  return info;
 }
 if(!info.supported)throw new Error('Chỉ hỗ trợ các bản Antigravity App (2.34.0 / 2.35.1) đã được kiểm chứng.');
 if(!allowTestCopy&&await running())throw new Error('Hãy đóng Antigravity App hoàn toàn trước khi cài tích hợp.');
 if(allowTestCopy){const project=path.resolve(__dirname,'../..');inside(path.join(project,'work'),info.executable);}
 const executableBytes=await fs.readFile(info.executable),sentinel=executableBytes.indexOf('dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX');
 if(sentinel<0||executableBytes[sentinel+32]!==1||executableBytes[sentinel+32+2+4]!==48)throw new Error('Không hỗ trợ bản App bật kiểm tra ASAR nhúng. Không sửa fuse hoặc file .exe.');
 if(info.installed)inside(path.join(info.resources,'agc-custom-backup'),info.manifest.backup);
 const original=await fs.readFile(info.installed?info.manifest.backup:info.asarPath),originalHash=hash(original),spec=findSupportedByAsarHash(originalHash);
 if(!spec)throw new Error('Không nhận diện được checksum của app.asar gốc.');
 const patched=patchAsar(original),backupRoot=inside(info.resources,path.join(info.resources,'agc-custom-backup'));
 await fs.mkdir(backupRoot,{recursive:true});const backup=inside(backupRoot,path.join(backupRoot,`app.asar.${spec.asarHash}.original`));
 try{await fs.writeFile(backup,original,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(hash(await fs.readFile(backup))!==spec.asarHash)throw new Error('Bản sao lưu không đúng checksum.');}
 const mod=inside(info.resources,info.mod),runtime=inside(mod,path.join(mod,'releases',MOD_VERSION));await fs.mkdir(runtime,{recursive:true});
 // Only community-owned code/assets are installed here. No Google code is redistributed.
 for(const [source,dest] of [['native/overlay.cjs','overlay.cjs'],['native/preload.cjs','preload.cjs'],['native/splash.html','splash.html'],['native/splash.css','splash.css'],['native/splash.mjs','splash.mjs'],['native/settings-preload.cjs','settings-preload.cjs'],['native/settings.cjs','settings.cjs'],['native/music.cjs','music.cjs'],['native/music-preload.cjs','music-preload.cjs'],['native/music.html','music.html'],['native/music.js','music.js'],['native/white-gundam.png','white-gundam.png'],['native/white-gundam.mp4','white-gundam.mp4'],['renderer','renderer'],['core','core'],['integration/runtime.js','runtime.js'],['../assets/audio','audio']]){
   const destination=inside(runtime,path.join(runtime,dest));await copyOwnTree(path.join(sourceRoot,source),destination);
 }
 const manifest={product:'antigravity-custom-native',modVersion:MOD_VERSION,runtimeRelative:`releases/${MOD_VERSION}`,appVersion:spec.version,originalHash:spec.asarHash,patchedHash:hash(patched),backup,dataDirectory:path.resolve(dataDirectory||info.manifest?.dataDirectory||path.join(process.env.APPDATA,'antigravity-custom')),installedAt:new Date().toISOString()};
 await fs.writeFile(path.join(runtime,'install.json'),JSON.stringify(manifest,null,2));
 await fs.writeFile(path.join(mod,'install.json'),JSON.stringify(manifest,null,2));
 const staged=inside(info.resources,`${info.asarPath}.agc-new`);await fs.writeFile(staged,patched);await fs.rename(staged,info.asarPath);
 return inspect(executable);
}
async function uninstall(executable,{allowTestCopy=false}={}){
 const info=await inspect(executable);if(!info.installed)throw new Error('Không thấy bản mod khớp checksum. Nếu App vừa cập nhật, không khôi phục bản cũ lên bản mới.');
 if(!allowTestCopy&&await running())throw new Error('Hãy đóng Antigravity App hoàn toàn trước khi gỡ.');
 if(allowTestCopy)inside(path.join(path.resolve(__dirname,'../..'),'work'),info.executable);
 const backupRoot=path.join(info.resources,'agc-custom-backup');inside(backupRoot,info.manifest.backup);
 const original=await fs.readFile(info.manifest.backup);if(hash(original)!==info.manifest.originalHash)throw new Error('Bản sao lưu không đúng checksum.');
 const staged=inside(info.resources,`${info.asarPath}.agc-restore`);await fs.writeFile(staged,original);await fs.rename(staged,info.asarPath);
 const mod=inside(info.resources,info.mod);await fs.rm(mod,{recursive:true,force:true});return inspect(executable);
}
module.exports={SUPPORTED,MOD_VERSION,hash,readAsar,getEntry,patchAsar,inspect,install,uninstall};
