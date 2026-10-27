const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={},globals={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>{if(!(id in deps))throw Error(id);return deps[id]},console,URL,Response,crypto:require('node:crypto').webcrypto,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co'}},...globals});return exports;}
const limits=load('src/lib/support-upload-limits.ts');
function api(name,session={contactId:'contact'}) {
 let calls=0;
 const client={storage:{from:()=>({createSignedUploadUrl:async()=>{calls++;return {data:{signedUrl:'https://test.supabase.co/upload',token:'token'},error:null}},getPublicUrl:()=>({data:{publicUrl:'https://test.supabase.co/file'}})})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{calls++;return {data:null}}})})})};
 return {route:load(`src/app/api/${name}/route.ts`,{
 '@/lib/support-upload-limits':limits,'next/server':{NextResponse:{json:(data,init)=>new Response(JSON.stringify(data),init)}},zod:require('zod'),
 '@/lib/supabase/admin':{createAdminClient:()=>client},'@/lib/widget-token':{verifySession:()=>session},
 '@/lib/security/rate-limit':{clientIp:()=>'',rateLimit:()=>({blocked:false}),rateLimitHeaders:()=>({})},
 '@/lib/security/cors':{widgetCorsHeaders:()=>({}),widgetCorsResponse:()=>new Response()},
 '@/lib/conversation-reopen':{},'@/lib/brand':{BRAND:{name:'Sua Empresa'}},
 }),calls:()=>calls};
}
const req=body=>new Request('https://support.test/api',{method:'POST',body:JSON.stringify(body)});
test('autorização permite o limite exato e rejeita 1 byte acima antes do storage',async()=>{
 const a=api('upload');let r=await a.route.POST(req({filename:'video.mp4',mime:'video/mp4',size:limits.MAX_SUPPORT_FILE_BYTES}));assert.equal(r.status,200);const d=await r.json();assert.equal(d.resumableUrl,'https://test.storage.supabase.co/storage/v1/upload/resumable/sign');assert.equal(d.bucket,'support-attachments');assert.equal(a.calls(),1);
 r=await a.route.POST(req({filename:'video.mp4',mime:'video/mp4',size:limits.MAX_SUPPORT_FILE_BYTES+1}));assert.equal(r.status,400);assert.equal(a.calls(),1);
});
test('não amplia autenticação nem tipos de arquivo permitidos',async()=>{
 const a=api('upload',null);assert.equal((await a.route.POST(req({}))).status,401);assert.equal(a.calls(),0);
 const b=api('upload');assert.equal((await b.route.POST(req({filename:'x.exe',mime:'application/x-msdownload',size:100}))).status,415);assert.equal(b.calls(),0);
});
test('mensagem aceita metadados no limite e rejeita acima antes de consultar conversa',async()=>{
 const a=api('messages');const body={conversationId:'11111111-1111-4111-8111-111111111111',attachments:[{url:'https://test.supabase.co/file',name:'file.pdf',mime:'application/pdf',size:limits.MAX_SUPPORT_FILE_BYTES}]};
 assert.equal((await a.route.POST(req(body))).status,404);assert.equal(a.calls(),1);
 body.attachments[0].size++;assert.equal((await a.route.POST(req(body))).status,400);assert.equal(a.calls(),1);
});
const sign={uploadUrl:'https://test/put',resumableUrl:'https://test/tus',publicUrl:'https://test/file',token:'scoped',path:'contact/file',bucket:'support-attachments'};
test('arquivo grande usa partes de 6 MiB, token restrito e informa progresso; sem proxy do arquivo',async()=>{
 let opts;
 const uploader=load('src/lib/support-upload.ts',{'./support-upload-limits':limits,'tus-js-client':{Upload:class {constructor(file,o){opts=o;}start(){opts.onProgress(1,2);opts.onSuccess();}}}},{fetch:()=>assert.fail('não deve enviar o arquivo inteiro')});
 const progress=[];await uploader.uploadSupportFile({size:limits.MAX_SUPPORT_FILE_BYTES,type:'video/mp4'},sign,p=>progress.push(p));
 assert.equal(opts.chunkSize,6*1024*1024);assert.equal(opts.headers['x-signature'],'scoped');assert.equal(opts.metadata.objectName,'contact/file');assert.ok(opts.retryDelays.length>1);assert.deepEqual(progress,[50,100]);
 await assert.rejects(uploader.uploadSupportFile({size:limits.MAX_SUPPORT_FILE_BYTES+1},sign,()=>{}),new RegExp(limits.SUPPORT_FILE_LIMIT_LABEL));
});
test('falha de upload rejeita a operação; arquivo pequeno mantém upload direto',async()=>{
 const broken=load('src/lib/support-upload.ts',{'./support-upload-limits':limits,'tus-js-client':{Upload:class {constructor(f,o){this.o=o;}start(){this.o.onError(Error('network'));}}}});
 await assert.rejects(broken.uploadSupportFile({size:7*1024*1024,type:'video/mp4'},sign,()=>{}),/interrompido/);
 let url;const small=load('src/lib/support-upload.ts',{'./support-upload-limits':limits},{fetch:async u=>{url=u;return {ok:true}}});
 await small.uploadSupportFile({size:1024,type:'image/png'},sign,()=>{});assert.equal(url,sign.uploadUrl);
});
