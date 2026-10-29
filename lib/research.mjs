import {fetchWebsite,apiFetch,publicURL} from './safe-web.mjs';
import {normalizePhone,normalizeEmail} from './core.mjs';
const strip=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
export function extractContacts(html) {
  const emails=[...new Set((html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)||[]).map(normalizeEmail))].filter(x=>!/@(example\.|sentry\.|wixpress\.)/.test(x)&&!/[.](png|jpg|webp|svg)$/i.test(x));
  const tel=[...html.matchAll(/href\s*=\s*["']tel:([^"']+)/gi)].map(m=>m[1]);
  const visible=strip(html).match(/(?:\+91[\s.-]*)?[6-9]\d{4}[\s.-]*\d{5}\b/g)||[];
  const phones=[...new Set([...tel,...visible].map(normalizePhone))].filter(x=>x.length>=10&&x.length<=15);
  return {email:emails[0]||'',phone:phones[0]||''};
}
export function staticFindings(html,url,status=200) {
  const out=[];const add=(code,title,detail)=>out.push({code,title,detail,url,verified:true,method:'HTML inspection',checkedAt:new Date().toISOString()});
  if(status>=400)add('http-error',`The page returned HTTP ${status}`,'Observed on this request; may be temporary.');
  if(!/<title\b[^>]*>\s*[^<\s]/i.test(html))add('title','Page title was missing in the returned HTML','A descriptive page title can help users and search engines understand the page.');
  if(!/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html))add('viewport','Mobile viewport declaration was not found','Review mobile behaviour; this alone does not prove a broken mobile layout.');
  if(!/<meta\b[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["'][^"']+/i.test(html)&&!/<meta\b[^>]*content\s*=\s*["'][^"']+["'][^>]*name\s*=\s*["']description/i.test(html))add('description','Meta description was not found in the returned HTML','A useful page description can support search result presentation.');
  if(!/<h1\b[^>]*>\s*\S/i.test(html))add('heading','A main H1 heading was not found in the returned HTML','Review the main service heading. JavaScript-rendered content may differ.');
  if(url.startsWith('http:'))add('https','The inspected page used HTTP','Review HTTPS availability before recommending a migration.');
  return out;
}
export async function discover(location,env) {
  if(env.SEARCH_STORAGE_RIGHTS_CONFIRMED!=='true')throw new Error('Confirm search-provider storage rights before enabling discovery.');
  const q=`${location.category} businesses ${location.zone} ${location.city} India official website contact -site:justdial.com -site:indiamart.com -site:facebook.com -site:linkedin.com`;
  const url=new URL('https://api.search.brave.com/res/v1/web/search');url.search=new URLSearchParams({q,count:'10',offset:String(location.offset),country:'IN',search_lang:'en'}).toString();
  const data=await (await apiFetch(url,{signal:env.WORK_SIGNAL,headers:{'X-Subscription-Token':env.BRAVE_SEARCH_API_KEY}})).json();
  const blocked=/(^|\.)(justdial|indiamart|facebook|instagram|linkedin|youtube|wikipedia|tradeindia|google)\./i;
  return {items:(data.web?.results||[]).filter(x=>{try{return !blocked.test(new URL(x.url).hostname);}catch{return false;}}).map(x=>({website:x.url,title:x.title,...location})),more:data.query?.more_results_available===true};
}
export async function inspect(candidate,env) {
  const page=await fetchWebsite(candidate.website,0,env.WORK_SIGNAL);const contacts=extractContacts(page.html);let contactSource=page.url;
  if(!contacts.email||!contacts.phone){
    const links=[...page.html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(m=>{try{return new URL(m[1],page.url);}catch{return null;}}).filter(u=>u&&u.origin===new URL(page.url).origin&&/contact|about/i.test(u.pathname)).slice(0,2);
    for(const url of links){try{const extra=extractContacts((await fetchWebsite(url.href,0,env.WORK_SIGNAL)).html);if(extra.email||extra.phone)contactSource=url.href;contacts.email||=extra.email;contacts.phone||=extra.phone;}catch{}if(contacts.email&&contacts.phone)break;}
  }
  const findings=staticFindings(page.html,page.url,page.status);
  const ai=classifyBusiness(page.html,candidate);
  if(!ai.categoryMatch||!ai.locationMatch||!ai.business||ai.fit<1)return {skip:'Business category or city could not be confirmed.'};
  if(ai.person&&!strip(page.html).toLowerCase().includes(ai.person.toLowerCase()))ai.person='';
  const value=(ai.categoryMatch?3:0)+(ai.locationMatch?2:0)+Math.min(3,findings.length)+(contacts.email?1:0)+(contacts.phone?1:0);
  const score={value,reason:'Rules: category match /3, city text match /2, HTML improvement signals /3, public contacts /2. Service fit only; budget and buying intent unverified.'};
  return {...candidate,business:ai.business,person:ai.person,...contacts,website:page.url,source:page.url,contactSource,cityVerified:true,zoneVerified:false,findings,score:score.value,scoreReason:score.reason,summary:ai.summary,evidence:[],emailStatus:'Draft',status:'New',owner:'',remark:'',createdAt:new Date().toISOString(),eligible:!!contacts.email&&!!contacts.phone};
}
export async function screenshot(website,env) {
  await publicURL(website);
  const response=await apiFetch(`https://production-sfo.browserless.io/screenshot?token=${encodeURIComponent(env.BROWSERLESS_TOKEN)}`,{method:'POST',signal:env.WORK_SIGNAL,headers:{'Content-Type':'application/json'},body:JSON.stringify({url:website,options:{type:'png',fullPage:false},viewport:{width:390,height:844,deviceScaleFactor:1},gotoOptions:{waitUntil:'domcontentloaded',timeout:12000}})},18000);
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>2500000)throw new Error('Screenshot is too large.');return bytes;
}

const CATEGORY_WORDS={
  'Health & wellness':['hospital','clinic','dental','fitness','wellness','gym'],
  'Education':['school','college','academy','training','education','coaching'],
  'FMCG':['consumer goods','food','beverage','grocery'],
  'IT & technology':['software','technology','information technology','it services'],
  'Travel & hospitality':['hotel','travel','tourism','resort','restaurant'],
  'Manufacturing':['manufacturing','manufacturer','factory','industrial'],
  'Professional services':['consulting','consultant','accountant','legal','architect','agency']
};
export function classifyBusiness(html,candidate){
  const text=strip(html);
  const words=CATEGORY_WORDS[candidate.category]||[candidate.category];
  const has=word=>new RegExp('\\b'+String(word).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(text);
  const categoryMatch=words.some(has),locationMatch=has(candidate.city);
  const meta=html.match(/<meta\b[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)/i);
  const title=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const business=strip(meta?.[1]||title?.[1]||'').split(/\s[|–—]\s/)[0].slice(0,150);
  return {business,person:'',fit:categoryMatch?2:0,categoryMatch,locationMatch,
    active:false,summary:'Rule-based service-fit estimate from website text; activity, buying intent and budget are unverified.'};
}
