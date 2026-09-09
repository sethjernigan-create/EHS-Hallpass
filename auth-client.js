(function(){
  'use strict';
  const gate=document.getElementById('authGate'),app=document.getElementById('appContent'),message=document.getElementById('authMessage');
  let user=null;
  async function api(path,data){
    let response;try{response=await fetch(path,{method:data===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});}catch{throw new Error('Connect to the internet and try again.');}
    const result=await response.json();
    if(!response.ok){if(response.status===401&&user){lock();start().catch(e=>message.textContent=e.message);}throw new Error(result.error||'Please try again.');}return result;
  }
  function lock(){user=null;app.hidden=true;gate.hidden=false;window.HallCamera?.stop();window.dispatchEvent(new CustomEvent('hall:auth',{detail:null}));}
  function unlock(who){user=who;gate.hidden=true;app.hidden=false;document.getElementById('signedInEmail').textContent=who.email;window.dispatchEvent(new CustomEvent('hall:auth',{detail:who}));}
  let googleLoaded;
  function loadGoogle(){return googleLoaded||(googleLoaded=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.onload=resolve;s.onerror=()=>{googleLoaded=null;reject(new Error('Google sign-in could not load. Check your connection and reload.'));};document.head.append(s);}));}
  async function start(){
    message.textContent='Loading staff sign-in…';const config=await api('/api/auth/config');
    try{unlock(await api('/api/auth/session'));return;}catch(e){if(!e.message.includes('Sign in with an approved'))throw e;}
    await loadGoogle();const {nonce}=await api('/api/auth/challenge',{});
    google.accounts.id.initialize({client_id:config.clientId,nonce,hd:'estemschools.org',auto_select:false,callback:async result=>{
      message.textContent='Checking staff access…';
      try{unlock(await api('/api/auth/login',{credential:result.credential,nonce}));}catch(e){message.textContent=e.message;document.getElementById('authRetry').hidden=false;}
    }});
    const target=document.getElementById('googleSignIn');target.replaceChildren();google.accounts.id.renderButton(target,{theme:'outline',size:'large',text:'signin_with',width:280});message.textContent='Use your approved eStem staff Google account.';
  }
  document.getElementById('authRetry').onclick=()=>{document.getElementById('authRetry').hidden=true;start().catch(e=>message.textContent=e.message);};
  document.getElementById('signOut').onclick=async()=>{try{await api('/api/auth/logout',{});lock();window.google?.accounts?.id?.disableAutoSelect();await start();}catch(e){document.getElementById('accountMessage').textContent=e.message;}};
  window.HallAuth={api,user:()=>user};start().catch(e=>{message.textContent=e.message;document.getElementById('authRetry').hidden=false;});
})();
