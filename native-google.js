/* Chrome TWA message port; credentials remain in memory only. */
'use strict';
(()=>{
 let port=null, serial=0;
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
  if(event.origin!=='https://celconac.github.io'||window!==window.top||event.ports?.length!==1)return;
  let message;try{message=JSON.parse(event.data)}catch{return;}
  if(message.type!=='myfitness-native-ready'||message.version!==1)return;
  rejectPending();if(port)port.close();port=event.ports[0];
  port.onmessage=event=>{
   let response;try{response=JSON.parse(event.data)}catch{return;}
   if(response.type!=='myfitness-native-result'||response.version!==1)return;
   const item=pending.get(response.id);if(!item)return;
   pending.delete(response.id);clearTimeout(item.timer);
   if(response.error)item.reject(Object.assign(Error(response.error),{code:response.error}));else item.resolve(response);
  };
  port.start();window.dispatchEvent(new Event('myfitness:android-ready'));
 });
})();
