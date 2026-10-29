import {apiFetch} from './safe-web.mjs';
export async function store(action,payload={},env=process.env) {
  if(!env.SHEETS_WEBAPP_URL||!env.SHEETS_SECRET)throw new Error('Connect the Google Sheet before using the live workspace.');
  const url=new URL(env.SHEETS_WEBAPP_URL);if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!url.pathname.endsWith('/exec'))throw new Error('Use the deployed Google Apps Script /exec URL.');
  const data=await (await apiFetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.SHEETS_SECRET,action,payload})},22000)).json();
  if(!data.ok)throw new Error(data.error||'Google Sheet operation failed.');return data.data;
}
