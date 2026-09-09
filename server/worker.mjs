import {verifyGoogle,authenticate,digest,randomToken,cookie,cookies,sessionCookie,challengeCookie,admin} from './auth.mjs';
import RosterCore from '../roster-core.js';
import assets from './assets.generated.mjs';
class RequestError extends Error{constructor(status,message){super(message);this.status=status;}}
const now=()=>Math.floor(Date.now()/1000);
function reply(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});}
function sameOrigin(request,env){if(request.headers.get('Origin')!==env.APP_ORIGIN)throw new RequestError(403,'Request origin is not allowed.');}
async function body(request,limit=18000){if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))throw new RequestError(415,'Use a JSON request.');if(Number(request.headers.get('Content-Length')||0)>limit)throw new RequestError(413,'Request is too large.');const reader=request.body?.getReader();if(!reader)throw new RequestError(400,'Missing request body.');let size=0,chunks=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>limit){await reader.cancel();throw new RequestError(413,'Request is too large.');}chunks.push(part.value);}const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}try{return JSON.parse(new TextDecoder().decode(all));}catch{throw new RequestError(400,'Invalid JSON.');}}
async function rateLimit(env,scope,identifier,max){const key=scope+':'+await digest(identifier)+':'+Math.floor(now()/60);const r=await env.DB.prepare('INSERT INTO request_limits (bucket_key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET hits = hits + 1 RETURNING hits').bind(key,now()+120).first();if(r.hits>max)throw new RequestError(429,'Too many requests. Wait a minute and try again.');}
async function saveRoster(env,students,bootstrap=false){
  const rows=RosterCore.validateStudents(students),statements=[];
  if(bootstrap)statements.push(env.DB.prepare("INSERT INTO school_settings (key,value) VALUES ('bootstrap_consumed','1')"));
  statements.push(env.DB.prepare('DELETE FROM school_roster'));
  for(let i=0;i<rows.length;i+=25){const chunk=rows.slice(i,i+25);statements.push(env.DB.prepare('INSERT INTO school_roster (id,first_name,last_name,grade) VALUES '+chunk.map(()=>'(?,?,?,?)').join(',')).bind(...chunk.flatMap(s=>[s.id,s.first,s.last,s.grade])));}
  statements.push(env.DB.prepare("INSERT INTO school_settings (key,value) VALUES ('roster_updated_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(new Date().toISOString()));
  await env.DB.batch(statements);return rows.length;
}
export function createHandler(verify=verifyGoogle){return async function handle(request,env,ctx={waitUntil:()=>{}}){
  const url=new URL(request.url),p=url.pathname;
  try{
    if(p.startsWith('/api/')){
      if(!env.DB||!env.GOOGLE_CLIENT_ID||!env.APP_ORIGIN)throw new RequestError(503,'Staff sign-in is being configured. Please try again shortly.');
      if(p==='/api/auth/config'&&request.method==='GET')return reply({clientId:env.GOOGLE_CLIENT_ID});
      if(p==='/api/admin/bootstrap'&&request.method==='POST'){
        const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
        if(!env.ROSTER_BOOTSTRAP_HASH||!token||!Number.isFinite(Number(env.ROSTER_BOOTSTRAP_EXPIRES))||now()>Number(env.ROSTER_BOOTSTRAP_EXPIRES)||await digest(token)!==env.ROSTER_BOOTSTRAP_HASH)throw new RequestError(403,'Not authorized.');
        const consumed=await env.DB.prepare("SELECT value FROM school_settings WHERE key='bootstrap_consumed'").first();if(consumed)throw new RequestError(409,'Initial roster has already been loaded.');
        const b=await body(request,4*1024*1024);let count;try{count=await saveRoster(env,b.students,true);}catch(e){throw new RequestError(400,'Roster was not imported. Check the data or whether initialization has already completed.');}return reply({count});
      }
      if(request.method!=='GET')sameOrigin(request,env);
      if(p==='/api/auth/challenge'&&request.method==='POST'){
        await rateLimit(env,'challenge',request.headers.get('CF-Connecting-IP')||'unknown',20);
        const nonce=randomToken();await env.DB.prepare('INSERT INTO auth_challenges (nonce_hash,expires_at) VALUES (?,?)').bind(await digest(nonce),now()+600).run();
        ctx.waitUntil(env.DB.batch([env.DB.prepare('DELETE FROM auth_challenges WHERE expires_at < ?').bind(now()),env.DB.prepare('DELETE FROM staff_sessions WHERE expires_at < ?').bind(now()),env.DB.prepare('DELETE FROM request_limits WHERE expires_at < ?').bind(now())]));
        return reply({nonce},200,{'Set-Cookie':cookie(challengeCookie,nonce,600)});
      }
      if(p==='/api/auth/login'&&request.method==='POST'){
        await rateLimit(env,'login',request.headers.get('CF-Connecting-IP')||'unknown',15);
        const b=await body(request),nonce=cookies(request)[challengeCookie];if(!nonce||b.nonce!==nonce||!b.credential)throw new RequestError(403,'Sign-in request expired. Reload and try again.');
        const challenge=await env.DB.prepare('SELECT nonce_hash FROM auth_challenges WHERE nonce_hash = ? AND expires_at > ?').bind(await digest(nonce),now()).first();if(!challenge)throw new RequestError(403,'Sign-in request expired. Reload and try again.');
        let who;try{who=await verify(b.credential,env,nonce);}catch(e){throw new RequestError(403,'This account is not approved, or Google sign-in expired. Use an approved school staff account.');}
        const claimed=await env.DB.prepare('DELETE FROM auth_challenges WHERE nonce_hash = ? AND expires_at > ? RETURNING nonce_hash').bind(await digest(nonce),now()).first();if(!claimed)throw new RequestError(403,'Sign-in request already used. Reload and try again.');
        const token=randomToken();await env.DB.prepare('INSERT INTO staff_sessions (token_hash,google_sub,email,expires_at) VALUES (?,?,?,?)').bind(await digest(token),who.sub,who.email,now()+12*3600).run();
        const response=reply({email:who.email,admin:admin(who.email,env)});response.headers.append('Set-Cookie',cookie(sessionCookie,token,12*3600));response.headers.append('Set-Cookie',cookie(challengeCookie,'',0));return response;
      }
      if(p==='/api/auth/logout'&&request.method==='POST'){
        const token=cookies(request)[sessionCookie];if(token)await env.DB.prepare('DELETE FROM staff_sessions WHERE token_hash = ?').bind(await digest(token)).run();return reply({ok:true},200,{'Set-Cookie':cookie(sessionCookie,'',0)});
      }
      const who=await authenticate(request,env);if(!who)throw new RequestError(401,'Sign in with an approved staff account.');
      if(p==='/api/auth/session'&&request.method==='GET')return reply({email:who.email,admin:who.admin});
      if(p==='/api/roster/status'&&request.method==='GET'){const r=await env.DB.prepare('SELECT COUNT(*) AS count FROM school_roster').first();const updated=await env.DB.prepare("SELECT value FROM school_settings WHERE key='roster_updated_at'").first();return reply({count:r.count,updatedAt:updated?.value||null});}
      if(p==='/api/students/lookup'&&request.method==='POST'){
        await rateLimit(env,'lookup',who.sub,120);const b=await body(request,2000);if(typeof b.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(b.id))throw new RequestError(400,'Invalid student ID.');
        const student=await env.DB.prepare('SELECT id,first_name AS first,last_name AS last,grade FROM school_roster WHERE id = ?').bind(b.id).first();return reply({student:student||null});
      }
      if(p==='/api/roster/import'&&request.method==='POST'){
        if(!who.admin)throw new RequestError(403,'Only the roster administrator can replace the roster.');await rateLimit(env,'import',who.sub,3);const b=await body(request,4*1024*1024);let rows;try{rows=RosterCore.validateStudents(b.students);}catch(e){throw new RequestError(400,e.message);}return reply({count:await saveRoster(env,rows)});
      }
      throw new RequestError(404,'Not found.');
    }
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    const item=assets[p==='/'?'/index.html':p];if(!item)return new Response('Not found',{status:404});
    const data=item.base64?Uint8Array.from(atob(item.data),c=>c.charCodeAt(0)):item.data;
    return new Response(request.method==='HEAD'?null:data,{headers:{'Content-Type':item.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cross-Origin-Opener-Policy':'same-origin-allow-popups','Permissions-Policy':'camera=(self), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; frame-src https://accounts.google.com; connect-src 'self' https://accounts.google.com; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"}});
  }catch(e){if(e instanceof RequestError)return reply({error:e.message},e.status);console.error('Hall service error',e?.name||'Error');return reply({error:'The staff service is unavailable. Please try again.'},503);}
};}
export default {fetch:createHandler()};
