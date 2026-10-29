import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
for(const dir of ['lib','api','public','scripts','tests'])for(const file of await readdir(dir)){if(!/\.(mjs|js)$/.test(file))continue;const result=spawnSync(process.execPath,['--check',`${dir}/${file}`],{encoding:'utf8'});if(result.status!==0){console.error(result.stderr);process.exit(1);}}
JSON.parse(await readFile('vercel.json','utf8'));console.log('Syntax and deployment configuration checked.');
