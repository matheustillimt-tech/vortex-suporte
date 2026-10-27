"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useContactLabels,type ContactLabel } from '@/lib/contact-labels';
import { LabelBadges } from './ContactLabels';
export function LabelsAdmin(){
 const {labels,error,reload,client}=useContactLabels([]);
 const [id,setId]=useState<string|null>(null),[name,setName]=useState(''),[color,setColor]=useState('#3b82f6'),[busy,setBusy]=useState(false),[feedback,setFeedback]=useState('');
 function edit(l:ContactLabel){setId(l.id);setName(l.name);setColor(l.color);setFeedback('')}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setFeedback('');try{
  const data={name:name.trim(),color:color.toLowerCase()};
  if(!data.name)throw Error('Informe o nome da etiqueta.');
  if(labels.some(l=>l.id!==id&&(l.name.trim().toLowerCase()===data.name.toLowerCase()||l.color===data.color)))throw Error('Escolha um nome e uma cor diferentes das outras etiquetas.');
  const {error}=id?await client.from('labels').update(data).eq('id',id).select('id').single():await client.from('labels').insert(data).select('id').single();
  if(error)throw Error(error.code==='23505'?'Já existe uma etiqueta com esse nome ou cor.':'Não foi possível salvar. Tente novamente.');
  setId(null);setName('');setFeedback('Etiqueta salva.');await reload();window.dispatchEvent(new Event('support-labels-updated'));
 }catch(e){setFeedback(e instanceof Error?e.message:'Não foi possível salvar.')}finally{setBusy(false)}}
 return <section className="mx-auto mt-6 max-w-3xl space-y-4 rounded-xl border bg-card p-5">
 <h2 className="text-sm font-semibold">Etiquetas</h2><p className="text-xs text-muted-foreground">Crie etiquetas com cores diferentes para sua equipe identificar os contatos. Elas aparecem apenas para os agentes e continuam no contato nos próximos atendimentos.</p>
 <form onSubmit={save} className="flex flex-wrap items-end gap-3">
 <label className="min-w-0 flex-1 text-sm">Nome<Input value={name} maxLength={50} required disabled={busy} onChange={e=>setName(e.target.value)} placeholder="Ex.: Aguardando retorno"/></label>
 <label className="text-sm">Cor<input className="block h-10 w-14 rounded border p-1" type="color" value={color} disabled={busy} onChange={e=>setColor(e.target.value)}/></label>
 <Button disabled={busy||!!error} type="submit">{busy?'Salvando…':id?'Salvar etiqueta':'Criar etiqueta'}</Button>
 {id&&<Button type="button" variant="ghost" onClick={()=>{setId(null);setName('');setFeedback('')}}>Cancelar</Button>}
 </form>
 {(feedback||error)&&<p role="status" className="text-sm">{error||feedback}</p>}
 <div className="space-y-2">{labels.map(l=><div className="flex items-center justify-between gap-2" key={l.id}><LabelBadges labels={[l]}/><Button size="sm" variant="ghost" disabled={busy} onClick={()=>edit(l)}>Editar</Button></div>)}</div>
 </section>
}
