import https from 'node:https';
import http from 'node:http';
import dns from 'node:dns/promises';
import net from 'node:net';

export function isPublicIP(ip) {
  if(net.isIP(ip)===4){const[a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a>=224||a===198&&(b===18||b===19));}
  if(net.isIP(ip)===6){return /^2[0-9a-f]{3}:/i.test(ip)&&!/^2001:(db8|0|10|20):/i.test(ip)&&!/^2002:/i.test(ip);}
  return false;
}
export async function publicURL(raw) {
  const url=new URL(raw);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port&&!['80','443'].includes(url.port))throw new Error('Only public HTTP(S) websites on standard ports can be audited.');
  const host=url.hostname.replace(/^\[|\]$/g,'');const addresses=net.isIP(host)?[{address:host,family:net.isIP(host)}]:await dns.lookup(host,{all:true});
  if(!addresses.length||addresses.some(a=>!isPublicIP(a.address)))throw new Error('Private or reserved addresses cannot be audited.');return {url,address:addresses[0]};
}
export async function fetchWebsite(raw,redirects=0,signal) {
  signal?.throwIfAborted();
  if(redirects>4)throw new Error('Too many redirects.');const {url,address}=await publicURL(raw);
  return new Promise((resolve,reject)=>{
    const request=(url.protocol==='https:'?https:http).get(url,{signal,lookup:(_host,options,cb)=>options.all?cb(null,[address]):cb(null,address.address,address.family),headers:{'User-Agent':'SmithBusinessAudit/0.1 (+https://sunrisetechorigin.com)','Accept':'text/html'},timeout:10000},res=>{
      if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){res.resume();resolve(fetchWebsite(new URL(res.headers.location,url).href,redirects+1,signal));return;}
      if(!String(res.headers['content-type']||'').includes('text/html')){res.resume();reject(new Error('Page did not return HTML.'));return;}
      let size=0,body='';res.setEncoding('utf8');res.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>750000){res.destroy();reject(new Error('Page exceeds audit size limit.'));}else body+=chunk;});res.on('error',reject);res.on('end',()=>resolve({html:body,status:res.statusCode,url:url.href}));
    });request.on('error',reject);request.on('timeout',()=>request.destroy(new Error('Website timed out.')));
  });
}
export async function apiFetch(url,options={},timeout=18000){const response=await fetch(url,{...options,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout)});if(!response.ok)throw new Error(`Service request failed (${response.status}).`);return response;}
