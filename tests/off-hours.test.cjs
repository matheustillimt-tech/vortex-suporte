const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup({online=false, fail='', status='open'}={}) {
 const writes=[], updates=[];
 const client={rpc:async()=>{if(fail==='throw')throw Error('unavailable');return {data:online,error:fail==='hours'?Error('hours'):null}},from:table=>({
  select:()=>({eq:()=>({maybeSingle:async()=>table==='conversations'?{data:{id:'11111111-1111-4111-8111-111111111111',contact_id:'customer',status}}:{data:{offline_message:'Mensagem configurada'},error:fail==='settings'?Error('settings'):null}})}),
  update:data=>{const c={eq:()=>c,select:async()=>{updates.push(data);return {data:[{id:'11111111-1111-4111-8111-111111111111'}],error:null}}};return c},
  insert:data=>{writes.push(data);return {error:fail==='notice'&&data.author_type==='bot'?Error('notice'):null,select:()=>({single:async()=>({data:{...data,id:'saved'},error:fail==='save'?Error('save'):null})})}}
 })};
 const exports={};
 const deps={'@/lib/support-upload-limits':{MAX_SUPPORT_FILE_BYTES:419430400},'next/server':{NextResponse:{json:(data,init)=>new Response(JSON.stringify(data),init)}},zod:require('zod'),'@/lib/supabase/admin':{createAdminClient:()=>client},'@/lib/widget-token':{verifySession:()=>({contactId:'customer',projectKey:'principal'})},'@/lib/security/rate-limit':{clientIp:()=>'',rateLimit:()=>({blocked:false}),rateLimitHeaders:()=>({})},'@/lib/security/cors':{widgetCorsHeaders:()=>({}),widgetCorsResponse:()=>new Response()}};
 deps['@/lib/brand']={BRAND:{name:'Sua Empresa'}};
 deps['@/lib/conversation-reopen']=(()=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/conversation-reopen.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>id==='@/lib/brand'?deps['@/lib/brand']:({}),Date});return exports})();
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/app/api/messages/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>deps[id],console:{error:()=>{}},Response});
 return {writes,updates,send:body=>exports.POST(new Request('https://test/api/messages',{method:'POST',body:JSON.stringify({conversationId:'11111111-1111-4111-8111-111111111111',...body})}))};
}
test('atendimento aberto: cada mensagem gera aviso salvo após o contato sem reatribuir',async()=>{
 const a=setup();for(let i=0;i<3;i++)assert.equal((await a.send({body:'Teste'})).status,200);
 assert.deepEqual(a.writes.map(x=>x.author_type),['contact','bot','contact','bot','contact','bot']);
 assert.ok(a.writes.filter(x=>x.author_type==='bot').every(x=>x.body==='Mensagem configurada'));assert.equal(a.updates.length,0);
});
test('dentro do horário não envia aviso',async()=>{const a=setup({online:true});await a.send({body:'Teste'});assert.equal(a.writes.length,1)});
test('anexo sem texto também recebe aviso',async()=>{const a=setup();assert.equal((await a.send({attachments:[{url:'https://test/a.wav',name:'a.wav',mime:'audio/wav',size:419430400}]})).status,200);assert.equal(a.writes[1].author_type,'bot')});
for(const fail of ['hours','settings','notice','throw'])test(`falha ${fail} não faz cliente reenviar mensagem salva`,async()=>{const a=setup({fail});const r=await a.send({body:'Teste'});assert.equal(r.status,200);assert.equal((await r.json()).message.id,'saved')});
test('falha ao salvar contato não gera aviso',async()=>{const a=setup({fail:'save'});assert.equal((await a.send({body:'Teste'})).status,500);assert.equal(a.writes.length,1)});
test('conversa finalizada mantém reabertura existente e recebe aviso',async()=>{const a=setup({status:'closed'});await a.send({body:'Teste'});assert.equal(a.updates[0].status,'waiting');assert.equal(a.writes.at(-1).author_type,'bot')});
