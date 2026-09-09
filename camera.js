(function(){
  'use strict';
  let stream=null,controls=null,generation=0,torch=false;
  const video=document.getElementById('cameraVideo'),status=document.getElementById('cameraStatus');
  const start=document.getElementById('cameraStart'),stop=document.getElementById('cameraStop'),light=document.getElementById('cameraTorch'),select=document.getElementById('cameraSelect');
  function halt(message){
    generation++;if(controls){controls.stop();controls=null;}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}
    video.srcObject=null;torch=false;light.hidden=true;light.setAttribute('aria-pressed','false');start.disabled=false;stop.hidden=true;status.textContent=message||'Camera stopped.';
  }
  async function begin(deviceId){
    halt();const run=generation;start.disabled=true;stop.hidden=false;status.textContent='Allow camera access to scan an ID.';
    try{
      if(!window.isSecureContext)throw new Error('Open the app using its secure HTTPS link to use the camera.');
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access is unavailable. Open this app in Safari or Chrome.');
      if(!window.ZXingBrowser)throw new Error('The scanner could not load. Reconnect and reload the app.');
      const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(deviceId?{deviceId:{exact:deviceId}}:{facingMode:{ideal:'environment'}}),width:{ideal:1920},height:{ideal:1080}}});
      if(run!==generation){acquired.getTracks().forEach(t=>t.stop());return;}
      stream=acquired;const track=stream.getVideoTracks()[0];
      track.addEventListener('ended',()=>{if(run===generation)halt('Camera interrupted. Tap Start camera to resume.');});
      light.hidden=!track.getCapabilities?.().torch;
      status.textContent='Hold the entire barcode inside the view. Keep the card steady.';
      const reader=new ZXingBrowser.BrowserMultiFormatOneDReader(undefined,{delayBetweenScanAttempts:120,delayBetweenScanSuccess:1000});
      const active=await reader.decodeFromStream(stream,video,(result)=>{
        if(!result||run!==generation)return;
        let id;try{id=HallCore.normalizeId(result.getText());}catch(e){status.textContent=e.message;return;}
        halt('ID captured. Choose the pass type.');window.dispatchEvent(new CustomEvent('hall:id',{detail:id}));
      });
      if(run!==generation){active.stop();return;}controls=active;
      try{
        const devices=await navigator.mediaDevices.enumerateDevices();if(run!==generation)return;
        select.replaceChildren();devices.filter(d=>d.kind==='videoinput').forEach((d,i)=>{const option=new Option(d.label||'Camera '+(i+1),d.deviceId);select.add(option);});
        select.value=track.getSettings().deviceId||'';select.hidden=select.options.length<2;
      }catch(e){select.hidden=true;}
    }catch(e){if(run!==generation)return;halt(({NotAllowedError:'Camera permission was denied. Allow camera access in your browser settings, then try again.',NotFoundError:'No camera was found. Enter the ID manually.',NotReadableError:'The camera is busy. Close other camera apps and try again.',OverconstrainedError:'This camera is unavailable. Try another camera.'})[e.name]||e.message);}
  }
  start.addEventListener('click',()=>begin(select.value||undefined));stop.addEventListener('click',()=>halt());
  select.addEventListener('change',()=>begin(select.value));
  light.addEventListener('click',async()=>{const track=stream?.getVideoTracks()[0];if(!track)return;try{await track.applyConstraints({advanced:[{torch:!torch}]});torch=!torch;light.setAttribute('aria-pressed',String(torch));}catch(e){status.textContent='Flashlight is unavailable on this camera.';}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)halt('Camera paused. Tap Start camera to resume.');});
  window.addEventListener('pagehide',()=>halt());window.HallCamera={stop:halt};
})();
