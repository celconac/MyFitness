/* myFitness Google Drive auto-sync. No credentials stored, only OAuth client ID.
   Three-way merge + optimistic Drive version check. Conflicts pause sync. */
'use strict';
(()=>{
const $=id=>document.getElementById(id), CLIENT_KEY='myfitness-google-client-id', SYNC_KEY='myfitness-sync-v1', FILE='myFitness-data.json';
const SCOPE='https://www.googleapis.com/auth/drive.file', deep=x=>JSON.parse(JSON.stringify(x));
let token='', client=null, fileId=null, baseline=null, baseVersion=null, busy=false, stopped=false, timer=null, queued=false, reconnectNeeded=false;
const say=(s)=>{$('gStatus').textContent=s;};
const detail=(s)=>{$('syncDetail').textContent=s;};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function cached(){try{return JSON.parse(localStorage.getItem(SYNC_KEY))}catch{return null}}
function saveCache(){localStorage.setItem(SYNC_KEY,JSON.stringify({fileId,baseline,baseVersion}));}
const old=cached();if(old){fileId=old.fileId||null;baseline=old.baseline||null;baseVersion=old.baseVersion||null;}
$('gClientId').value=localStorage.getItem(CLIENT_KEY)||'';
function getClientId(){const id=$('gClientId').value.trim();if(!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(id))throw Error('Enter a valid Google OAuth client ID');localStorage.setItem(CLIENT_KEY,id);return id;}
function online(){return navigator.onLine;}
function oauth(){if(!window.google?.accounts?.oauth2)throw Error('Google sign-in needs an internet connection');return google.accounts.oauth2.initTokenClient({client_id:getClientId(),scope:SCOPE,callback:r=>{if(r.error){say('Google sign-in failed: '+r.error);return;}token=r.access_token;reconnectNeeded=false;stopped=false;say('Connected. Syncing Google Drive...');sync().catch(fail);}});}
function connect(){client=oauth();client.requestAccessToken({prompt:'consent'});}
function fail(err){say('Sync paused: '+err.message);detail('Local data is safe. Check the connection or click Connect Google.');}
async function request(url,options={}){
 if(!token)throw Error('Google sign-in needed. Click Connect Google.');
 const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,...(options.headers||{})}});
 if(r.status===401||r.status===403){token='';reconnectNeeded=true;throw Error('Google authorization expired. Click Connect Google again.');}
 if(!r.ok)throw Error('Drive HTTP '+r.status+': '+(await r.text()).slice(0,140));return r;
}
async function findFile(){
 const q=`name = '${FILE}' and mimeType = 'application/json' and trashed = false`;
 const res=await request('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,fields:'nextPageToken,files(id,name,modifiedTime,version)',pageSize:'1000'}));
 const files=(await res.json()).files||[];
 if(files.length>1&&!fileId)throw Error('Multiple myFitness files found. Choose the original file in Drive before syncing.');
 return files.find(x=>x.id===fileId)||files.sort((a,b)=>b.modifiedTime.localeCompare(a.modifiedTime))[0]||null;
}
async function download(id){const response=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media');const d=await response.json();if(!valid(d))throw Error('Google file format invalid; no changes made.');return d;}
const keyers={foods:x=>String(x.id??(x.date+'|'+x.name)),weights:x=>x.date,workouts:x=>x.date+'|'+x.name,templates:x=>x.name};
function merge(base,local,remote){
 if(!base){if(!local.workouts.length&&!local.foods.length&&!local.weights.length&&equal(local.goals, fresh().goals))return {merged:deep(remote),conflicts:[]};
  // First link of an existing local profile: merge additive entries; fail if profile/goals differ.
  base={...deep(local),profile:deep(remote.profile),goals:deep(remote.goals),foods:[],weights:[],workouts:[],templates:[]};
 }
 const conflicts=[],out=deep(remote);
 const resolve=(b,l,r,k)=>{
   if(equal(l,r))return l;
   if(equal(l,b))return r;
   if(equal(r,b))return l;
   conflicts.push(k);return r;
 };
 for(const prop of ['profile','goals'])out[prop]=resolve(base[prop],local[prop],remote[prop],prop);
 for(const prop of ['foods','weights','workouts','templates']){
  const k=keyers[prop], bm=new Map((base[prop]||[]).map(x=>[k(x),x])),lm=new Map((local[prop]||[]).map(x=>[k(x),x])),rm=new Map((remote[prop]||[]).map(x=>[k(x),x]));
  const keys=new Set([...bm.keys(),...lm.keys(),...rm.keys()]);const rows=[];
  for(const id of keys){const v=resolve(bm.get(id),lm.get(id),rm.get(id),prop+':'+id);if(v!==undefined)rows.push(v);}
  out[prop]=rows;
 }
 return {merged:out,conflicts};
}
function backupConflict(data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='myFitness-conflict-backup-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}
async function upload(data,expectedVersion){
 // Protect against remote change since read. Always re-read version immediately before update.
 const meta=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(fileId)+'?fields=id,version');
 const version=String((await meta.json()).version||'');
 if(expectedVersion&&version!==String(expectedVersion))throw Error('Drive changed while saving; will retry without overwriting.');
 const r=await request('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(fileId)+'?uploadType=media&fields=id,version',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 return (await r.json()).version;
}
async function create(data){const boundary='myfit'+Date.now();const payload='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:FILE,mimeType:'application/json'})+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(data)+'\r\n--'+boundary+'--';const r=await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,version',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body:payload});return r.json();}
async function sync(){
 if(busy){queued=true;return;}if(!online()){say('Offline — changes saved on this device; waiting to sync.');return;}if(!token){if(!reconnectNeeded)say('Connect Google once to enable automatic sync.');return;}
 busy=true;try{
  const f=await findFile();let remote,version;
  if(f){fileId=f.id;remote=await download(fileId);version=f.version;}
  else{if(fileId)throw Error('Previously connected Drive file is missing; not creating a replacement automatically.');const created=await create(state);fileId=created.id;baseline=deep(state);baseVersion=created.version;saveCache();say('Google Drive file created and synced.');return;}
  if(baseline&&fileId!==old?.fileId){baseline=null;baseVersion=null;}
  const result=merge(baseline,state,remote);
  if(result.conflicts.length){stopped=true;backupConflict({local:state,remote,baseline,conflicts:result.conflicts});throw Error('Conflicting edits detected ('+result.conflicts.slice(0,3).join(', ')+'). A backup was downloaded. Sync paused; resolve differences before continuing.');}
  if(!equal(result.merged,remote)){
   try{version=await upload(result.merged,version);}catch(e){if(e.message.includes('Drive changed while saving')){queued=true;return;}throw e;}
  }
  const locallyChanged=!equal(state,result.merged);state=deep(result.merged);baseline=deep(result.merged);baseVersion=version;saveCache();
  localStorage.setItem(KEY,JSON.stringify(state));if(locallyChanged)render();
  say('Synced with Google Drive.');detail('Automatic save/load on · Checks every 30 seconds · Offline edits are queued.');
 }finally{busy=false;if(queued&&!stopped){queued=false;setTimeout(()=>sync().catch(fail),500)}}
}
let debounce;
window.addEventListener('myfitness:changed',()=>{clearTimeout(debounce);debounce=setTimeout(()=>sync().catch(fail),1100);});
window.addEventListener('online',()=>sync().catch(fail));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync().catch(fail)});
$('gSignIn').onclick=()=>{try{connect()}catch(e){fail(e)}};
$('gSignOut').onclick=()=>{if(token&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(token,()=>{});token='';say('Disconnected. Offline data remains on this device.');};
$('gUpload').onclick=()=>sync().catch(fail);
$('gDownload').onclick=()=>sync().catch(fail);
timer=setInterval(()=>{if(!document.hidden&&!stopped)sync().catch(fail)},30000);
// Browser security prevents silently opening a Google consent popup at startup.
// If the token is still held in the same tab, all subsequent loads are automatic.
say('Auto-sync ready. Click Connect Google to authorize this session.');
})();
