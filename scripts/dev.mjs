import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import handler from '../api/index.mjs';
const root=path.resolve('public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await handler(req,res);const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}const content=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(content);}catch{res.writeHead(404);res.end('Not found');}}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log(`Smith preview listening on ${process.env.PORT||3000}`));
