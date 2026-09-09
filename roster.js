(function(){
  'use strict';let count=0;
  const status=document.getElementById('rosterStatus'),message=document.getElementById('rosterMessage'),file=document.getElementById('rosterFile');
  // Never fall back to the obsolete device roster after an authorization failure.
  try{localStorage.removeItem('hc.roster.v1');}catch{}
  async function refresh(){const result=await HallAuth.api('/api/roster/status');count=result.count;status.textContent=count+' students available to approved staff'+(result.updatedAt?' · updated '+new Date(result.updatedAt).toLocaleDateString():'');}
  window.addEventListener('hall:auth',ev=>{document.getElementById('rosterAdmin').hidden=!ev.detail?.admin;if(ev.detail)refresh().catch(e=>status.textContent=e.message);else count=0;});
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0];if(!selected)return;file.disabled=true;message.textContent='Checking roster…';
    try{if(selected.size>4*1024*1024)throw new Error('Choose a CSV smaller than 4 MB.');const students=RosterCore.parseRoster(await selected.text());if(!confirm('Replace the shared roster with '+students.length+' students? Existing hallway logs will be kept.')){message.textContent='Import cancelled.';return;}await HallAuth.api('/api/roster/import',{students});await refresh();message.textContent='Shared roster updated for all approved staff.';}catch(e){message.textContent=e.message;}finally{file.disabled=false;file.value='';}
  });
  window.HallRoster={lookup:async id=>(await HallAuth.api('/api/students/lookup',{id})).student,count:()=>count};
})();
