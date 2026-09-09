(function(root){
  'use strict';
  const PASS_TYPES = ['Nurse','Bathroom','Other class','Office','No pass'];
  function normalizeId(value){
    const id=String(value == null ? '' : value).trim();
    if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id)) throw new Error('This barcode does not look like a student ID. Enter the printed ID manually.');
    return id;
  }
  function duplicate(scans,id,now){return scans.some(s=>s.id===id && now-Date.parse(s.ts)>=0 && now-Date.parse(s.ts)<20000);}
  function narrative(s){return 'Student ID '+s.id+' was observed in '+s.location+' on '+s.date+' at '+s.time+' during '+s.period+' without a hall pass.'+(s.notes ? ' Staff notes: '+s.notes : '');}
  function csvEscape(v){v=v==null?'':String(v);if(/^[\s]*[=+@-]/.test(v))v="'"+v;return /[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}
  const FORM_URL='https://www.cognitoforms.com/EStemHighSchool13/_20262027HighSchoolBehaviorDocument';
  function referralPayload(s){
    const p={Date:s.date,LocationOfInfraction:s.location,CommentsExplanationOfIncident:s.referral_text||narrative(s)};
    if(s.student_first||s.student_last)p.StudentName={First:s.student_first||'',Last:s.student_last||''};
    if(['9','10','11','12'].includes(s.grade))p.Grade=s.grade;
    if(s.staff_email)p.FacultyStaffEmailAddress2=s.staff_email;
    const period=/^[1-8](st|nd|rd|th)$/.test(s.period)?s.period+' Period':s.period;
    if(['Before School','1st Period','2nd Period','Content Lab','3rd Period','4th Period','5th Period','6th Period','7th Period','8th Period','After School'].includes(period))p.ClassPeriod=period;
    return p;
  }
  function referralUrl(s){const url=new URL(FORM_URL);url.searchParams.set('entry',JSON.stringify(referralPayload(s)));return url.href;}
  const api={PASS_TYPES,normalizeId,duplicate,narrative,csvEscape,referralPayload,referralUrl};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HallCore=api;
})(typeof window==='undefined'?globalThis:window);
