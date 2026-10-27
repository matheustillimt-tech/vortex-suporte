"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
export type ContactLabel = { id: string; name: string; color: string };
export const labelsClient = () => createClient() as unknown as SupabaseClient;
export function useContactLabels(contactIds: string[]) {
 const client=useMemo(labelsClient,[]);
 const key=[...new Set(contactIds)].sort().join(',');
 const [labels,setLabels]=useState<ContactLabel[]>([]);
 const [assigned,setAssigned]=useState<Record<string,string[]>>({});
 const [error,setError]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 async function assignments(ids:string[]) {
  const rows:{contact_id:string;label_id:string}[]=[];
  for(let offset=0;;offset+=1000){const r=await client.from('contact_labels').select('contact_id,label_id').in('contact_id',ids).order('contact_id').order('label_id').range(offset,offset+999);if(r.error)return r;rows.push(...r.data);if(r.data.length<1000)return {data:rows,error:null};}
 }
 const reload=useCallback(async()=>{
  const ids=key?key.split(','):[];
  const [a,b]=await Promise.all([client.from('labels').select('id,name,color').order('name'),ids.length?assignments(ids):Promise.resolve({data:[],error:null})]);
  if(a.error||b.error){setError('Não foi possível carregar as etiquetas.');setLoading(false);return;}
  setLabels(a.data??[]);const map:Record<string,string[]>={};for(const row of b.data??[])(map[row.contact_id]??=[]).push(row.label_id);setAssigned(map);setError(null);setLoading(false);
 },[client,key]);
 useEffect(()=>{void reload();const channel=client.channel(`labels:${key.slice(0,36)}:${Math.random()}`).on('postgres_changes',{event:'*',schema:'public',table:'labels'},()=>void reload()).on('postgres_changes',{event:'*',schema:'public',table:'contact_labels'},()=>void reload()).subscribe();window.addEventListener('support-labels-updated',reload);return()=>{void client.removeChannel(channel);window.removeEventListener('support-labels-updated',reload)}},[client,key,reload]);
 return {labels,assigned,error,loading,reload,client};
}
export function labelTextColor(hex:string){const n=parseInt(hex.slice(1),16);return (((n>>16)&255)*299+((n>>8)&255)*587+(n&255)*114)/1000>150?'#111827':'#ffffff';}
