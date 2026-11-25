const {discoverExecutable}=require('../src/core/discovery.cjs');const installer=require('../src/native/installer.cjs');
(async()=>{
 const command=process.argv[2]||'status',executable=process.argv[3]||await discoverExecutable();if(!executable)throw new Error('Chưa tìm thấy Antigravity App.');
 let result;
 if(command==='install')result=await installer.install(executable);
 else if(command==='uninstall')result=await installer.uninstall(executable);
 else if(command==='status')result=await installer.inspect(executable);
 else throw new Error('Dùng: node scripts/native-install.cjs install|uninstall|status [Antigravity.exe]');
 console.log(JSON.stringify({installed:result.installed,supported:result.supported,appVersion:result.appVersion,executable:result.executable,backup:result.manifest?.backup},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
