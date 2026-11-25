const {test}=require('node:test');
const assert=require('node:assert/strict');
const {BUILTINS}=require('../src/core/presets.cjs');
const {normalizeConfig,exportPreset,importPreset}=require('../src/core/config.cjs');

test('existing profiles gain SAO worlds without losing selection or edited legacy themes',()=>{
  const old=normalizeConfig({selectedPreset:'gundam',presets:[{...BUILTINS.find(p=>p.id==='gundam'),name:'My edited theme'}]});
  assert.equal(old.selectedPreset,'gundam');
  assert.equal(old.presets.find(p=>p.id==='gundam').name,'My edited theme');
  assert.deepEqual(old.presets.filter(p=>p.family==='sao').map(p=>p.id),['sao-aincrad','sao-alfheim','sao-ggo','sao-calibur','sao-rosario']);
  assert.equal(new Set(old.presets.map(p=>p.id)).size,old.presets.length);
});

test('SAO worlds round-trip as independent themes without private names or media paths',()=>{
  for(const p of BUILTINS.filter(p=>p.family==='sao')){
    const config=normalizeConfig({selectedPreset:p.id,splash:{displayName:'PRIVATE_OPERATOR'},launcher:{executable:'C:\\PRIVATE_MACHINE\\App.exe'}});
    const bundle=exportPreset(config);
    assert.equal(bundle.preset.family,'sao');
    assert.equal(JSON.stringify(bundle).includes('PRIVATE_'),false);
    const imported=importPreset(config,bundle,'custom-sao');
    const selected=imported.presets.find(p=>p.id===imported.selectedPreset);
    assert.equal(selected.accent,p.accent);assert.equal(selected.family,'sao');
    assert.equal(imported.splash.displayName,'PRIVATE_OPERATOR');
  }
});
