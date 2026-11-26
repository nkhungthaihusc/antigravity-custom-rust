// Runs only against an extracted package and an owned App copy under work/.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function execute(exe,args,env,cwd,expected=0){
 const r=spawnSync(exe,args,{env,cwd,encoding:'utf8',windowsHide:true,timeout:90000});
 if(r.error)throw r.error;
 assert.equal(r.status,expected,`${path.basename(exe)}: ${r.stderr}\n${r.stdout}`);return r.stdout.trim();
}
async function verify(){
 const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json')));
 const name=`Antigravity-Custom-${version}-win-x64`,zip=path.join(root,'release',`${name}.zip`);
 const scratch=await fs.mkdtemp(path.join(root,'work/portable-verify-'));
 const extracted=path.join(scratch,'Giải nén ở vị trí khác');await fs.mkdir(extracted);
 execute('powershell.exe',['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath $env:AGC_ARCHIVE_SOURCE -DestinationPath $env:AGC_ARCHIVE_TARGET'],{...process.env,AGC_ARCHIVE_SOURCE:zip,AGC_ARCHIVE_TARGET:extracted},root);
 const bundle=path.join(extracted,name),runtime=path.join(bundle,'runtime'),launcher=path.join(bundle,'Antigravity Custom.exe');
 const sums=(await fs.readFile(path.join(bundle,'SHA256SUMS.txt'),'utf8')).trim().split('\n');
 for(const line of sums){const [expected,file]=line.split('  ');assert(file&&!file.includes('..')&&!path.isAbsolute(file));assert.equal(hash(await fs.readFile(path.join(bundle,file))),expected,file);}
 const compatibility=path.join(runtime,'work/compatibility');
 const local=path.join(compatibility,'local'),roaming=path.join(compatibility,'roaming');
 const copiedExe=path.join(local,'Programs/Antigravity/Antigravity.exe'),resources=path.join(path.dirname(copiedExe),'resources');await fs.mkdir(resources,{recursive:true});
 const liveExe=path.join(process.env.LOCALAPPDATA,'Programs/Antigravity/Antigravity.exe');
 const liveResources=path.join(path.dirname(liveExe),'resources'),liveAsar=path.join(liveResources,'app.asar');
 const liveExeHash=hash(await fs.readFile(liveExe)),liveAsarHash=hash(await fs.readFile(liveAsar));
 let original=liveAsar;
 try{const manifest=JSON.parse(await fs.readFile(path.join(liveResources,'agc-custom/install.json')));original=manifest.backup;}catch(e){if(e.code!=='ENOENT')throw e;}
 const originalBytes=await fs.readFile(original);await fs.writeFile(path.join(resources,'app.asar'),originalBytes);await fs.copyFile(liveExe,copiedExe);
 const env={...process.env,PATH:path.join(process.env.SystemRoot,'System32'),APPDATA:roaming,LOCALAPPDATA:local,NODE_OPTIONS:'--deliberately-invalid-option',NODE_PATH:'unavailable'};
 assert(spawnSync('node',['--version'],{env,windowsHide:true}).error,'Node on PATH must be unavailable');
 const diagnostic=()=>JSON.parse(execute(launcher,['--check-package'],env,scratch));
 let result=diagnostic();assert.equal(result.packageReady,true);assert.equal(result.nativeStatus.supported,true);assert.equal(result.nativeStatus.installed,false);
 const only=path.join(scratch,'exe-only');await fs.mkdir(only);await fs.copyFile(launcher,path.join(only,'Antigravity Custom.exe'));
 assert.equal(JSON.parse(execute(path.join(only,'Antigravity Custom.exe'),['--check-package'],env,scratch,1)).packageReady,false);
 const node=path.join(runtime,'node/node.exe'),installer=path.join(runtime,'src/native/installer.cjs'),data=path.join(roaming,'antigravity-custom');
 const nodeEnv={...env};delete nodeEnv.NODE_OPTIONS;delete nodeEnv.NODE_PATH;
 const action=async op=>execute(node,['-e',`const i=require(process.argv[1]);i.${op}(process.argv[2],{allowTestCopy:true,dataDirectory:process.argv[3]}).then(r=>console.log(JSON.stringify({installed:r.installed,updateAvailable:r.updateAvailable}))).catch(e=>{console.error(e.message);process.exitCode=1})`,installer,copiedExe,data],nodeEnv,scratch);
 await action('install');result=diagnostic();assert.equal(result.nativeStatus.installed,true);assert.equal(result.nativeStatus.updateAvailable,false);
 await action('install');assert.equal(diagnostic().nativeStatus.updateAvailable,false);
 assert.equal(hash(await fs.readFile(copiedExe)),liveExeHash);
 await action('uninstall');assert.equal(diagnostic().nativeStatus.installed,false);assert.equal(hash(await fs.readFile(path.join(resources,'app.asar'))),hash(originalBytes));
 await fs.writeFile(path.join(resources,'app.asar'),'unsupported fixture');
 execute(node,['-e','require(process.argv[1]).install(process.argv[2],{allowTestCopy:true}).then(()=>process.exit(0)).catch(()=>process.exit(2))',installer,copiedExe],nodeEnv,scratch,2);
 assert.equal(await fs.readFile(path.join(resources,'app.asar'),'utf8'),'unsupported fixture');
 assert.equal(hash(await fs.readFile(liveExe)),liveExeHash);assert.equal(hash(await fs.readFile(liveAsar)),liveAsarHash);
 assert.equal(await fs.stat(path.join(data,'security.json')).then(()=>true,()=>false),false);
 const report={passed:true,checks:['all packaged hashes','Unicode/spaces relocation','no Node on PATH','hostile Node environment removed','release EXE refuses missing runtime without source fallback','bundled native install/update/uninstall on App copy','byte-for-byte ASAR restore','Google executable unchanged','unknown ASAR rejected','no credential creation','live App unchanged'],appVersion:result.nativeStatus.appVersion,zipSha256:hash(await fs.readFile(zip)),extracted:path.relative(root,bundle)};
 await fs.writeFile(path.join(root,'work/portable-verification.json'),JSON.stringify(report,null,2)+'\n');
 // Remove only the owned Google fixture, not the extracted release being inspected.
 if(path.dirname(compatibility)!==path.join(runtime,'work'))throw new Error('Unexpected fixture path');
 await fs.rm(compatibility,{recursive:true,force:true});
 console.log(JSON.stringify(report,null,2));
}
verify().catch(e=>{console.error(e.stack);process.exitCode=1;});
