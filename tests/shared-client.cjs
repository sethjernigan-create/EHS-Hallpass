const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/index.html','utf8');
const dom=new JSDOM(html,{url:'https://hall.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
const tick=()=>new Promise(r=>setImmediate(r));let loggedIn=false,callback,lookupCount=0,denyLookup=false;
w.alert=()=>{};w.confirm=()=>true;
w.localStorage.setItem('hc.roster.v1',JSON.stringify({students:[{id:'001',first:'Stale',last:'Name',grade:'9'}]}));
w.google={accounts:{id:{initialize:args=>{callback=args.callback;assert.equal(args.nonce,'nonce-test');},renderButton:()=>{},disableAutoSelect:()=>{}}}};
w.fetch=async (p,options)=>{
  assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');
  let status=200,result={};
  if(p==='/api/auth/config')result={clientId:'client-test'};
  else if(p==='/api/auth/session'){if(!loggedIn){status=401;result={error:'Sign in with an approved staff account.'};}else result={email:'staff-test@estemschools.org',admin:false};}
  else if(p==='/api/auth/challenge')result={nonce:'nonce-test'};
  else if(p==='/api/auth/login'){loggedIn=true;result={email:'staff-test@estemschools.org',admin:false};}
  else if(p==='/api/roster/status')result={count:1};
  else if(p==='/api/students/lookup'){lookupCount++;if(denyLookup){status=401;result={error:'Sign in with an approved staff account.'};loggedIn=false;}else result={student:{id:'001',first:'Current',last:'Student',grade:'10'}};}
  else if(p==='/api/auth/logout')loggedIn=false;
  return {ok:status===200,status,json:async()=>result};
};
(async()=>{
  for(const f of ['hall-core.js','roster-core.js','roster.js'])w.eval(fs.readFileSync(root+'/'+f,'utf8'));
  w.eval(html.match(/<script>([\s\S]*?)<\/script>/)[1]);w.eval(fs.readFileSync(root+'/auth-client.js','utf8'));await tick();
  d.querySelector('script[src="https://accounts.google.com/gsi/client"]').onload();await tick();
  assert.equal(d.getElementById('appContent').hidden,true);assert.equal(w.localStorage.getItem('hc.roster.v1'),null);
  w.dispatchEvent(new w.CustomEvent('hall:id',{detail:'001'}));await tick();assert.equal(lookupCount,0);
  await callback({credential:'synthetic-test-token'});await tick();assert.equal(d.getElementById('appContent').hidden,false);assert.equal(d.getElementById('rosterAdmin').hidden,true);
  w.dispatchEvent(new w.CustomEvent('hall:id',{detail:'001'}));await tick();assert.equal(d.getElementById('passStudentName').textContent,'Current Student');assert.equal(d.getElementById('passStudentGrade').textContent,'Grade 10');
  d.querySelector('[name=passType][value="No pass"]').checked=true;d.getElementById('passForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  const logs=JSON.parse(w.localStorage.getItem('hc.scans'));assert.equal(logs[0].student_first,'Current');assert.equal(logs[0].staff_email,'staff-test@estemschools.org');assert.equal(d.getElementById('refFirst').value,'Current');
  denyLookup=true;w.dispatchEvent(new w.CustomEvent('hall:id',{detail:'002'}));await tick();assert.equal(d.getElementById('appContent').hidden,true);assert.equal(JSON.parse(w.localStorage.getItem('hc.scans')).length,1);
  console.log('PASS staff sign-in gating, no local roster fallback, shared name lookup, referral prefilling, verified staff attribution, expired-session lock, and hidden administrator upload.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>w.close());
