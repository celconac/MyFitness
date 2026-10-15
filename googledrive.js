/* myFitness Google Drive auto-sync. Public OAuth client ID is preconfigured.
   Three-way merge + optimistic Drive version check. Conflicts pause sync. */
'use strict';
(()=>{
const $=id=>document.getElementById(id), GOOGLE_CLIENT_ID='386983355308-1luumhktuisb04elgoa13hdcniq4f3os.apps.googleusercontent.com', LEGACY_SYNC_KEY='myfitness-sync-v1', FILE='myFitness-data.json';
const SCOPE='https://www.googleapis.com/auth/drive.file', deep=x=>JSON.parse(JSON.stringify(x));
let token='', client=null, fileId=null, baseline=null, baseVersion=null, busy=false, stopped=false, timer=null, queued=false, reconnectNeeded=false, accountId=null, SYNC_KEY=null;
const native=()=>window.MyFitnessAndroid?.available;
let nativeIdentity=null, renewing=null;
const LOGOUT='myfitness-native-logout-v1';
let generation=0, controller=new AbortController(), expiresAt=0, connecting=false, restoring=false;
const connected=()=>!!token;
const stale=()=>Object.assign(Error('Account session changed.'),{name:'AbortError'});
function invalidate(){generation++;controller.abort();controller=new AbortController();token='';nativeIdentity=null;accountId=null;connecting=false;restoring=false;renewing=null;fileId=null;baseline=null;baseVersion=null;SYNC_KEY=null;queued=false;busy=false;stopped=false;clearTimeout(debounce);}
function guest(){KEY='myfitness-guest-v2';state=fresh();resetAccountEditors();render();}
const say=(s)=>{const el=$('gStatus');if(el)el.textContent=s;};
const detail=(s)=>{const el=$('syncDetail');if(el)el.textContent=s;};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function cached(){try{return SYNC_KEY?JSON.parse(localStorage.getItem(SYNC_KEY)):null}catch{return null}}
function saveCache(){if(SYNC_KEY)localStorage.setItem(SYNC_KEY,JSON.stringify({fileId,baseline,baseVersion}));}
const legacySync=(()=>{try{return JSON.parse(localStorage.getItem(LEGACY_SYNC_KEY))}catch{return null}})();
function getClientId(){return GOOGLE_CLIENT_ID;}
function online(){return navigator.onLine;}
async function identifyAccount(){
 const response=await request('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,permissionId)');
 const info=(await response.json()).user||{};
 const identity=String(info.permissionId||info.emailAddress||'').trim();
 if(!identity)throw Error('Cannot identify this Google account. Sync is blocked to protect your records.');
 return {identity,email:info.emailAddress||'Google account'};
}
async function activateAccount(){
 // Never use the previous person's unsaved session against the new Google account.
 const {identity,email}=await identifyAccount();
 if(nativeIdentity&&identity!==nativeIdentity)throw Error('Google account verification mismatch. Sync blocked.');
 const newKey='myfitness-account-'+encodeURIComponent(identity)+'-v2';
 const newSyncKey='myfitness-sync-account-'+encodeURIComponent(identity)+'-v2';
 const previousKey=KEY;
 if(accountId&&accountId!==identity){localStorage.setItem(KEY,JSON.stringify(state));}
 const savedSync=(()=>{try{return JSON.parse(localStorage.getItem(newSyncKey))}catch{return null}})();
 const listed=await findFileForAccount(savedSync?.fileId);
 // Read after network awaits, so edits made during restoration are retained.
 const stored=KEY===newKey?deep(state):(()=>{try{return JSON.parse(localStorage.getItem(newKey))}catch{return null}})();
 // Legacy migration only when the original file ID matches THIS Google Drive file.
 const legacyMatch=!stored&&legacySync?.fileId&&listed?.id===legacySync.fileId;
 let chosen=valid(stored)?stored:null;
 let cachedSync=savedSync;
 if(!chosen&&legacyMatch){
  try{const legacy=JSON.parse(localStorage.getItem('myfitness-v2'));if(valid(legacy))chosen=legacy;}catch{}
  cachedSync=legacySync;
 }
 if(!chosen&&listed){chosen=await download(listed.id);if(KEY===newKey)chosen=deep(state);}
 if(!chosen)chosen=fresh();
 accountId=identity;KEY=newKey;SYNC_KEY=newSyncKey;
 localStorage.setItem('myfitness-last-active-account-v2',newKey);
 if(previousKey!==newKey)resetAccountEditors();
 state=deep(chosen);fileId=listed?.id||null;
 baseline=valid(cachedSync?.baseline)?cachedSync.baseline:null;baseVersion=cachedSync?.baseVersion||null;
 // A local snapshot is not proof of what was last uploaded. Without a matching
 // sync baseline, use first-link merging rather than treating local edits as old.
 if(!fileId||cachedSync?.fileId!==fileId){baseline=null;baseVersion=listed?.version||null;}
 localStorage.setItem(KEY,JSON.stringify(state));saveCache();render();
 say('Connected as '+email+'.');detail('This account has its own local data and Google Drive file.');
}
async function findFileForAccount(knownId){
 const q=`name = '${FILE}' and mimeType = 'application/json' and trashed = false`;
 const res=await request('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,fields:'nextPageToken,files(id,name,modifiedTime,version)',pageSize:'1000'}));
 const files=(await res.json()).files||[];
 if(knownId){const match=files.find(f=>f.id===knownId);if(!match)throw Error('Saved file not accessible under this account. No replacement created.');return match;}
 if(files.length>1)throw Error('Multiple myFitness-data.json files in this account. Resolve duplicates before syncing.');
 return files[0]||null;
}
function oauth(epoch){if(!window.google?.accounts?.oauth2)throw Error('Google sign-in needs an internet connection');return google.accounts.oauth2.initTokenClient({client_id:getClientId(),scope:SCOPE,error_callback:()=>{if(epoch===generation){connecting=false;fail(Error('Google sign-in was cancelled or blocked. Try Connect Google.'));}},callback:r=>{
 if(epoch!==generation)return;
 connecting=false;
 if(r.error||!r.access_token){fail(Error('Google sign-in failed or was cancelled.'));return;}
 token=r.access_token;expiresAt=Date.now()+Number(r.expires_in||3600)*1000;reconnectNeeded=false;stopped=false;connecting=true;say('Verifying Google account...');
 activateAccount().then(()=>{if(epoch!==generation)throw stale();connecting=false;return sync()}).catch(e=>{if(epoch===generation){connecting=false;token='';accountId=null;fail(e)}});
 }});}
async function connect(){
 if(connecting||restoring)return;
 if(new URL(location.href).searchParams.get('androidSession')==='1'&&!native())throw Error('Waiting for the Android Google connection. Update Chrome and reopen myFitness if this continues.');
 if(native()){
  localStorage.setItem(KEY,JSON.stringify(state));invalidate();
  await restore(true);return;
 }
 if(!window.google?.accounts?.oauth2)throw Error('Google sign-in needs an internet connection');
 // Freeze sync before an account chooser opens; late responses cannot change ownership.
 localStorage.setItem(KEY,JSON.stringify(state));invalidate();connecting=true;
 const epoch=generation;client=oauth(epoch);client.requestAccessToken({prompt:'select_account'});
}
function fail(err){if(err.name==='AbortError')return;say('Sync paused: '+err.message);detail('Local data is safe. Check the connection or click Connect Google.');}
async function request(url,options={}){
 const epoch=generation;
 if(!connected())throw Error('Google sign-in needed. Click Connect Google.');
 if(native()&&Date.now()>=expiresAt-30000)await renew(false);
 if(Date.now()>=expiresAt-30000){token='';reconnectNeeded=true;throw Error('Google authorization expired. Click Connect Google to resume sync.');}
 const r=await fetch(url,{...options,signal:controller.signal,headers:{Authorization:'Bearer '+token,...(options.headers||{})}});
 if(epoch!==generation)throw stale();
 // Also guard body reads: sign-out can happen after headers arrive.
 const json=r.json.bind(r),text=r.text.bind(r);
 r.json=async()=>{const value=await json();if(epoch!==generation)throw stale();return value;};
 r.text=async()=>{const value=await text();if(epoch!==generation)throw stale();return value;};
 if(r.status===401){
  token='';expiresAt=0;reconnectNeeded=true;
  if(native())await renew(true);
  // Do not replay a write: its result may be ambiguous. The next sync re-reads Drive.
  throw Error(native()?'Google connection renewed. Sync will retry safely.':'Google session expired or was revoked. Click Connect Google again.');
 }
 if(!r.ok)throw Error('Drive HTTP '+r.status+': '+(await r.text()).slice(0,140));return r;
}
async function findFile(){if(!accountId)throw Error('Connect Google and verify your account first.');return findFileForAccount(fileId);}
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
 if(connecting||restoring||stopped)return;
 if(busy){queued=true;return;}if(!online()){say('Offline — changes saved on this device; waiting to sync.');return;}if(!connected()||!accountId){if(!reconnectNeeded)say('Connect Google to verify your account and enable sync.');return;}
 const epoch=generation;
 busy=true;try{
  const f=await findFile();let remote,version;
  if(f){fileId=f.id;remote=await download(fileId);version=f.version;}
  else{if(fileId)throw Error('Previously connected Drive file is not visible to this Google login. Confirm the correct account and Drive authorization; no replacement was created.');const sent=deep(state),created=await create(sent);fileId=created.id;baseline=sent;baseVersion=created.version;queued=!equal(state,sent);saveCache();say('Google Drive file created and synced.');return;}

  const localAtRead=deep(state),result=merge(baseline,localAtRead,remote);
  if(result.conflicts.length){stopped=true;backupConflict({local:state,remote,baseline,conflicts:result.conflicts});throw Error('Conflicting edits detected ('+result.conflicts.slice(0,3).join(', ')+'). A backup was downloaded. Sync paused; resolve differences before continuing.');}
  if(!equal(result.merged,remote)){
   try{version=await upload(result.merged,version);}catch(e){if(e.message.includes('Drive changed while saving')){queued=true;return;}throw e;}
  }
  // Merge edits made while an upload was in flight back into the local snapshot.
  const latest=merge(localAtRead,state,result.merged);
  if(latest.conflicts.length){stopped=true;backupConflict({local:state,remote:result.merged,baseline:localAtRead,conflicts:latest.conflicts});throw Error('Edits changed during sync. Local edits preserved; resolve the downloaded backup.');}
  const locallyChanged=!equal(state,latest.merged);state=deep(latest.merged);baseline=deep(result.merged);baseVersion=version;queued=queued||!equal(state,baseline);saveCache();
  localStorage.setItem(KEY,JSON.stringify(state));if(locallyChanged){try{render()}catch(e){console.error('myFitness view render:',e);detail('Data loaded, but the screen could not refresh. Please reload this page.')}}
  say('Synced with Google Drive.');detail('Automatic save/load on · Checks every 30 seconds · Offline edits are queued.');
 }finally{if(epoch===generation){busy=false;if(queued&&!stopped){queued=false;setTimeout(()=>{if(epoch===generation)sync().catch(fail)},500)}}}
}
let debounce;
window.addEventListener('myfitness:changed',()=>{if(!accountId)return;clearTimeout(debounce);debounce=setTimeout(()=>sync().catch(fail),1100);});
async function resume(){if(native()&&!token&&!reconnectNeeded&&!localStorage.getItem(LOGOUT))await restore();else await sync();}
window.addEventListener('online',()=>resume().catch(fail));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)resume().catch(fail)});
$('gSignIn').onclick=async()=>{try{await connect()}catch(e){fail(e)}};
$('gSignOut').onclick=async()=>{
 localStorage.setItem(LOGOUT,'1');localStorage.setItem(KEY,JSON.stringify(state));
 invalidate();localStorage.removeItem(LAST_ACCOUNT_KEY);guest();
 say('Signed out on this device. Saved account records are kept separately.');
 if(native()){try{await window.MyFitnessAndroid.request('signout')}catch{detail('Signed out locally. Android sign-out will finish when reconnected.')}}
};
$('gUpload').onclick=()=>sync().catch(fail);
$('gDownload').onclick=async()=>{
 if(busy||connecting||restoring){say('Sync in progress — please wait.');return;}
 if(!connected()||!accountId){say('Connect Google first.');return;}
 if(!online()){say('Offline — reconnect before loading.');return;}
 const epoch=generation;busy=true;
 try{
  say('Loading from Google Drive...');
  const f=await findFile();
  if(!f)throw Error('No myFitness-data.json found in the connected Google Drive account. Check that you connected the same Google account.');
  const remote=await download(f.id);
  const localHasData=state.workouts.length||state.foods.length||state.weights.length||state.templates?.length;
  if(localHasData&&!equal(state,remote)){
   if(!confirm('Load from Google Drive? This replaces this browser’s current entries with your Google Drive copy. Choose Cancel if you have unsynced changes.')){say('Load cancelled. Local data unchanged.');return;}
   backupConflict({local:state,reason:'Backup before loading Google Drive'});
  }
  fileId=f.id;state=deep(remote);baseline=deep(remote);baseVersion=f.version;stopped=false;queued=false;saveCache();
  localStorage.setItem(KEY,JSON.stringify(state));
  try{render()}catch(e){console.error('myFitness view render:',e);throw Error('Drive data downloaded, but your app view failed to refresh. Reload the page to see the saved records. '+e.message)}
  say('Loaded your Google Drive data successfully.');detail('Workout routines, food, weights and goals are now loaded.');
 }catch(e){fail(e)}finally{if(epoch===generation)busy=false;}
};
timer=setInterval(()=>{if(!document.hidden&&!stopped)resume().catch(fail)},30000);
// Browser security prevents silently opening a Google consent popup at startup.
// If the token is still held in the same tab, all subsequent loads are automatic.
say(savedAccountKey?'Saved data restored on this device. Connect Google to resume syncing.':'Not connected. Connect Google to load your personal data.');
if(savedAccountKey)detail('Your saved workouts, meals and goals are available offline. Drive sync resumes only after Google sign-in.');
async function renew(invalid=false,interactive=false){
 if(renewing)return renewing;
 const epoch=generation, expected=nativeIdentity;
 renewing=(async()=>{
  const result=await window.MyFitnessAndroid.request('authorize',{interactive,invalidate:invalid});
  if(epoch!==generation)throw stale();
  if(typeof result.accessToken!=='string'||!result.accessToken||typeof result.identity!=='string'||!result.identity)throw Error('Android Google account could not be verified.');
  if(!interactive&&expected&&expected!==result.identity)throw Error('Google account changed. Connect Google to choose your account.');
  token=result.accessToken;nativeIdentity=result.identity;expiresAt=Date.now()+Math.min(Number(result.expiresIn)||3000,3000)*1000;
  reconnectNeeded=false;
 })();
 try{await renewing}finally{if(epoch===generation)renewing=null;}
}
async function restore(interactive=false){
 if(restoring||connecting||!online()||!native())return;
 restoring=true;const epoch=generation;
 try{
  if(localStorage.getItem(LOGOUT)){
   await window.MyFitnessAndroid.request('signout');
   if(epoch!==generation)throw stale();
   if(!interactive)return;
  }
  say('Restoring Google connection…');
  await renew(false,interactive);
  if(epoch!==generation)throw stale();
  await activateAccount();
  if(epoch!==generation)throw stale();
  if(interactive)localStorage.removeItem(LOGOUT);
  stopped=false;
 }catch(e){if(epoch===generation){token='';nativeIdentity=null;accountId=null;reconnectNeeded=true;
  if(e.code==='signed_out'||e.code==='interaction_required')say('Saved records available. Connect Google to enable syncing.');else fail(e);
 }}finally{if(epoch===generation)restoring=false;}
 if(epoch===generation&&token)await sync();
}
window.addEventListener('myfitness:android-ready',()=>{if(!token&&!reconnectNeeded)restore().catch(fail)});
window.addEventListener('storage',event=>{
 if(event.key===LAST_ACCOUNT_KEY&&event.newValue!==KEY||event.key===LOGOUT&&event.newValue){
  invalidate();guest();say('Account changed in another window. Reload to reconnect.');
 }
});
if(native())restore().catch(fail);
})();
