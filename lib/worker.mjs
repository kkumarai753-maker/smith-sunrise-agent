import {store} from './store.mjs';
import {dayIST,renderEmail,templateHash,unsubscribeToken,SENDER,validateTemplate,workWindow} from './core.mjs';
import {discover,inspect,screenshot} from './research.mjs';
import {apiFetch} from './safe-web.mjs';
import nodemailer from 'nodemailer';
import {companyAttachments} from './attachments.mjs';

export function connections(env=process.env) {
  return {login:!!(env.ADMIN_PASSWORD?.length>=16&&env.SESSION_SECRET?.length>=32),sheet:!!(env.SHEETS_WEBAPP_URL&&env.SHEETS_SECRET),search:!!env.BRAVE_SEARCH_API_KEY,ai:true,screenshots:!!env.BROWSERLESS_TOKEN,queue:!!(env.QSTASH_TOKEN&&env.WORKER_SECRET&&env.APP_ORIGIN),email:!!(env.SMTP_HOST&&env.SMTP_USER&&env.SMTP_PASSWORD),scheduler:!!env.CRON_SECRET,sending:env.SENDING_ENABLED==='true'};
}
export function assertResearchReady(env=process.env){const c=connections(env);const missing=['sheet','search','queue'].filter(k=>!c[k]);if(missing.length)throw new Error(`Finish these connections first: ${missing.join(', ')}.`);}
export async function enqueue(env=process.env,delay=3,dedupe=''){
  const next=workWindow(new Date(Date.now()+delay*1000));if(!next.open)return false;
  const origin=new URL(env.APP_ORIGIN);if(origin.protocol!=='https:')throw new Error('Worker origin must use HTTPS.');
  await apiFetch(`https://qstash.upstash.io/v2/publish/${origin.origin}/api/worker`,{method:'POST',headers:{Authorization:`Bearer ${env.QSTASH_TOKEN}`,'Content-Type':'application/json','Upstash-Forward-X-Worker-Secret':env.WORKER_SECRET,'Upstash-Delay':`${delay}s`,...(dedupe?{'Upstash-Deduplication-Id':dedupe}:{}),'Upstash-Retries':'3','Upstash-Timeout':'180s'},body:'{}'});
}
export async function work(env=process.env){
  const window=workWindow();
  if(!window.open){if(Date.now()>=window.end)await store('stop',{day:window.day},env);return {done:true,reason:'Outside the 06:00–07:30 IST work window.'};}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new Error('Daily work window ended.')),window.remainingMs);timer.unref?.();
  env={...env,WORK_SIGNAL:controller.signal};
  try {
  assertResearchReady(env);const snapshot=await store('snapshot',{},env);if(!snapshot.settings.active)return {done:true,reason:'Research paused.'};await store('start',{day:dayIST()},env);const canSend=env.RESEARCH_ONLY!=='false'?false:env.SENDING_ENABLED==='true'&&connections(env).email;
  const claim=await store('claim',{day:dayIST(),canSend,captureEvidence:env.RESEARCH_ONLY==='false'&&!!env.BROWSERLESS_TOKEN},env);if(claim.done){await nextDay(env);return {done:true};}if(claim.busy){await enqueue(env,250);return {busy:true};}
  const {job,token}=claim;let result={token},smtpStarted=false;
  try {
    if(job.kind==='discover')result={...result,...await discover(job.location,env)};
    if(job.kind==='inspect'){const lead=await inspect(job.candidate,env);result=lead.skip?{...result,skip:lead.skip}:{...result,lead};}
    if(job.kind==='evidence'){const bytes=await screenshot(job.lead.website,env);const evidence=await store('evidence-save',{id:job.lead.id,base64:bytes.toString('base64')},env);result={...result,leadId:job.lead.id,evidence:[evidence]};}
    if(job.kind==='send'){
      // Recheck current suppression and approval immediately before the side effect.
      const latest=await store('snapshot',{},env),lead=latest.leads.find(l=>l.id===job.lead.id);
      if(!workWindow().open)throw new Error('Daily work window ended.');
      if(!latest.settings.active||lead?.unsubscribed||latest.template.approvedHash!==templateHash(job.template)||!latest.template.autoSend)throw new Error('Sending paused, recipient opted out, or template approval changed.');
      if(env.SMTP_USER?.toLowerCase()!==SENDER)throw new Error('Sender must be info@sunrisetechorigin.com.');
      validateTemplate(job.template);
      const optout=`${new URL(env.APP_ORIGIN).origin}/api/index?action=unsubscribe&token=${encodeURIComponent(unsubscribeToken(lead.id,env.SESSION_SECRET))}`;
      const message=renderEmail(job.template,lead,optout),transport=nodemailer.createTransport({host:env.SMTP_HOST,port:Number(env.SMTP_PORT||465),secure:Number(env.SMTP_PORT||465)===465,requireTLS:true,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000});
      const pictures=await companyAttachments();
      const cancelSend=()=>transport.close();controller.signal.addEventListener('abort',cancelSend,{once:true});
      if(!workWindow().open){controller.signal.removeEventListener('abort',cancelSend);transport.close();throw new Error('Daily work window ended.');}
      smtpStarted=true;let sent;try{sent=await transport.sendMail({from:`Sunrise Tech Origin <${SENDER}>`,to:lead.email,subject:message.subject,text:message.text,messageId:`<smith-${lead.id}-${job.template.version}@sunrisetechorigin.com>`,headers:{'List-Unsubscribe':`<${optout}>`},attachments:pictures});}finally{controller.signal.removeEventListener('abort',cancelSend);transport.close();}
      result={...result,leadId:lead.id,messageId:sent.messageId,templateHash:templateHash(job.template)};
    }
  }catch(error){result={token,leadId:job.lead?.id,error:failureMessage(error),uncertain:smtpStarted,cutoff:!workWindow().open};}
  // Never retry a successful SMTP side effect if this persistence call fails.
  const finish=await store('finish',result,env);if(finish.continue&&workWindow().open)await enqueue(env,job.kind==='send'?30:3);else if(result.cutoff)await enqueue(env,3);else await nextDay(env);return {stage:job.kind,...finish};
  } finally {clearTimeout(timer);}
}
function failureMessage(error){const text=String(error.message||'Worker failed.');return text.replace(/https?:\/\/[^\s]+/g,'[service]').replace(/Bearer\s+\S+/gi,'[redacted]').slice(0,220);}

async function nextDay(env){
  const state=await store('snapshot',{},env);if(!state.settings.active)return;
  const end=workWindow().end,delay=Math.max(1,Math.ceil((end-Date.now())/1000)+2);
  await enqueue(env,delay,`smith-next-day-${end}`);
}
