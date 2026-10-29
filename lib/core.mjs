import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const BRAND = 'Sunrise Tech Origin';
export const SENDER = 'info@sunrisetechorigin.com';
export const DEFAULT_TEMPLATE = {
  subject: "A brighter digital presence for your business",
  body: "Hello Sir/Ma’am,\n\nWe’re Sunrise Tech Origin, a tech solutions and social media marketing agency. We help businesses grow online with professional websites, regular social media content and SEO—at reasonable rates.\n\nPlease see the attached pictures for a quick introduction to our services. May we arrange a short call to discuss your business goals?\n\nSunrise Tech Origin\n+91 8766803990 | info@sunrisetechorigin.com | sunrisetechorigin.com\n\nNot interested? Unsubscribe: {{unsubscribe}}",
  version: 2, outreachVersion: 2, approvedHash: "", approvedAt: "", autoSend: false
};
export const CATEGORIES = ['Health & wellness', 'Education', 'FMCG', 'IT & technology', 'Travel & hospitality', 'Manufacturing', 'Professional services'];
export function initialState() {
  return { leads: [], runs: [], events: [], candidates: [], seen: [], sequence: 0,
    settings: { dailyTarget: 30, active: false, cities: ['Nagpur', 'Pune', 'Mumbai', 'Hyderabad', 'Bengaluru', 'Delhi'], zones: ['East', 'West', 'North', 'South'], categories: CATEGORIES, maxQueries: 40, maxCandidates: 240 },
    planner: { cityIndex: 0, zoneIndex: 0, categoryIndex: 0, offset: 0, completed: [], cycle: 1 }, template: {...DEFAULT_TEMPLATE} };
}
export function dayIST(date = new Date()) { return new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Kolkata', year:'numeric',month:'2-digit',day:'2-digit'}).format(date); }
export function workWindow(date = new Date()) {
  const day=dayIST(date),start=Date.parse(`${day}T00:00:00+05:30`),end=start+86400000,now=date.getTime();
  return {day,start,end,open:now>=start&&now<end,remainingMs:Math.max(0,end-now)};
}
export function normalizeDomain(value = '') {
  try { return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, ''); } catch { return ''; }
}
export function normalizeEmail(value = '') { return String(value).trim().toLowerCase(); }
export function normalizePhone(value = '') { let n=String(value).replace(/\D/g,''); if(n.length===10)n='91'+n; return n; }
export function normalizeName(value='') { return value.toLowerCase().replace(/\b(pvt|private|limited|ltd|llp)\b/g,'').replace(/[^a-z0-9]/g,''); }
export function duplicate(a,b) {
  return ['website','email','phone'].some(key=>{ const fn=key==='website'?normalizeDomain:key==='email'?normalizeEmail:normalizePhone;const x=fn(a[key]),y=fn(b[key]);return x&&y&&x===y; }) || (!!normalizeName(a.business)&&normalizeName(a.business)===normalizeName(b.business)&&a.city?.toLowerCase()===b.city?.toLowerCase());
}
export function leadId(n) { return `STO${String(n).padStart(2,'0')}`; }
export function safeCell(value) { const s=String(value??'');return /^[=+\-@\t\r]/.test(s)?`'${s}`:s; }
export function csv(rows) { return rows.map(row=>row.map(v=>`"${safeCell(v).replaceAll('"','""')}"`).join(',')).join('\r\n'); }
export function templateHash(t) { return createHash('sha256').update(JSON.stringify({subject:t.subject,body:t.body})).digest('hex'); }
export function validateTemplate(t) {
  if(typeof t.subject!=='string'||typeof t.body!=='string'||t.subject.length>180||t.body.length>5000||!t.subject.trim()||!t.body.trim())throw new Error('Use a subject under 180 characters and a body under 5,000 characters.');
  if(/[\r\n]/.test(t.subject))throw new Error('Subject must be one line.');
  const allowed=['business','greeting','unsubscribe'];
  for(const match of (t.subject+t.body).matchAll(/\{\{(.*?)\}\}/g))if(!allowed.includes(match[1]))throw new Error(`Unknown placeholder: ${match[1]}`);
  if(!t.body.includes('{{unsubscribe}}'))throw new Error('Keep the unsubscribe placeholder.');
}
export function renderEmail(template, lead, unsubscribeUrl='[Unsubscribe link added securely when sent]') {
  const fields={business:lead.business,greeting:'Sir/Ma’am',unsubscribe:unsubscribeUrl};
  const render=text=>text.replace(/\{\{(\w+)\}\}/g,(_,key)=>String(fields[key]||''));
  return {subject:render(template.subject).replace(/[\r\n]/g,' '),text:render(template.body)};
}
export function potentialScore({fit=0,findings=[],email='',phone='',active=false}) {
  const points={fit:Math.max(0,Math.min(3,Math.round(fit))),need:Math.min(3,findings.filter(f=>f.verified).length),activity:active?2:0,contact:(email?1:0)+(phone?1:0)};
  return {value:Object.values(points).reduce((a,b)=>a+b,0),reason:`Service fit ${points.fit}/3 · evidenced need ${points.need}/3 · activity ${points.activity}/2 · contact availability ${points.contact}/2`};
}
export function currentLocation(state) {const p=state.planner,s=state.settings; return {city:s.cities[p.cityIndex],zone:s.zones[p.zoneIndex],category:s.categories[p.categoryIndex],offset:p.offset};}
export function advancePlanner(state) {
  const p=state.planner,s=state.settings;p.offset=0;p.categoryIndex++;
  if(p.categoryIndex>=s.categories.length){p.categoryIndex=0;p.completed.push(`${s.cities[p.cityIndex]}:${s.zones[p.zoneIndex]}:${p.cycle}`);p.zoneIndex++;}
  if(p.zoneIndex>=s.zones.length){p.zoneIndex=0;p.cityIndex++;}
  if(p.cityIndex>=s.cities.length){p.cityIndex=0;p.cycle++;}
}
export function constantEqual(a='',b='') { const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y); }
export function sign(value,secret) {return createHmac('sha256',secret).update(value).digest('base64url');}
export function makeSession(secret,now=Date.now()) {const payload=Buffer.from(JSON.stringify({exp:now+8*60*60*1000})).toString('base64url');return `${payload}.${sign(payload,secret)}`;}
export function validSession(token,secret,now=Date.now()) {try{const[p,s]=token.split('.');return constantEqual(s,sign(p,secret))&&JSON.parse(Buffer.from(p,'base64url')).exp>now;}catch{return false;}}
export function unsubscribeToken(id,secret) { return `${id}.${sign(`unsubscribe:${id}`,secret)}`; }
export function verifyUnsubscribe(token,secret) {const [id,s]=String(token).split('.');return id&&s&&constantEqual(s,sign(`unsubscribe:${id}`,secret))?id:null;}
