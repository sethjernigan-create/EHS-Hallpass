import {createRemoteJWKSet,jwtVerify} from 'jose';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export const sessionCookie='__Host-hall_session',challengeCookie='__Host-hall_nonce';
export function approved(email,env){return new Set((env.APPROVED_STAFF_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)).has(email);}
export function admin(email,env){return email===(env.ADMIN_EMAIL||'').toLowerCase();}
export function validateIdentity(p,env,nonce){
  const email=typeof p.email==='string'?p.email.toLowerCase():'';
  if(!p.sub||p.email_verified!==true||p.hd!=='estemschools.org'||!email.endsWith('@estemschools.org')||!approved(email,env)||p.nonce!==nonce)throw new Error('Account not approved');
  return {sub:p.sub,email};
}
export async function verifyGoogle(token,env,nonce,resolver=keys){
  const {payload}=await jwtVerify(token,resolver,{algorithms:['RS256'],audience:env.GOOGLE_CLIENT_ID,issuer:['https://accounts.google.com','accounts.google.com'],requiredClaims:['exp','iat','sub','email','email_verified','hd','nonce'],maxTokenAge:'10m',clockTolerance:5});
  return validateIdentity(payload,env,nonce);
}
export async function digest(value){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');}
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');}
export function cookie(name,value,age){return name+'='+value+'; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age='+age;}
export function cookies(request){const result={};for(const part of (request.headers.get('Cookie')||'').split(';')){const i=part.indexOf('=');if(i>0)result[part.slice(0,i).trim()]=part.slice(i+1).trim();}return result;}
export async function authenticate(request,env){const token=cookies(request)[sessionCookie];if(!/^[a-f0-9]{64}$/.test(token||''))return null;const row=await env.DB.prepare('SELECT google_sub AS sub, email, expires_at FROM staff_sessions WHERE token_hash = ? AND expires_at > ?').bind(await digest(token),Math.floor(Date.now()/1000)).first();if(!row||!approved(row.email,env))return null;return {...row,tokenHash:await digest(token),admin:admin(row.email,env)};}
