import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {generateKeyPair,exportJWK,createLocalJWKSet,SignJWT} from 'jose';
import {verifyGoogle,digest,sessionCookie} from '../server/auth.mjs';
import {createHandler} from '../server/worker.mjs';
const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')))sql.exec(fs.readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
class Statement{constructor(q,args=[]){this.q=q;this.args=args;}bind(...args){return new Statement(this.q,args);}async first(){return sql.prepare(this.q).get(...this.args)||null;}async run(){return sql.prepare(this.q).run(...this.args);}}
const DB={prepare:q=>new Statement(q),batch:async ss=>{sql.exec('BEGIN');try{const out=[];for(const s of ss)out.push(await s.run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={DB,APP_ORIGIN:'https://hall.test',GOOGLE_CLIENT_ID:'test-client',APPROVED_STAFF_EMAILS:'admin-test@estemschools.org,staff-test@estemschools.org',ADMIN_EMAIL:'admin-test@estemschools.org'};
const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='test';const resolver=createLocalJWKSet({keys:[jwk]});
const claims={sub:'admin-1',email:env.ADMIN_EMAIL,email_verified:true,hd:'estemschools.org',nonce:'test-nonce'};
async function token(overrides={}){return new SignJWT({...claims,...overrides}).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuedAt().setIssuer('https://accounts.google.com').setAudience(env.GOOGLE_CLIENT_ID).setExpirationTime('5m').sign(privateKey);}
assert.equal((await verifyGoogle(await token(),env,'test-nonce',resolver)).email,env.ADMIN_EMAIL);
// Exercise signed but unauthorized tokens, independently of malformed-token rejection.
for(const change of [{email:'unapproved@estemschools.org'},{email_verified:false},{hd:'other.org'},{nonce:'wrong'}]){const signed=await token(change);await assert.rejects(()=>verifyGoogle(signed,env,'test-nonce',resolver));}
await assert.rejects(()=>verifyGoogle('forged',env,'test-nonce',resolver));
const good=await token();await assert.rejects(()=>verifyGoogle(good,{...env,GOOGLE_CLIENT_ID:'wrong'},'test-nonce',resolver));
const expired=await new SignJWT(claims).setProtectedHeader({alg:'RS256',kid:'test'}).setIssuedAt(1).setIssuer('https://accounts.google.com').setAudience(env.GOOGLE_CLIENT_ID).setExpirationTime(2).sign(privateKey);await assert.rejects(()=>verifyGoogle(expired,env,'test-nonce',resolver));
const handle=createHandler((t,e,n)=>verifyGoogle(t,e,n,resolver));
async function call(path,data,cookie='',origin=env.APP_ORIGIN,headers={}){return handle(new Request(env.APP_ORIGIN+path,{method:data===undefined?'GET':'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json',...headers},body:data===undefined?undefined:JSON.stringify(data)}),env);}
assert.equal((await call('/api/students/lookup',{id:'001'})).status,401);
assert.equal((await call('/api/roster/status')).status,401);
assert.equal((await call('/api/auth/challenge',{},'','https://evil.test')).status,403);
async function login(email=env.ADMIN_EMAIL){const r=await call('/api/auth/challenge',{});const {nonce}=await r.json();const cookie=r.headers.get('set-cookie').split(';')[0];const credential=await token({nonce,email,sub:email});const body={nonce,credential};const signed=await call('/api/auth/login',body,cookie);assert.equal(signed.status,200);assert.equal((await call('/api/auth/login',body,cookie)).status,403);return signed.headers.getSetCookie().find(s=>s.startsWith(sessionCookie+'=')).split(';')[0];}
const adminCookie=await login(),staffCookie=await login('staff-test@estemschools.org');
const students=[{id:'001',first:'Synthetic',last:'Student',grade:'10'}];
assert.equal((await call('/api/roster/import',{students},staffCookie)).status,403);
assert.equal((await call('/api/roster/import',{students},adminCookie,'https://evil.test')).status,403);
env.ROSTER_BOOTSTRAP_HASH=await digest('one-time-test');env.ROSTER_BOOTSTRAP_EXPIRES=String(Math.floor(Date.now()/1000)+60);
assert.equal((await call('/api/admin/bootstrap',{students},'',env.APP_ORIGIN,{Authorization:'Bearer wrong'})).status,403);
assert.equal((await call('/api/admin/bootstrap',{students},'',env.APP_ORIGIN,{Authorization:'Bearer one-time-test'})).status,200);
assert.equal((await call('/api/admin/bootstrap',{students},'',env.APP_ORIGIN,{Authorization:'Bearer one-time-test'})).status,409);
const found=await call('/api/students/lookup',{id:'001'},staffCookie);assert.equal(found.headers.get('cache-control'),'no-store');assert.deepEqual((await found.json()).student,students[0]);
assert.equal((await (await call('/api/students/lookup',{id:'999'},staffCookie)).json()).student,null);
assert.equal((await call('/api/roster/import',{students:[...students,...students]},adminCookie)).status,400);
assert.equal((await (await call('/api/roster/status',undefined,staffCookie)).json()).count,1);
assert.equal((await call('/api/students/lookup',{id:"001' OR 1=1"},staffCookie)).status,400);
for(const path of ['/server/auth.mjs','/.env','/.git/config','/db/schema.ts','/students.csv'])assert.equal((await call(path)).status,404);
env.APPROVED_STAFF_EMAILS=env.ADMIN_EMAIL;assert.equal((await call('/api/students/lookup',{id:'001'},staffCookie)).status,401);
await call('/api/auth/logout',{},adminCookie);assert.equal((await call('/api/students/lookup',{id:'001'},adminCookie)).status,401);
sql.close();console.log('PASS signed Google identity checks, staff allowlist, challenge replay, CSRF, private lookup, admin import, atomic validation, bootstrap replay, revocation, logout, and static file isolation.');
