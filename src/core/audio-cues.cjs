const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const CUE_FILES=Object.freeze({begin:'01_gp-base.mp3',verifying:'02_chuan-bi.mp3',authenticated:'03_plavsky.mp3',welcome:'04_quet.mp3',enter:'07_bat-dau-tran.mp3',shutdown:'08_ket-thuc.mp3'});
async function importCueFolder(folder,assetsDirectory,config){
 const root=await fs.realpath(folder),sources=[];
 for(const [event,name] of Object.entries(CUE_FILES)){
  const candidate=path.join(root,name),real=await fs.realpath(candidate);
  if(path.relative(root,real)!==name)throw new Error('File cue phải nằm trực tiếp trong thư mục đã chọn.');
  const stat=await fs.stat(real);if(!stat.isFile()||stat.size<1||stat.size>20*1024*1024)throw new Error(`Cue không hợp lệ: ${name}`);
  // Reject renamed text/HTML before copying into the media store.
  const handle=await fs.open(real,'r');let bytes;
  try{bytes=Buffer.alloc(3);await handle.read(bytes,0,3,0);}finally{await handle.close();}
  if(bytes.toString()!=='ID3'&&!(bytes[0]===255&&(bytes[1]&224)===224))throw new Error(`Không phải MP3: ${name}`);
  sources.push({event,real,id:`${randomUUID()}.mp3`});
 }
 await fs.mkdir(assetsDirectory,{recursive:true});const copied=[];
 try{
  for(const source of sources){const target=path.join(assetsDirectory,source.id);await fs.copyFile(source.real,target,fs.constants.COPYFILE_EXCL);copied.push(target);}
 }catch(error){await Promise.allSettled(copied.map(file=>fs.unlink(file)));throw error;}
 const next=structuredClone(config);next.rg={...next.rg,audioMode:'events',cueAudioIds:Object.fromEntries(sources.map(s=>[s.event,s.id]))};return next;
}
module.exports={CUE_FILES,importCueFolder};
