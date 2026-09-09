(function(root){
  'use strict';
  function parseCSV(text){
    if(typeof text!=='string'||text.length>10*1024*1024)throw new Error('Choose a CSV smaller than 10 MB.');
    text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false,closed=false;
    function field(){row.push(cell);cell='';closed=false;}
    function line(){field();if(row.some(v=>v.trim()))rows.push(row);row=[];if(rows.length>20001)throw new Error('The roster is limited to 20,000 students.');}
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;continue;}
      if(c===','){field();continue;}
      if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;line();continue;}
      if(c==='"'){if(cell||closed)throw new Error('Invalid CSV quoting. Export the roster as CSV again.');quoted=true;continue;}
      if(closed){if(c===' '||c==='\t')continue;throw new Error('Invalid CSV quoting. Export the roster as CSV again.');}
      cell+=c;
    }
    if(quoted)throw new Error('An unfinished quoted field was found. Export the roster as CSV again.');
    if(cell||row.length||closed)line();return rows;
  }
  function validateStudents(students){
    if(!Array.isArray(students)||!students.length||students.length>20000)throw new Error('No usable students were found in this roster.');
    const ids=new Set();return students.map((s,i)=>{
      if(!s||typeof s!=='object')throw new Error('Invalid roster record.');
      const id=String(s.id??'').trim(),first=String(s.first??'').trim(),last=String(s.last??'').trim(),grade=String(s.grade??'').trim();
      if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id))throw new Error('Missing or invalid student ID on row '+(i+2)+'.');
      if(!first||!last||first.length>120||last.length>120)throw new Error('Missing or invalid name on row '+(i+2)+'.');
      if(grade.length>20)throw new Error('Invalid grade on row '+(i+2)+'.');
      if(ids.has(id))throw new Error('Duplicate student ID on row '+(i+2)+'. Resolve duplicate IDs before importing.');
      ids.add(id);return {id,first,last,grade};
    });
  }
  function parseRoster(text){
    const rows=parseCSV(text);if(rows.length<2)throw new Error('The CSV must include a header and at least one student.');
    const headers=rows.shift().map(h=>h.trim().toLowerCase().replace(/[^a-z0-9]/g,''));
    function column(choices,required){const found=headers.map((h,i)=>choices.includes(h)?i:-1).filter(i=>i>=0);if(found.length>1)throw new Error('The CSV has duplicate '+choices[0]+' columns.');if(required&&!found.length)throw new Error('Required columns: Student Id, First Name, Last Name. Grade is optional.');return found[0]??-1;}
    const id=column(['studentid','studentidnumber','id'],true),first=column(['firstname','studentfirstname'],true),last=column(['lastname','studentlastname'],true),grade=column(['grade','gradelevel'],false);
    return validateStudents(rows.map(row=>({id:row[id],first:row[first],last:row[last],grade:grade<0?'':row[grade]})));
  }
  const api={parseCSV,parseRoster,validateStudents};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RosterCore=api;
})(typeof window==='undefined'?globalThis:window);
