const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function setup(){
 const els={},listeners={},sent=[];let sounds=0;
 class Element{constructor(tag){this.tag=tag;this.dataset={};this.events={};this.attrs={};this.classList={add(){},remove(){}};if(tag==='iframe')this.contentWindow={postMessage:m=>sent.push(m)}}setAttribute(k,v){this.attrs[k]=v}addEventListener(k,v){this.events[k]=v}}
 class Script extends Element{}const script=new Script('script');script.src='https://support.test/widget.js';script.dataset={host:'https://support.test',project:'principal'};
 const document={hidden:false,readyState:'complete',currentScript:script,getElementById:id=>els[id]??null,createElement:t=>new Element(t),head:{appendChild:e=>els[e.id]=e},body:{appendChild:e=>els[e.id]=e},addEventListener:(k,v)=>listeners['doc:'+k]=v};
 const window={addEventListener:(k,v)=>listeners[k]=v};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('widget-sdk/src/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:{},require:()=>({unlockAudio(){},playNotificationPing(){sounds++}}),document,window,HTMLScriptElement:Script,URL,console,requestAnimationFrame:cb=>cb()});
 const emit=(data,origin='https://support.test')=>listeners.message({source:els.__vortex_suporte_frame.contentWindow,origin,data});
 emit({type:'ready'});
 return {els,sent,emit,sounds:()=>sounds};
}
test('resposta com balão fechado exibe aviso, contador e toca só ao aumentar',()=>{
 const a=setup();a.emit({type:'unread',count:1});assert.match(a.els.__vortex_suporte_launcher.innerHTML,/Nova resposta/);assert.equal(a.els.__vortex_suporte_notice.hidden,false);assert.equal(a.sounds(),1);
 a.emit({type:'unread',count:1});assert.equal(a.sounds(),1);a.emit({type:'unread',count:2});assert.equal(a.sounds(),2);
});
test('clicar no aviso abre a conversa e aguarda confirmação de leitura',()=>{
 const a=setup();a.emit({type:'unread',count:1});a.els.__vortex_suporte_notice.events.click();assert.ok(a.sent.some(m=>m.type==='open-chat'));assert.equal(a.els.__vortex_suporte_notice.hidden,true);
 a.emit({type:'unread',count:0});a.emit({type:'requestClose'});assert.equal(a.els.__vortex_suporte_notice.hidden,true);
});
test('ignora origem não confiável e não toca com chat aberto',()=>{
 const a=setup();a.emit({type:'unread',count:3},'https://other.test');assert.equal(a.sounds(),0);a.els.__vortex_suporte_launcher.events.click();a.emit({type:'unread',count:1});assert.equal(a.sounds(),0);
});
