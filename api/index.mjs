import {readFile} from 'node:fs/promises';
import {constantEqual,makeSession,validSession,validateTemplate,templateHash,dayIST,verifyUnsubscribe,workWindow} from '../lib/core.mjs';
import {store} from '../lib/store.mjs';
import {connections,assertResearchReady,enqueue,work} from '../lib/worker.mjs';

const secure=()=>process.env.NODE_ENV==='production'||!!process.env.VERCEL;
function response(res,status,data){res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));}
async function body(req){if(req.body&&typeof req.body==='object')return req.body;let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)throw new Error('Request is too large.');}return JSON.parse(raw||'{}');}
function originOkay(req){if(!req.headers.origin)return false;try{const given=new URL(req.headers.origin);const expected=process.env.APP_ORIGIN?new URL(process.env.APP_ORIGIN).host:req.headers.host;return given.host===expected||given.host===req.headers.host;}catch{return false;}}
export default async function handler(req,res){
  const url=new URL(req.url,'http://localhost'),action=url.searchParams.get('action')||'status';
  try {
    if(action==='workspace'){
      if(req.method!=='GET')return response(res,405,{error:'Method not allowed.'});
      const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('smith_session='))?.slice(14);
      const signedIn=connections().login&&validSession(cookie||'',process.env.SESSION_SECRET);
      const page=await readFile(new URL(signedIn?'../views/dashboard.html':'../views/login.html',import.meta.url),'utf8');
      res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.end(page);return;
    }
    if(action==='unsubscribe'){
      const id=verifyUnsubscribe(url.searchParams.get('token'),process.env.SESSION_SECRET||'');if(!process.env.SESSION_SECRET||!id)return response(res,400,{error:'This unsubscribe link is invalid.'});
      if(req.method==='GET'){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end('<!doctype html><title>Unsubscribe — Sunrise Tech Origin</title><h1>Stop promotional emails?</h1><p>Confirm below to stop future outreach from Sunrise Tech Origin.</p><form method="POST"><button>Unsubscribe</button></form>');return;}
      if(req.method!=='POST')return response(res,405,{error:'Method not allowed.'});await store('unsubscribe',{id});return response(res,200,{message:'You are unsubscribed from Sunrise Tech Origin outreach.'});
    }
    if(action==='cron-start'||action==='cron-stop'||action==='worker'){
      const expected=action==='worker'?process.env.WORKER_SECRET:process.env.CRON_SECRET;const supplied=action==='worker'?req.headers['x-worker-secret']:req.headers.authorization?.replace(/^Bearer /,'');
      if(!expected||!constantEqual(supplied||'',expected))return response(res,401,{error:'Unauthorized.'});
      if(action==='worker'&&req.method!=='POST'||(action==='cron-start'||action==='cron-stop')&&req.method!=='GET')return response(res,405,{error:'Method not allowed.'});
      if(action==='cron-stop')return response(res,200,await store('stop',{day:dayIST()}));
      if(action==='cron-start'&&!workWindow().open)return response(res,200,{done:true,reason:'Outside the current IST day.'});
      assertResearchReady();if(action==='worker')return response(res,200,await work());
      const run=await store('start',{day:dayIST()});if(run.status==='Running')await enqueue();return response(res,200,{run});
    }
    if(action==='status')return response(res,200,{connections:connections(),brand:'Sunrise Tech Origin',sender:'info@sunrisetechorigin.com'});
    if(!connections().login)return response(res,503,{error:'Live workspace login is not configured. Use the labelled preview to review the interface.'});
    if(action==='login'){
      if(req.method!=='POST'||!originOkay(req))return response(res,403,{error:'Invalid request origin.'});const data=await body(req);
      // Use a high-entropy passphrase and Vercel firewall rate limiting at the edge.
      if(!constantEqual(String(data.username||''),process.env.ADMIN_USERNAME||'')||!constantEqual(String(data.password||''),process.env.ADMIN_PASSWORD))return response(res,401,{error:'Incorrect user ID or password.'});
      res.setHeader('Set-Cookie',`smith_session=${makeSession(process.env.SESSION_SECRET)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure()?'; Secure':''}`);return response(res,200,{ok:true});
    }
    const cookie=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('smith_session='))?.slice(14);
    if(!validSession(cookie||'',process.env.SESSION_SECRET))return response(res,401,{error:'Sign in to the live workspace.'});
    if(action==='snapshot'){const state=await store('snapshot');return response(res,200,{state,connections:connections(),sheetURL:process.env.GOOGLE_SHEET_URL||''});}
    if(req.method!=='POST'||!originOkay(req))return response(res,403,{error:'Invalid request origin.'});const data=await body(req);
    if(action==='logout'){res.setHeader('Set-Cookie','smith_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return response(res,200,{ok:true});}
    if(action==='save-template'){validateTemplate(data);return response(res,200,await store('template',{subject:data.subject,body:data.body}));}
    if(action==='approve-template'){const state=await store('snapshot');validateTemplate(state.template);if(data.hash!==templateHash(state.template))return response(res,409,{error:'Template changed. Review the latest version.'});return response(res,200,await store('approve',{hash:data.hash}));}
    if(action==='lead-update')return response(res,200,await store('lead-update',{id:String(data.id),owner:String(data.owner||''),remark:String(data.remark||''),status:String(data.status||'New'),nextFollowUp:String(data.nextFollowUp||'')}));
    if(action==='suppress-lead')return response(res,200,await store('unsubscribe',{id:String(data.id)}));
    if(action==='pause'){if(data.active)assertResearchReady();return response(res,200,await store('pause',{active:!!data.active}));}
    if(action==='save-settings'){if(!Array.isArray(data.cities)||!data.cities.every(x=>typeof x==='string'&&x.trim().length>0))throw new Error('Add valid city names.');return response(res,200,await store('settings',{cities:data.cities}));}
    if(action==='run'){if(!workWindow().open)throw new Error('Research is available all day.');assertResearchReady();const state=await store('snapshot');if(!state.settings.active)throw new Error('Enable research before starting a run.');const run=await store('start',{day:dayIST()});if(run.status==='Running')await enqueue();return response(res,200,{run});}
    return response(res,404,{error:'Operation not found.'});
  }catch(error){const message=String(error.message||'Request failed.').replace(/https?:\/\/[^\s]+/g,'[service]').slice(0,240);response(res,400,{error:message});}
}
