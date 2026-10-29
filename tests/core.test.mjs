import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {duplicate,leadId,initialState,advancePlanner,currentLocation,dayIST,templateHash,DEFAULT_TEMPLATE,workWindow,validateTemplate,renderEmail,makeSession,validSession,unsubscribeToken,verifyUnsubscribe,csv} from '../lib/core.mjs';
import {isPublicIP,publicURL} from '../lib/safe-web.mjs';
import {extractContacts,staticFindings} from '../lib/research.mjs';

test('contact deduplication normalizes websites, Indian phones and email',()=>{
 assert.ok(duplicate({website:'https://www.acme.in/about'},{website:'http://acme.in/'}));
 assert.ok(duplicate({phone:'98765 43210'},{phone:'+91-9876543210'}));
 assert.ok(duplicate({email:'Info@Acme.in'},{email:'info@acme.in'}));
 assert.equal(duplicate({business:'Acme',city:'Pune'},{business:'Other',city:'Pune'}),false);
 assert.equal(duplicate({},{ }),false);assert.equal(leadId(1),'STO01');assert.equal(leadId(100),'STO100');
});
test('city/zone cursor carries across categories and rotates deterministically',()=>{const s=initialState();for(let i=0;i<7;i++)advancePlanner(s);assert.equal(currentLocation(s).zone,'West');for(let i=0;i<21;i++)advancePlanner(s);assert.equal(currentLocation(s).city,'Pune');assert.equal(currentLocation(s).zone,'East');});
test('6 AM schedule uses IST date even before UTC midnight',()=>{assert.equal(dayIST(new Date('2026-10-29T20:00:00Z')),'2026-10-30');});
test('short introduction excludes audit findings, long names and website assumptions',()=>{
 validateTemplate(DEFAULT_TEMPLATE);assert.notEqual(templateHash(DEFAULT_TEMPLATE),templateHash({...DEFAULT_TEMPLATE,body:DEFAULT_TEMPLATE.body+'x'}));assert.throws(()=>validateTemplate({...DEFAULT_TEMPLATE,body:'Hello'}));
 const email=renderEmail(DEFAULT_TEMPLATE,{business:'Acme',findings:[{title:'Observed problem',url:'https://acme.in',verified:true},{title:'Invented claim',verified:false}],evidence:[]});assert.match(email.text,/^Hello Sir\/Ma’am,/);assert.doesNotMatch(email.text,/Observed problem|Invented claim|Acme|reviewing|screenshots/i);assert.ok(email.text.split(/\s+/).length<100);assert.throws(()=>validateTemplate({...DEFAULT_TEMPLATE,body:'{{findings}} {{unsubscribe}}'}));const noWebsite=renderEmail(DEFAULT_TEMPLATE,{business:'An extremely long business legal name',website:''});assert.equal(noWebsite.text,email.text);
});
test('sessions and unsubscribe tokens cannot be tampered with',()=>{const secret='x'.repeat(40),session=makeSession(secret,100);assert.ok(validSession(session,secret,101));assert.equal(validSession(session+'x',secret,101),false);assert.equal(validSession(session,secret,9e9),false);const token=unsubscribeToken('STO01',secret);assert.equal(verifyUnsubscribe(token,secret),'STO01');assert.equal(verifyUnsubscribe(token.replace('01','02'),secret),null);});
test('website audit rejects private networks, credentials and reserved ranges',async()=>{for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','172.16.0.1','100.64.0.1','::1','::ffff:127.0.0.1','2001:db8::1'])assert.equal(isPublicIP(ip),false,ip);assert.ok(isPublicIP('8.8.8.8'));await assert.rejects(publicURL('http://127.0.0.1/'));await assert.rejects(publicURL('https://u:p@google.com'));});
test('contact extraction and static findings preserve observable limits',()=>{const html='<title>Acme</title><meta name="viewport" content="width=device-width"><h1>Services</h1><a href="mailto:Info@acme.in">Email</a><a href="tel:+919876543210">Call</a>';assert.deepEqual(extractContacts(html),{email:'info@acme.in',phone:'919876543210'});const f=staticFindings(html,'https://acme.in');assert.equal(f.length,1);assert.equal(f[0].code,'description');});
test('CSV neutralises formulas and escapes quotes',()=>{assert.equal(csv([['=HYPERLINK("bad")','ordinary']]),'"\'=HYPERLINK(""bad"")","ordinary"');});

const script=await readFile(new URL('../google-apps-script/Code.gs',import.meta.url),'utf8');
const context=vm.createContext({console,Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_algorithm,input)=>[...crypto.createHash('sha256').update(input).digest()]}});vm.runInContext(script,context);
const actionAt=context.action_;
const normalTime=()=>Date.parse(`${dayIST()}T06:30:00+05:30`);
context.action_=(s,a,p)=>actionAt(s,a,p,normalTime());
test('daily starts are idempotent and 30-lead target survives worker retries',()=>{
 const s=initialState();s.settings.active=true;const act=(a,p={})=>context.action_(s,a,p);const run=act('start',{day:dayIST()});assert.equal(act('start',{day:dayIST()}).id,run.id);assert.equal(s.runs.length,1);
 let claim=act('claim',{day:dayIST()});assert.equal(claim.job.kind,'discover');assert.equal(act('claim',{day:dayIST()}).busy,true);
 act('finish',{token:claim.token,items:[{website:'https://a.in',city:'Nagpur'}],more:false});claim=act('claim',{day:dayIST()});assert.equal(claim.job.kind,'inspect');
 act('finish',{token:claim.token,lead:{business:'A',email:'a@a.in',phone:'919876543210',website:'https://a.in',city:'Nagpur',eligible:true,findings:[],evidence:[],emailStatus:'Draft'}});
 assert.equal(s.leads[0].id,'STO01');assert.equal(s.runs[0].count,1);assert.throws(()=>act('finish',{token:claim.token}));
});
test('duplicate contacts do not increase qualified lead count',()=>{const s=initialState();s.settings.active=true;context.action_(s,'start',{day:dayIST()});s.leads=[{id:'STO01',email:'INFO@acme.in'}];s.sequence=1;s.candidates=[{website:'https://other.in'}];const claim=context.action_(s,'claim',{day:dayIST()});context.action_(s,'finish',{token:claim.token,lead:{business:'Other',website:'https://other.in',email:'info@acme.in',phone:'919999999999',eligible:true}});assert.equal(s.leads.length,1);assert.equal(s.runs[0].count,0);});
test('expired send lease is held for reconciliation rather than blind resend',()=>{const s=initialState();s.settings.active=true;context.action_(s,'start',{day:dayIST()});s.runs[0].lease={until:0,kind:'send',leadId:'STO01'};s.leads=[{id:'STO01',emailStatus:'Sending'}];context.action_(s,'claim',{day:dayIST(),canSend:true});assert.equal(s.leads[0].emailStatus,'Needs review');});
test('Apps Script and server compute identical template approval hashes',()=>{assert.equal(context.hash_(DEFAULT_TEMPLATE),templateHash(DEFAULT_TEMPLATE));});
test('editing template revokes approval and suppression spans duplicate email records',()=>{const s=initialState();s.template.approvedHash='approved';s.template.autoSend=true;context.action_(s,'template',{subject:'Changed',body:DEFAULT_TEMPLATE.body});assert.equal(s.template.approvedHash,'');assert.equal(s.template.autoSend,false);s.leads=[{id:'STO01',email:'a@a.in'},{id:'STO02',email:'A@a.in'}];context.action_(s,'unsubscribe',{id:'STO01'});assert.ok(s.leads.every(l=>l.unsubscribed));});

test('introductory outreach does not require a website or audit evidence',()=>{const s=initialState();s.settings.active=true;s.template.approvedHash=templateHash(s.template);s.template.autoSend=true;const run=context.action_(s,'start',{day:dayIST()});s.leads=[{id:'STO01',runId:run.id,business:'No website business',email:'info@example.in',phone:'919876543210',eligible:true,emailStatus:'Draft',website:'',findings:[],evidence:[],evidenceStatus:'Not applicable'}];const c=context.action_(s,'claim',{day:dayIST(),canSend:true,captureEvidence:true});assert.equal(c.job.kind,'send');});

test('all-day research uses IST midnight boundaries',()=>{const before=workWindow(new Date('2026-10-30T18:29:59Z')),after=workWindow(new Date('2026-10-30T18:30:00Z'));assert.ok(before.open&&after.open);assert.equal(before.day,'2026-10-30');assert.equal(after.day,'2026-10-31');assert.equal(before.end,after.start);});
test('cutoff stops claims and preserves interrupted candidate for tomorrow',()=>{const s=initialState();s.settings.active=true;const day=dayIST();const t=normalTime();actionAt(s,'start',{day},t);s.candidates=[{website:'https://unreviewed.in'}];const claim=actionAt(s,'claim',{day},t);assert.equal(claim.job.kind,'inspect');const end=Date.parse(`${day}T23:59:59+05:30`);const finish=actionAt(s,'finish',{token:claim.token,cutoff:true,error:'Window ended'},end);assert.equal(finish.continue,false);assert.equal(s.candidates.length,1);assert.equal(s.seen.length,0);assert.equal(s.runs[0].status,'Shortfall');assert.equal(actionAt(s,'claim',{day},end).done,true);});
test('cutoff preserves uncertain SMTP outcome without a blind retry',()=>{const s=initialState();s.settings.active=true;const day=dayIST(),t=normalTime();const run=actionAt(s,'start',{day},t);s.template.approvedHash=templateHash(s.template);s.template.autoSend=true;s.leads=[{id:'STO01',runId:run.id,eligible:true,emailStatus:'Draft'}];const claim=actionAt(s,'claim',{day,canSend:true},t);assert.equal(claim.job.kind,'send');actionAt(s,'finish',{token:claim.token,leadId:'STO01',cutoff:true,uncertain:true},Date.parse(`${day}T23:59:59+05:30`));assert.equal(s.leads[0].emailStatus,'Needs review');});

test('starter search budget reserves requests before execution and stops at monthly cap',()=>{const s=initialState();s.settings.active=true;context.action_(s,'start',{day:dayIST()});s.searchBudget={month:dayIST().slice(0,7),used:899};const c=context.action_(s,'claim',{day:dayIST()});assert.equal(c.job.kind,'discover');assert.equal(s.searchBudget.used,900);context.action_(s,'finish',{token:c.token,items:[],more:false});assert.equal(context.action_(s,'claim',{day:dayIST()}).done,true);assert.equal(s.runs[0].status,'Shortfall');});
