(function(){
  'use strict';
  const KEY='hc.roster.v1';let roster=new Map(),importedAt='';
  const status=document.getElementById('rosterStatus'),message=document.getElementById('rosterMessage'),file=document.getElementById('rosterFile'),remove=document.getElementById('removeRoster');
  function paint(){status.textContent=roster.size?roster.size+' students saved on this phone'+(importedAt?' · imported '+new Date(importedAt).toLocaleDateString():''):'No roster on this phone.';remove.disabled=!roster.size;}
  try{const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);roster=new Map(RosterCore.validateStudents(saved.students).map(s=>[s.id,s]));importedAt=saved.importedAt||'';}}catch(e){message.textContent='The saved roster could not be loaded. Import the CSV again.';}
  paint();
  file.addEventListener('change',async function(){
    const selected=file.files?.[0];if(!selected)return;
    file.disabled=true;message.textContent='Checking roster…';
    try{
      if(selected.size>10*1024*1024)throw new Error('Choose a CSV smaller than 10 MB.');
      const students=RosterCore.parseRoster(await selected.text());
      if(roster.size&&!window.confirm('Replace the '+roster.size+'-student roster on this phone with '+students.length+' students? Existing hallway logs will be kept.')){message.textContent='Import cancelled. The existing roster is unchanged.';return;}
      const next={students,importedAt:new Date().toISOString()};
      try{localStorage.setItem(KEY,JSON.stringify(next));}catch(e){throw new Error('This phone could not save the roster. Free browser storage or allow site storage, then try again. The previous roster was kept.');}
      roster=new Map(students.map(s=>[s.id,s]));importedAt=next.importedAt;paint();
      message.textContent='Roster imported. Scanning an ID will now show the student’s name and grade.';
    }catch(e){message.textContent=e.message;}finally{file.value='';file.disabled=false;}
  });
  remove.addEventListener('click',function(){
    if(!confirm('Remove the roster from this phone? Existing hallway logs will keep their saved names. You can import the CSV again later.'))return;
    try{localStorage.removeItem(KEY);}catch(e){message.textContent='The roster could not be removed. Please try again.';return;}
    roster=new Map();importedAt='';paint();message.textContent='Roster removed from this phone.';
  });
  window.HallRoster={lookup:id=>{const s=roster.get(String(id).trim());return s?{...s}:null;},count:()=>roster.size};
})();
