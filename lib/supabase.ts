import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import {parseData, type AdminData} from './admin';

export type Snapshot = {data:AdminData;revision:number;updated_at:string};
export type CloudConnection = {client:SupabaseClient;initial:Snapshot;email:string;signOut:()=>Promise<void>};
let client:SupabaseClient|null=null;

export function cloudConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export function getSupabase() {
  if(client) return client;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key) throw new Error('Supabase URL과 Publishable key를 모두 설정하고 앱을 다시 실행하세요.');
  if(key.startsWith('sb_secret_')) throw new Error('Secret key는 사용할 수 없습니다. Publishable key를 입력하세요.');
  if(key.startsWith('eyJ')) {
    try {const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role==='service_role') throw new Error('service_role 키는 사용할 수 없습니다. anon 공개 키를 입력하세요.');}
    catch(error) {if(error instanceof Error && error.message.includes('service_role')) throw error;throw new Error('Supabase 공개 키 형식을 확인하세요.');}
  }
  client=createClient(url,key);
  return client;
}
export function parseSnapshot(value:unknown):Snapshot {
  if(!value||typeof value!=='object') throw new Error('DB 데이터를 찾을 수 없습니다. SQL 설치와 관리자 승인을 확인하세요.');
  const row=value as Record<string,unknown>;
  if(!Number.isSafeInteger(row.revision)||Number(row.revision)<0||typeof row.updated_at!=='string') throw new Error('DB 응답 형식이 올바르지 않습니다.');
  return {data:parseData(row.data),revision:Number(row.revision),updated_at:row.updated_at};
}
export async function loadWorkspace(supabase:SupabaseClient) {
  const {data,error}=await supabase.from('committee_workspace').select('data,revision,updated_at').eq('id',1).single();
  if(error) throw new Error('DB를 읽지 못했습니다. SQL 실행과 관리자 승인 여부를 확인하세요. ('+error.code+')');
  return parseSnapshot(data);
}
export async function writeWorkspace(supabase:SupabaseClient, revision:number, next:AdminData) {
  parseData(next);
  const {data,error}=await supabase.rpc('save_committee_workspace',{expected_revision:revision,next_data:next});
  if(error) {
    if(error.code==='40001') throw new Error('다른 관리자가 먼저 저장했습니다. 입력 내용을 확인한 뒤 새로고침하고 다시 작업하세요.');
    throw new Error('DB 저장에 실패했습니다. 연결 상태와 관리자 권한을 확인하세요. ('+error.code+')');
  }
  return parseSnapshot(data);
}
