import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../native-google.js',import.meta.url),'utf8');
function bridge(){
 const events={},sent=[];let ready=0;
 const ctx={Map,Promise,Error,JSON,crypto:{randomUUID:()=> 'request-id'},setTimeout:()=>1,clearTimeout(){},Event,
  addEventListener:(n,f)=>events[n]=f,dispatchEvent:()=>ready++};ctx.window=ctx;ctx.top=ctx;
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const port={postMessage:m=>sent.push(JSON.parse(m)),start(){},close(){}};
 const transfer=(origin='android-app://celconac.github.io',data='')=>events.message({origin,data,ports:[port]});
 const nativeReady=()=>port.onmessage?.({data:JSON.stringify({type:'myfitness-native-ready',version:1})});
 const hello=(origin='android-app://celconac.github.io')=>{transfer(origin);nativeReady()};
 return {ctx,port,transfer,nativeReady,hello,sent,ready:()=>ready};
}
test('native bridge rejects other origins and malformed handshakes',()=>{
 const h=bridge();h.hello('https://example.com');assert.equal(h.ctx.MyFitnessAndroid.available,false);
 h.transfer('https://celconac.github.io',JSON.stringify({type:'bad',version:1}));assert.equal(h.ready(),0);
 h.hello();assert.equal(h.ctx.MyFitnessAndroid.available,true);assert.equal(h.ready(),1);
});
test('Chrome empty transfer message is accepted; readiness arrives on the port',()=>{
 const h=bridge();h.transfer();assert.equal(h.ctx.MyFitnessAndroid.available,false);
 h.nativeReady();assert.equal(h.ctx.MyFitnessAndroid.available,true);assert.equal(h.ready(),1);
 h.nativeReady();assert.equal(h.ready(),1);
});
test('opaque and lookalike Android origins cannot supply a native channel',()=>{
 for(const origin of ['null','android-app://evil.example','android-app://celconac.github.io.evil.example']){
  const h=bridge();h.hello(origin);assert.equal(h.ctx.MyFitnessAndroid.available,false);
 }
});
test('native responses must match an outstanding request ID',async()=>{
 const h=bridge();h.hello();const pending=h.ctx.MyFitnessAndroid.request('authorize',{interactive:false});
 let resolved=false;pending.then(()=>resolved=true);
 h.port.onmessage({data:JSON.stringify({type:'myfitness-native-result',version:1,id:'wrong',accessToken:'wrong'})});
 await Promise.resolve();assert.equal(resolved,false);
 h.port.onmessage({data:JSON.stringify({type:'myfitness-native-result',version:1,id:h.sent[0].id,accessToken:'memory'})});
 assert.equal((await pending).accessToken,'memory');
});
test('new channel cancels old pending authorization',async()=>{
 const h=bridge();h.hello();const pending=h.ctx.MyFitnessAndroid.request('authorize');h.hello();
 await assert.rejects(pending,/connection changed/);
});
