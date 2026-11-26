const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {HUB_READY_SCRIPT,probeHubReady,canRevealApp}=require('../src/core/readiness.cjs');

test('a mounted offline/error shell is ready without quota, inputs or seven buttons',()=>{
 const evaluate=(readyState,root)=>vm.runInNewContext(HUB_READY_SCRIPT,{document:{readyState,querySelector:selector=>{assert.equal(selector,'#root');return root;}}});
 assert.equal(evaluate('complete',{childElementCount:1}),true);
 assert.equal(evaluate('interactive',{childElementCount:1}),true);
 assert.equal(evaluate('loading',{childElementCount:1}),false);
 assert.equal(evaluate('complete',{childElementCount:0}),false);
 assert.equal(evaluate('complete',null),false);
});

test('a stalled Hub probe times out and subsequent probes can recover',async()=>{
 await assert.rejects(probeHubReady({executeJavaScript:()=>new Promise(()=>{})},10),/chưa phản hồi/);
 assert.equal(await probeHubReady({executeJavaScript:async()=>true},10),true);
 assert.equal(await probeHubReady({executeJavaScript:async()=>false},10),false);
});

test('continuing a pending App never bypasses per-screen authentication',()=>{
 for(const ready of [false,true])assert.throws(()=>canRevealApp({ready,authenticated:false,reusedSession:false},{allowPending:true,authenticated:true}),/Chưa xác thực/);
 assert.equal(canRevealApp({ready:false,authenticated:true},{}),false);
 assert.equal(canRevealApp({ready:false,authenticated:true},{allowPending:'true'}),false);
 assert.equal(canRevealApp({ready:false,authenticated:true},{allowPending:true}),true);
 assert.equal(canRevealApp({ready:false,reusedSession:true},{allowPending:true}),true);
 assert.equal(canRevealApp({ready:true,authenticated:true}),true);
});
