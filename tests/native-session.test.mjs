import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../googledrive.js',import.meta.url),'utf8');
const fresh=()=>({version:2,profile:{name:'',unit:'kg'},goals:{calories:2000},foods:[],workouts:[],weights:[],templates:[]});
const key=id=>'myfitness-account-'+id+'-v2';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
const tick=async()=>{for(let i=0;i<15;i++)await new Promise(r=>setImmediate(r));};
function harness({native=false,storage=new Map(),authorize=async()=>({accessToken:'memory-only',identity:'A',expiresIn:3000}),fetcher=async()=>{throw Error('Unexpected network')},online=true}={}){
 const elements=new Map(),events={},oauth=[],calls=[];
 const get=id=>{if(!elements.has(id))elements.set(id,{textContent:''});return elements.get(id)};
 const ctx={console,Response,URL,URLSearchParams,AbortController,Date,JSON,Error,Map,Set,Blob,Event,
  setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  navigator:{onLine:online},document:{hidden:false,getElementById:get,addEventListener(){},createElement:()=>({click(){}})},
  fetch:fetcher,location:{href:'https://celconac.github.io/MyFitness/'},KEY:storage.get('myfitness-last-active-account-v2')||'myfitness-guest-v2',
  LAST_ACCOUNT_KEY:'myfitness-last-active-account-v2',savedAccountKey:storage.get('myfitness-last-active-account-v2'),
  fresh,valid:d=>d?.version===2,render(){},resetAccountEditors(){},confirm:()=>true,
  google:{accounts:{oauth2:{initTokenClient:o=>{oauth.push(o);return {requestAccessToken(){}}}}}},
  MyFitnessAndroid:{available:native,request:async(type,options)=>{calls.push({type,options});return type==='signout'?{}:authorize(options)}}
 };
 ctx.state=JSON.parse(storage.get(ctx.KEY)||JSON.stringify(fresh()));ctx.window=ctx;ctx.addEventListener=(n,f)=>events[n]=f;
 vm.createContext(ctx);
 vm.runInContext(source.replace(/\}\)\(\);\s*$/,`globalThis.api={restore,renew,sync,request,connect,merge,get:()=>({token,accountId,restoring}),set:v=>{if(v.token!==undefined){token=v.token;expiresAt=Date.now()+3600000;}if(v.accountId!==undefined)accountId=v.accountId;if(v.nativeIdentity!==undefined)nativeIdentity=v.nativeIdentity;if(v.expiresAt!==undefined)expiresAt=v.expiresAt;if(v.fileId!==undefined)fileId=v.fileId;if(v.baseline!==undefined)baseline=v.baseline;if(v.syncKey!==undefined)SYNC_KEY=v.syncKey;}};})();`),ctx);
 return {ctx,api:ctx.api,get,events,calls,oauth,storage};
}
function drive(id,data=fresh()){
 return async url=>{
  if(url.includes('/about?'))return json({user:{permissionId:id,emailAddress:id+'@example.com'}});
  if(url.includes('/files?'))return json({files:[{id:'file'+id,version:'1'}]});
  if(url.includes('alt=media'))return json(data);
  throw Error('Unexpected write');
 };
}
test('refresh/reopen restores native Google access and keeps secrets out of storage',async()=>{
 const data=fresh();data.foods=[{id:'saved'}];
 const storage=new Map([['myfitness-last-active-account-v2',key('A')],[key('A'),JSON.stringify(data)],['myfitness-sync-account-A-v2',JSON.stringify({fileId:'fileA',baseline:data,baseVersion:'1'})]]);
 for(let reopen=0;reopen<2;reopen++){
  const h=harness({native:true,storage,fetcher:drive('A',data)});await tick();
  assert.equal(h.api.get().accountId,'A');assert.equal(h.ctx.state.foods[0].id,'saved');
  assert.equal(h.calls[0].options.interactive,false);
  assert.doesNotMatch([...storage.values()].join(''),/memory-only|accessToken|refreshToken/);
 }
});
test('explicit signout survives refresh and blocks automatic authorization',async()=>{
 const storage=new Map();const h=harness({native:true,storage,online:false});
 h.ctx.KEY=key('A');h.ctx.state.foods.push({id:'mine'});await h.get('gSignOut').onclick();
 const reopened=harness({native:true,storage});await tick();
 assert.equal(reopened.calls.filter(c=>c.type==='authorize').length,0);assert.equal(reopened.ctx.KEY,'myfitness-guest-v2');
 assert.equal(JSON.parse(storage.get(key('A'))).foods[0].id,'mine');
});
test('acknowledged logout marker cannot erase a new Android authorization on reopen',async()=>{
 const storage=new Map([['myfitness-native-logout-v1','1']]);
 let issueToken;
 const h=harness({native:false,storage,authorize:()=>new Promise(resolve=>issueToken=resolve)});
 h.ctx.MyFitnessAndroid.available=true;
 const connecting=h.api.connect();await tick();
 assert.equal(storage.has('myfitness-native-logout-v1'),false);
 assert.equal(h.calls[0].type,'signout');assert.equal(h.calls[1].options.interactive,true);
 // The old document can disappear while Google's external activity is open.
 // A replacement page must restore the newly saved native grant, not sign it out.
 const reopened=harness({native:true,storage,fetcher:drive('A')});await tick();
 assert.equal(reopened.calls[0].type,'authorize');assert.equal(reopened.api.get().accountId,'A');
 // Finish the abandoned page without performing network/account changes.
 await h.get('gSignOut').onclick();issueToken({accessToken:'late',identity:'A'});await connecting;
});
test('late Android authorization after signout cannot reconnect',async()=>{
 let finish;const h=harness({native:true,authorize:()=>new Promise(r=>finish=r)});await tick();
 await h.get('gSignOut').onclick();finish({accessToken:'late-secret',identity:'A'});await tick();
 assert.equal(h.api.get().token,'');assert.equal(h.ctx.KEY,'myfitness-guest-v2');
});
test('native account B never uploads or inherits account A records',async()=>{
 const a=fresh(),b=fresh();a.foods=[{id:'a-private'}];b.foods=[{id:'b-private'}];
 const storage=new Map([['myfitness-last-active-account-v2',key('A')],[key('A'),JSON.stringify(a)],[key('B'),JSON.stringify(b)],['myfitness-sync-account-B-v2',JSON.stringify({fileId:'fileB',baseline:b,baseVersion:'1'})]]);
 const h=harness({native:true,storage,authorize:async()=>({accessToken:'b-token',identity:'B'}),fetcher:drive('B',b)});await tick();
 assert.equal(h.ctx.KEY,key('B'));assert.equal(h.ctx.state.foods[0].id,'b-private');assert.equal(storage.get(key('A')),JSON.stringify(a));
});
test('Drive account identity mismatch blocks activation',async()=>{
 const h=harness({native:true,fetcher:drive('B')});await tick();
 assert.equal(h.api.get().token,'');assert.equal(h.api.get().accountId,null);
 assert.match(h.get('gStatus').textContent,/verification mismatch/);
});
test('expired native token renews without an account prompt',async()=>{
 const h=harness({native:false,fetcher:async()=>json({ok:true})});h.ctx.MyFitnessAndroid.available=true;
 h.api.set({token:'expired',accountId:'A',nativeIdentity:'A',expiresAt:0});
 await h.api.request('https://www.googleapis.com/drive/v3/files');
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].options.interactive,false);assert.equal(h.api.get().token,'memory-only');
});
test('401 clears the native token cache; writes are not blindly replayed',async()=>{
 let writes=0;const h=harness({fetcher:async()=>{writes++;return json({},401)}});
 h.ctx.MyFitnessAndroid.available=true;h.api.set({token:'revoked',nativeIdentity:'A',accountId:'A'});
 await assert.rejects(h.api.request('https://www.googleapis.com/upload/drive/v3/files/x',{method:'PATCH'}));
 assert.equal(writes,1);assert.equal(h.calls[0].options.invalidate,true);
});
test('late Drive response after signout cannot change guest records',async()=>{
 let finish;const h=harness({fetcher:async()=>{const r=json({});r.json=()=>new Promise(resolve=>finish=resolve);return r}});
 h.ctx.KEY=key('A');h.api.set({token:'access',accountId:'A'});const pending=h.api.sync();await tick();
 await h.get('gSignOut').onclick();finish({files:[]});await assert.rejects(pending,{name:'AbortError'});assert.equal(h.ctx.KEY,'myfitness-guest-v2');
});
test('offline edits remain available without Android authorization',async()=>{
 const data=fresh();data.foods=[{id:'offline'}];
 const h=harness({native:true,online:false,storage:new Map([['myfitness-last-active-account-v2',key('A')],[key('A'),JSON.stringify(data)]])});
 await tick();assert.equal(h.calls.length,0);assert.equal(h.ctx.state.foods[0].id,'offline');
});
