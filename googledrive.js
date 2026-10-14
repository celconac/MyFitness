/* Browser-only Google Drive sync using Google Identity Services and Drive REST API.
   Explicit save/load. Scope drive.file limits access to files made/opened by this app.
   No server, API secret, refresh tokens, or token persistence. */
'use strict';
(()=>{
const byId=id=>document.getElementById(id);
const KEY='myfitness-google-client-id';
const FILE='myFitness-data.json';
const SCOPE='https://www.googleapis.com/auth/drive.file';
let accessToken='', tokenClient=null;
const status=s=>{byId('gStatus').textContent=s};
byId('gClientId').value=localStorage.getItem(KEY)||'';
function clientId(){
 const id=byId('gClientId').value.trim();
 if(!/^[a-zA-Z0-9._-]+\.apps\.googleusercontent\.com$/.test(id))throw Error('Enter a Google OAuth web client ID ending in .apps.googleusercontent.com');
 localStorage.setItem(KEY,id);return id;
}
async function connect(){
 if(!window.google?.accounts?.oauth2)throw Error('Google sign-in is unavailable. Check internet access and reload.');
 const id=clientId();
 accessToken='';
 await new Promise((resolve,reject)=>{
  tokenClient=google.accounts.oauth2.initTokenClient({client_id:id,scope:SCOPE,callback:r=>{if(r.error)reject(Error(r.error));else{accessToken=r.access_token;resolve()}}});
  tokenClient.requestAccessToken({prompt:'consent'});
 });
 status('Connected to Google Drive for this browser session.');
}
async function authorize(){if(!accessToken)await connect();}
async function request(url,options={}){
 await authorize();
 const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+accessToken,...(options.headers||{})}});
 if(r.status===401){accessToken='';throw Error('Google access expired. Click Connect Google again.');}
 if(!r.ok)throw Error('Google Drive error '+r.status+': '+(await r.text()).slice(0,240));
 return r;
}
async function findFile(){
 const q=`name = '${FILE}' and mimeType = 'application/json' and trashed = false`;
 const r=await request('https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,fields:'nextPageToken,files(id,name,modifiedTime)',page_size:'100'}));
 const j=await r.json();return (j.files||[]).sort((a,b)=>b.modifiedTime.localeCompare(a.modifiedTime))[0]||null;
}
async function save(){
 if(!confirm('Save this device\'s myFitness data to Google Drive? This may overwrite changes made from another device.'))return;
 status('Saving to Google Drive...');
 const found=await findFile();
 const data=JSON.stringify(state);
 if(found){
  await request('https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(found.id)+'?uploadType=media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:data});
 }else{
  const boundary='myfitness_'+Date.now();
  const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify({name:FILE,mimeType:'application/json',description:'Private myFitness workout and nutrition data'})+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+data+'\r\n--'+boundary+'--';
  await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body});
 }
 status('Saved to Google Drive. Your file is named '+FILE+'.');
}
async function load(){
 status('Checking Google Drive...');
 const file=await findFile();
 if(!file){status('No myFitness Google Drive file yet. Save from this device first.');return;}
 const r=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media');
 const data=await r.json();
 if(!valid(data))throw Error('Google Drive data is not a valid myFitness backup.');
 if(!confirm('Replace this device\'s myFitness data with the Google Drive copy? Export a local backup first if you need it.')){status('Load canceled.');return;}
 state=data;persist();status('Loaded from Google Drive successfully.');
}
function run(f){Promise.resolve().then(f).catch(e=>{status(e.message);alert(e.message)})}
byId('gSignIn').onclick=()=>run(connect);
byId('gSignOut').onclick=()=>{if(accessToken&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(accessToken,()=>{});accessToken='';status('Disconnected; local data remains on this phone.')};
byId('gUpload').onclick=()=>run(save);
byId('gDownload').onclick=()=>run(load);
})();
