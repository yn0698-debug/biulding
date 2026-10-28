'use client';

import {useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {cloudConfigured, getSupabase, loadWorkspace, type CloudConnection} from '../lib/supabase';

export default function CloudAccess({children}:{children:(cloud?:CloudConnection)=>ReactNode}) {
  const [loading,setLoading]=useState(cloudConfigured());
  const [cloud,setCloud]=useState<CloudConnection>();
  const [error,setError]=useState('');
  const [signedIn,setSignedIn]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const userId=useRef<string|null>(null);

  useEffect(()=>{
    if(!cloudConfigured()) return;
    let active=true;
    let cleanup=()=>{};
    try {
      const client=getSupabase();
      const refresh=async()=>{
        if(!active) return;
        setLoading(true);setError('');setCloud(undefined);
        try {
          const {data:{user},error:authError}=await client.auth.getUser();
          if(!active) return;
          if(authError||!user) {userId.current=null;setSignedIn(false);return;}
          userId.current=user.id;
          setSignedIn(true);
          const {data:admin,error:adminError}=await client.from('committee_admins').select('user_id').eq('user_id',user.id).maybeSingle();
          if(adminError) throw new Error('DB 설치 여부를 확인하세요. supabase/migrations/001_committee_workspace.sql을 SQL Editor에서 실행해야 합니다.');
          if(!admin) throw new Error('관리자로 승인되지 않은 계정입니다. Supabase에서 committee_admins에 사용자 UUID를 등록하세요.');
          const initial=await loadWorkspace(client);
          if(active) setCloud({client,initial,email:user.email??'',signOut:async()=>{const {error}=await client.auth.signOut({scope:'local'});if(error) throw error;}});
        } catch(error) {if(active) setError(error instanceof Error?error.message:'연결에 실패했습니다.');}
        finally {if(active) setLoading(false);}
      };
      void refresh();
      // Avoid awaiting Supabase operations inside the auth callback.
      const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
        if(event==='SIGNED_OUT') {userId.current=null;setCloud(undefined);setSignedIn(false);setLoading(false);}
        if(event==='SIGNED_IN'&&session?.user.id!==userId.current) {userId.current=session?.user.id??null;setAttempt(value=>value+1);}
      });
      cleanup=()=>subscription.unsubscribe();
    } catch(error) {setError(error instanceof Error?error.message:'Supabase 설정을 확인하세요.');setLoading(false);}
    return ()=>{active=false;cleanup();};
  },[attempt]);

  async function login(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=new FormData(event.currentTarget);setLoading(true);setError('');
    try {
      const {error}=await getSupabase().auth.signInWithPassword({email:String(form.get('email')).trim(),password:String(form.get('password'))});
      if(error) throw new Error('로그인하지 못했습니다. 이메일과 비밀번호, 이메일 인증 상태를 확인하세요.');
      setAttempt(value=>value+1);
    } catch(error) {setError(error instanceof Error?error.message:'로그인에 실패했습니다.');setLoading(false);}
  }
  async function logout() {try {const {error}=await getSupabase().auth.signOut({scope:'local'});if(error) throw error;setError('');} catch {setError('로그아웃하지 못했습니다. 다시 시도하세요.');}}

  if(!cloudConfigured()) return children();
  if(cloud) return children(cloud);
  return <div className="login-screen"><section className="login-card"><p className="eyebrow">세종시 건축위원회</p><h1>관리자 로그인</h1><p className="hint">승인된 관리자 계정으로 공유 데이터베이스에 접속합니다.</p>{error&&<div className="notice error" role="alert">{error}</div>}{loading?<p role="status">계정과 데이터베이스를 확인하고 있습니다.</p>:signedIn?<div className="actions"><button onClick={()=>setAttempt(value=>value+1)}>연결 다시 확인</button><button onClick={()=>void logout()}>로그아웃</button></div>:<form onSubmit={login}><label className="form-field">이메일<input name="email" type="email" autoComplete="username" required/></label><label className="form-field">비밀번호<input name="password" type="password" autoComplete="current-password" required/></label><button className="primary" type="submit">로그인</button></form>}</section></div>;
}
