const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeConfig,exportPreset,importPreset}=require('../src/core/config.cjs');
test('Plavsky settings validate personal audio IDs and preserve them across preset import',()=>{
 const startup='abcdef12-abcd-abcd-abcd-abcdef123456.mp3';
 const c=normalizeConfig({rg:{cinematicMode:'full',startupAudioId:startup,endAudioId:'../../security.json',shutdownEnabled:true}});
 assert.equal(c.rg.cinematicMode,'full');assert.equal(c.rg.startupAudioId,startup);assert.equal(c.rg.endAudioId,'');assert.equal(c.rg.shutdownEnabled,true);
 const bundle=exportPreset(c);assert.equal(JSON.stringify(bundle).includes(startup),false);
 const imported=importPreset(c,{...bundle,rg:{...bundle.rg,startupAudioId:'../../secret',shutdownEnabled:true}},'custom-plavsky');
 assert.equal(imported.rg.startupAudioId,startup);
 assert.equal(normalizeConfig({rg:{cinematicMode:'broken',shutdownEnabled:'true'}}).rg.cinematicMode,'quick');
 assert.equal(normalizeConfig({}).rg.shutdownEnabled,false);
});
