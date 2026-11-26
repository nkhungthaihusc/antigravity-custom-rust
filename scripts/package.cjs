// Build a portable release from an allowlist, never from the user's profile.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const NODE_VERSION='24.22.3';
const NODE_ZIP=`node-v${NODE_VERSION}-win-x64.zip`;
const NODE_SHA256='e612af99f626ab415ea225af6bce5c971feb448cb5cae250bb1c3fa50c5f7d9f';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function run(exe,args,options={}){const r=spawnSync(exe,args,{cwd:root,stdio:'inherit',windowsHide:true,...options});if(r.error)throw r.error;if(r.status!==0)throw new Error(`${exe} exited ${r.status}`);}
async function filesAt(directory,prefix=''){
 const files=[];
 for(const e of(await fs.readdir(directory,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
  const rel=prefix?`${prefix}/${e.name}`:e.name;
  if(e.isSymbolicLink())throw new Error(`Không đóng gói symlink: ${rel}`);
  if(e.isDirectory())files.push(...await filesAt(path.join(directory,e.name),rel));else if(e.isFile())files.push(rel);
 }
 return files;
}
async function packagePortable({skipBuild=false}={}){
 if(process.platform!=='win32'||process.arch!=='x64')throw new Error('Build gói này trên Windows x64.');
 if(!skipBuild)run('cargo',['build','--manifest-path','src-tauri/Cargo.toml','--release','--locked']);
 const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json')));
 const name=`Antigravity-Custom-${version}-win-x64`;
 const cache=path.join(root,'work/package-cache');await fs.mkdir(cache,{recursive:true});
 const archive=path.join(cache,NODE_ZIP);
 let archiveBytes=await fs.readFile(archive).catch(e=>{if(e.code!=='ENOENT')throw e;return null;});
 if(!archiveBytes){const response=await fetch(`https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ZIP}`);if(!response.ok)throw new Error(`Node download: HTTP ${response.status}`);archiveBytes=Buffer.from(await response.arrayBuffer());}
 if(hash(archiveBytes)!==NODE_SHA256)throw new Error('Node archive checksum mismatch; không tạo bản phát hành.');
 await fs.writeFile(archive,archiveBytes);
 const unpack=await fs.mkdtemp(path.join(cache,'node-'));
 run('powershell.exe',['-NoProfile','-NonInteractive','-Command','Expand-Archive -LiteralPath $env:AGC_ARCHIVE_SOURCE -DestinationPath $env:AGC_ARCHIVE_TARGET'],{env:{...process.env,AGC_ARCHIVE_SOURCE:archive,AGC_ARCHIVE_TARGET:unpack}});
 const staging=await fs.mkdtemp(path.join(root,'work/package-'));
 const bundle=path.join(staging,name),runtime=path.join(bundle,'runtime');await fs.mkdir(runtime,{recursive:true});
 const copy=async(source,dest)=>{await fs.mkdir(path.dirname(dest),{recursive:true});await fs.cp(source,dest,{recursive:true,errorOnExist:true,force:false});};
 await copy(path.join(root,'src-tauri/target/release/antigravity-custom-launcher.exe'),path.join(bundle,'Antigravity Custom.exe'));
 for(const directory of ['native','core','renderer'])await copy(path.join(root,'src',directory),path.join(runtime,'src',directory));
 await copy(path.join(root,'src/integration/runtime.js'),path.join(runtime,'src/integration/runtime.js'));
 await copy(path.join(root,'scripts/native-install.cjs'),path.join(runtime,'scripts/native-install.cjs'));
 await copy(path.join(root,'assets/audio'),path.join(runtime,'assets/audio'));
 const nodeSource=path.join(unpack,`node-v${NODE_VERSION}-win-x64`);
 await copy(path.join(nodeSource,'node.exe'),path.join(runtime,'node/node.exe'));
 await copy(path.join(nodeSource,'LICENSE'),path.join(runtime,'node/LICENSE'));
 await copy(path.join(root,'LICENSE'),path.join(bundle,'LICENSE'));
 await copy(path.join(root,'docs/PORTABLE.md'),path.join(bundle,'HUONG-DAN.md'));
 await fs.writeFile(path.join(runtime,'bundle.json'),JSON.stringify({product:'antigravity-custom-portable',version,platform:'win32',arch:'x64',node:{version:NODE_VERSION,archive:NODE_ZIP,sha256:NODE_SHA256,source:`https://nodejs.org/dist/v${NODE_VERSION}/`}},null,2)+'\n');
 const entries=await filesAt(bundle);
 for(const file of entries){
  if(/(^|\/)(security[^/]*\.json|config\.json[^/]*|install\.json|\.env|.*\.(pdb|original|log))$/i.test(file))throw new Error(`Unexpected private/build file: ${file}`);
  if(/\.(cjs|mjs|js|json|html|css|md)$/i.test(file)){
   const text=await fs.readFile(path.join(bundle,file),'utf8');
   if(/Thái Nguyễn|[A-Z]:[\\/]DevProject[\\/]|[A-Z]:[\\/]Users[\\/]/i.test(text))throw new Error(`Personal/build path in ${file}`);
  }
 }
 const sums=[];for(const file of entries)sums.push(`${hash(await fs.readFile(path.join(bundle,file)))}  ${file}`);
 await fs.writeFile(path.join(bundle,'SHA256SUMS.txt'),sums.join('\n')+'\n');
 const release=path.join(root,'release');await fs.mkdir(release,{recursive:true});
 const zip=path.join(release,`${name}.zip`);
 // Use a temporary archive so a failed compression cannot replace a good release.
 const tempZip=path.join(staging,`${name}.zip`);
 run('powershell.exe',['-NoProfile','-NonInteractive','-Command','Compress-Archive -LiteralPath $env:AGC_BUNDLE_SOURCE -DestinationPath $env:AGC_BUNDLE_ZIP -CompressionLevel Optimal'],{env:{...process.env,AGC_BUNDLE_SOURCE:bundle,AGC_BUNDLE_ZIP:tempZip}});
 await fs.copyFile(tempZip,zip);
 await fs.writeFile(`${zip}.sha256`,`${hash(await fs.readFile(zip))}  ${path.basename(zip)}\n`);
 await fs.copyFile(path.join(bundle,'Antigravity Custom.exe'),path.join(release,'Antigravity Custom.exe'));
 await fs.cp(runtime,path.join(release,'runtime'),{recursive:true,force:true});
 const result={zip:path.relative(root,zip),sha256:hash(await fs.readFile(zip)),bytes:(await fs.stat(zip)).size,files:entries.length+1,staging:path.relative(root,bundle),node:NODE_VERSION};
 await fs.writeFile(path.join(root,'work/portable-package.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));return result;
}
if(require.main===module)packagePortable({skipBuild:process.argv.includes('--skip-build')}).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={packagePortable,filesAt};
