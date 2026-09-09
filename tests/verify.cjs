const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=fs.readFileSync(path.join(root,'hall-core.js'),'utf8');
const inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
let passed=0;async function ok(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
function app(seed={}){const dom=new JSDOM(html,{url:'https://hall.test/',runScripts:'outside-only'});const w=dom.window;w.alert=()=>{};w.confirm=()=>true;w.navigator.vibrate=()=>{};Object.entries(seed).forEach(([k,v])=>w.localStorage.setItem(k,JSON.stringify(v)));w.HallAuth={user:()=>({email:'test@estemschools.org'})};w.HallRoster={lookup:async()=>null};w.eval(core);w.eval(inline);return dom;}
const dom=app();const w=dom.window,d=w.document;
async function scan(id){w.dispatchEvent(new w.CustomEvent('hall:id',{detail:id}));await new Promise(r=>setImmediate(r));}
function save(pass){d.querySelector('input[name=passType][value="'+pass+'"]').checked=true;d.getElementById('passForm').dispatchEvent(new w.Event('submit',{cancelable:true}));}
const logs=()=>JSON.parse(w.localStorage.getItem('hc.scans')||'[]');
await ok('Scan requires pass choice; cancelling writes no log',async()=>{await scan('00123');assert.equal(d.getElementById('passId').textContent,'00123');assert.equal(logs().length,0);d.querySelector('[data-close=passSheet]').click();assert.equal(logs().length,0);});
await ok('All five pass types persist, with leading zero IDs intact',async()=>{for(const [i,p] of ['Nurse','Bathroom','Other class','Office','No pass'].entries()){await scan('000'+i);save(p);}assert.deepEqual(logs().map(s=>s.pass_type),['Nurse','Bathroom','Other class','Office','No pass']);assert.equal(logs()[0].id,'0000');assert.equal(logs()[4].referral_status,'draft');});
await ok('No-pass referral description contains incident facts and no invented consequence',async()=>{assert.match(d.getElementById('refText').value,/Student ID 0004/);assert.match(d.getElementById('refText').value,/without a hall pass/);assert.doesNotMatch(d.getElementById('refText').value,/detention|suspension/i);});
await ok('Duplicate protection covers nonconsecutive scans',async()=>{d.querySelector('[data-close=referralSheet]').click();await scan('0000');assert.match(d.getElementById('mainStatus').textContent,/Already logged/);assert.equal(logs().length,5);});
await ok('Barcode payload HTML and URLs are rejected',async()=>{await scan('<script>bad</script>');assert.match(d.getElementById('mainStatus').textContent,/does not look/);await scan('https://example.com');assert.equal(logs().length,5);});
await ok('CSV includes pass type and referral status',async()=>{d.getElementById('exportBtn').click();const csv=d.getElementById('dump').value;assert.match(csv,/pass_type,notes,referral_status/);assert.match(csv,/Office/);assert.match(csv,/No pass/);d.querySelector('[data-close=exportSheet]').click();});
await ok('Referral draft can be reopened from Today and saved without submission',async()=>{d.getElementById('statsBtn').click();d.querySelector('#statsBody button').click();d.getElementById('refFirst').value='Test';d.getElementById('refLast').value='Student';d.getElementById('refGrade').value='10';d.getElementById('refEmail').value='test@example.com';d.getElementById('saveReferral').click();assert.equal(logs()[4].student_first,'Test');assert.equal(logs()[4].referral_status,'draft');});
const {referralPayload,referralUrl,csvEscape}=require(path.join(root,'hall-core.js'));
await ok('Cognito payload matches published schema and allowed values',async()=>{const s={...logs()[4],period:'2nd'};const p=referralPayload(s);assert.equal(p.ClassPeriod,'2nd Period');assert.equal(p.FacultyStaffEmailAddress2,'test@example.com');assert.equal(p.StudentName.First,'Test');assert.equal(p.Grade,'10');assert.deepEqual(JSON.parse(new URL(referralUrl(s)).searchParams.get('entry')),p);assert.equal(referralPayload({...s,period:'Lunch'}).ClassPeriod,undefined);assert.equal(p.RecommendedConsequence,undefined);});
await ok('CSV escapes quotes, newlines, and spreadsheet formulas',async()=>{assert.equal(csvEscape('=1+1'),"'=1+1");assert.equal(csvEscape('one\rsecond'),'"one\rsecond"');assert.equal(csvEscape('a,"b"'),'"a,""b"""');});
const old={id:'900',date:'2026-09-01',time:'09:00:00',ts:'2026-09-01T14:00:00.000Z',period:'1st',window:'middle30'};
const oldDom=app({'hc.scans':[old],'hc.zone':'Original hall'});
await ok('Existing device logs and locations survive the upgrade',async()=>{assert.match(oldDom.window.document.getElementById('recentList').textContent,/900/);assert.equal(oldDom.window.document.getElementById('zoneLabel').textContent,'Original hall');});
oldDom.window.close();dom.window.close();
const ZX=require('@zxing/library'),Browser=require(path.join(root,'vendor/zxing-browser.min.js'));
for(const format of ['CODE128','CODE39'])for(const id of ['0012345678','A123-456'])await ok('Vendored camera decoder reads '+format+' '+id,async()=>{const output={};require('jsbarcode')(output,id,{format});const bits='0'.repeat(20)+output.encodings.map(e=>e.data).join('')+'0'.repeat(20);const width=bits.length*3,height=180;const pixels=new Uint8ClampedArray(width*height);for(let y=0;y<height;y++)for(let x=0;x<width;x++)pixels[y*width+x]=(y<10||y>169||bits[Math.floor(x/3)]==='0')?255:0;const bitmap=new ZX.BinaryBitmap(new ZX.HybridBinarizer(new ZX.RGBLuminanceSource(pixels,width,height)));assert.equal(new Browser.BrowserMultiFormatOneDReader().reader.decode(bitmap).getText(),id);});
await (async()=>{
  const cam=new JSDOM(html,{url:'https://hall.test',runScripts:'outside-only'}),cw=cam.window,cd=cw.document;
  cw.eval(core);Object.defineProperty(cw,'isSecureContext',{value:true});
  let resolve,stops=0;
  const track={stop:()=>stops++,addEventListener:()=>{},getCapabilities:()=>({}),getSettings:()=>({deviceId:'back'})};
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
  Object.defineProperty(cw.navigator,'mediaDevices',{value:{getUserMedia:()=>new Promise(r=>resolve=r),enumerateDevices:async()=>[]}});
  cw.ZXingBrowser={BrowserMultiFormatOneDReader:class{async decodeFromStream(){return {stop:()=>{}}}}};
  cw.eval(fs.readFileSync(path.join(root,'camera.js'),'utf8'));
  cd.getElementById('cameraStart').click();cd.getElementById('cameraStop').click();resolve(stream);await new Promise(r=>setImmediate(r));
  await ok('Late camera permission response releases camera after Stop',async()=>{assert.equal(stops,1);assert.equal(cd.getElementById('cameraStart').disabled,false);});
  cw.navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});};
  cd.getElementById('cameraStart').click();await new Promise(r=>setImmediate(r));
  await ok('Denied camera permission gives actionable recovery and leaves manual entry available',async()=>{assert.match(cd.getElementById('cameraStatus').textContent,/permission was denied/);assert.equal(cd.getElementById('cameraStart').disabled,false);assert.ok(cd.getElementById('wedge'));});
  cam.window.close();console.log(passed+' checks passed. Physical iPhone/Android camera tests remain necessary.');
})().catch(e=>{console.error(e);process.exitCode=1;});

})().catch(e=>{console.error(e);process.exitCode=1;});
