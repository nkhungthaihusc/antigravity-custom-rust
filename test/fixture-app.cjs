const { app,BrowserWindow }=require('electron');
app.whenReady().then(async()=>{
  const window=new BrowserWindow({width:1100,height:760,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  await window.loadURL(process.env.AGC_FIXTURE_URL);window.showInactive();
});
app.on('window-all-closed',()=>app.quit());
