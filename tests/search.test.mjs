import test from 'node:test';
import assert from 'node:assert/strict';
import {discover} from '../lib/research.mjs';
import {connections} from '../lib/worker.mjs';
const location={category:'Education',city:'Pune',zone:'East',offset:3};
test('Tavily uses basic search, filters directories, and advances without pagination',async()=>{
 const original=globalThis.fetch;let request;
 globalThis.fetch=async(url,options)=>{request={url,options};return Response.json({results:[{url:'https://school.example',title:'School'},{url:'https://justdial.com/list',title:'Directory'},{url:'javascript:bad'}]});};
 try{const result=await discover(location,{TAVILY_API_KEY:'test-key',SEARCH_STORAGE_RIGHTS_CONFIRMED:'true'});assert.equal(request.url,'https://api.tavily.com/search');assert.equal(request.options.headers.Authorization,'Bearer test-key');const body=JSON.parse(request.options.body);assert.equal(body.search_depth,'basic');assert.equal(body.auto_parameters,false);assert.equal(body.include_answer,false);assert.equal(result.items.length,1);assert.equal(result.more,false);assert.equal(result.items[0].city,'Pune');}finally{globalThis.fetch=original;}
});
test('Tavily rejects service errors without exposing key',async()=>{const original=globalThis.fetch;globalThis.fetch=async()=>new Response('',{status:432});try{await assert.rejects(discover(location,{TAVILY_API_KEY:'secret',SEARCH_STORAGE_RIGHTS_CONFIRMED:'true'}),/Service request failed \(432\)/);}finally{globalThis.fetch=original;}});
test('search readiness follows selected provider',()=>{assert.equal(connections({TAVILY_API_KEY:'test'}).search,true);assert.equal(connections({BRAVE_SEARCH_API_KEY:'test'}).search,false);assert.equal(connections({SEARCH_PROVIDER:'brave',BRAVE_SEARCH_API_KEY:'test'}).search,true);});
