"use client";
import { useState } from 'react';
import { Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useContactLabels,labelTextColor,type ContactLabel } from '@/lib/contact-labels';
export function LabelBadges({labels}:{labels:ContactLabel[]}){
 return <span className="mt-1 flex flex-wrap gap-1">{labels.map(l=><span key={l.id} className="max-w-full break-words rounded px-1.5 py-0.5 text-[11px] font-medium" style={{backgroundColor:l.color,color:labelTextColor(l.color)}}>{l.name}</span>)}</span>;
}
export function ContactLabelPicker({contactId}:{contactId:string}){
 const {labels,assigned,error,loading,client,reload}=useContactLabels([contactId]);
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[saveError,setSaveError]=useState<string|null>(null);
 const selected=assigned[contactId]??[];
 async function toggle(id:string,checked:boolean){
  setBusy(true);setSaveError(null);
  try{const {error}=checked?await client.from('contact_labels').upsert({contact_id:contactId,label_id:id},{onConflict:'contact_id,label_id'}):await client.from('contact_labels').delete().eq('contact_id',contactId).eq('label_id',id);
  if(error)throw error;await reload();window.dispatchEvent(new Event('support-labels-updated'));}catch{setSaveError('Não foi possível salvar a etiqueta. Tente novamente.')}finally{setBusy(false)}
 }
 return <div className="relative">
  <Button variant="outline" size="sm" onClick={()=>setOpen(!open)} aria-expanded={open}><Tag className="h-4 w-4"/>Etiquetas{selected.length?` (${selected.length})`:''}</Button>
  {open&&<div className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[85vw] rounded-lg border bg-card p-3 shadow-xl" onKeyDown={e=>{if(e.key==='Escape')setOpen(false)}}>
   <p className="mb-2 text-sm font-semibold">Etiquetas do contato</p>
   {loading?<p className="text-xs">Carregando…</p>:!labels.length&&!error?<p className="text-xs text-muted-foreground">Nenhuma etiqueta criada. Peça a um administrador para cadastrar nas configurações do widget.</p>:null}
   <div className="max-h-64 space-y-2 overflow-auto">{labels.map(l=><label key={l.id} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(l.id)} disabled={busy||loading||!!error} onChange={e=>void toggle(l.id,e.target.checked)}/><span className="h-3 w-3 shrink-0 rounded-full" style={{backgroundColor:l.color}}/>{l.name}</label>)}</div>
   {(error||saveError)&&<p role="alert" className="mt-2 text-xs text-destructive">{error||saveError}</p>}
   <Button variant="ghost" size="sm" onClick={()=>setOpen(false)} className="mt-2">Fechar</Button>
  </div>}
 </div>;
}
export function ContactLabelHeader({contactId}:{contactId:string}){const {labels,assigned}=useContactLabels([contactId]);return <LabelBadges labels={labels.filter(l=>(assigned[contactId]??[]).includes(l.id))}/>}
