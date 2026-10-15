/* Chrome TWA message port; credentials remain in memory only. */
'use strict';
(()=>{
 let port=null, candidate=null, serial=0;
 const pending=new Map();
 const rejectPending=()=>{for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Android connection changed. Try again.'));}pending.clear();};
 const bridge={
  get available(){return !!port;},
  request(type,options={}){
   if(!port)return Promise.reject(Error('Android connection unavailable. Reopen myFitness.'));
   const id=crypto.randomUUID()+'-'+(++serial);
   return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('Google connection timed out. Try again.'));},90000);
    pending.set(id,{resolve,reject,timer});
    port.postMessage(JSON.stringify({type:'myfitness-native-'+type,version:1,id,...options}));
   });
  }
 };
 Object.defineProperty(window,'MyFitnessAndroid',{value:bridge,writable:false});
 window.addEventListener('message',event=>{
  // Chromium derives an android-app origin from the DAL-verified website.
  const trusted=event.origin==='https://celconac.github.io'||event.origin==='android-app://celconac.github.io';
  if(!trusted||window!==window.top||event.ports?.length!==1)return;
  // Chrome transfers the port in an EMPTY window message. Native messages,
  // including our ready handshake, are subsequently delivered on that port.
  let initial=null;
  if(event.data!==''){try{initial=JSON.parse(event.data)}catch{return;}
   if(initial.type!=='myfitness-native-ready'||initial.version!==1)return;}
  rejectPending();if(candidate)candidate.close();port=null;candidate=event.ports[0];
  const incoming=candidate;
  const receive=event=>{
   if(candidate!==incoming)return;
   let response;try{response=JSON.parse(event.data)}catch{return;}
   if(response.type==='myfitness-native-ready'&&response.version===1){
    if(port!==incoming){port=incoming;window.dispatchEvent(new Event('myfitness:android-ready'));}
    return;
   }
   if(port!==incoming)return;
   if(response.type!=='myfitness-native-result'||response.version!==1)return;
   const item=pending.get(response.id);if(!item)return;
   pending.delete(response.id);clearTimeout(item.timer);
   if(response.error)item.reject(Object.assign(Error(response.error),{code:response.error}));else item.resolve(response);
  };
  incoming.onmessage=receive;incoming.start();
  if(initial)receive({data:JSON.stringify(initial)});
 });
})();
