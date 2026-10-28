'use client';

import {useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import Image from 'next/image';
import {LayoutDashboard, Users, PhoneCall, CalendarDays, ClipboardCheck, Wallet, BarChart3, Search, Plus, Download, Settings, Pencil, Trash2, Check, ArrowRight} from 'lucide-react';
import {initialMembers, initialMeetings, initialAgendas, fields, committees, type Member, type Meeting, type Agenda} from '../lib/mock';
import {STORAGE_KEY, inviteStatuses, results, nextId, isDate, parseData, removeRecord, changeInvite, changeAllowance, type AdminData} from '../lib/admin';
import CloudAccess from './cloud-access';
import {writeWorkspace, type CloudConnection} from '../lib/supabase';

const menus = [
  {id:'dashboard', label:'세종시 건축위원회', icon:LayoutDashboard, children:[['overview','업무 현황']]},
  {id:'members', label:'위원 관리', icon:Users, children:[['list','위원 명부'],['form','위원 등록']]},
  {id:'meetings', label:'회의·안건', icon:CalendarDays, children:[['list','회의 일정'],['form','회의 등록'],['agendas','안건 관리'],['agendaForm','안건 등록']]},
  {id:'invites', label:'위원 섭외·참석', icon:PhoneCall, children:[['contacts','섭외 관리'],['attendance','참석 확정']]},
  {id:'results', label:'심의 결과', icon:ClipboardCheck, children:[['list','결과 관리']]},
  {id:'allowances', label:'수당 관리', icon:Wallet, children:[['list','지급 관리']]},
  {id:'stats', label:'통계', icon:BarChart3, children:[['list','구성·참석 통계']]},
  {id:'settings', label:'데이터 관리', icon:Settings, children:[['backup','백업·복원']]},
];
const initialData:AdminData = {version:1, members:initialMembers, meetings:initialMeetings, agendas:initialAgendas, invites:[], allowances:[]};
const errorText = (error:unknown) => error instanceof Error ? error.message : '작업을 완료하지 못했습니다.';
const get = (form:FormData, key:string) => String(form.get(key) ?? '').trim();

function download(name:string, content:string, type:string) {
  const url=URL.createObjectURL(new Blob([content], {type}));
  const anchor=document.createElement('a'); anchor.href=url; anchor.download=name;
  document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function csv(name:string, rows:(string|number)[][]) {
  const content='\ufeff'+rows.map(row=>row.map(cell=>{
    let text=String(cell); if (/^[=+\-@\t\r]/.test(text)) text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  }).join(',')).join('\r\n');
  download(name+'.csv',content,'text/csv;charset=utf-8');
}

export default function Page() {return <CloudAccess>{cloud=><Home cloud={cloud}/>}</CloudAccess>;}

function Home({cloud}:{cloud?:CloudConnection}) {
  const [data,setData]=useState<AdminData>(cloud?.initial.data??initialData);
  const revision=useRef(cloud?.initial.revision??0);
  const savingLock=useRef(false);
  const [saving,setSaving]=useState(false);
  const [ready,setReady]=useState(false);
  const [storageIssue,setStorageIssue]=useState('');
  const [notice,setNotice]=useState('');
  const [tab,setTab]=useState('dashboard'); const [sub,setSub]=useState('overview');
  const [editId,setEditId]=useState<number|null>(null); const [dirty,setDirty]=useState(false);
  const [viewKey,setViewKey]=useState(0);
  const [query,setQuery]=useState(''); const [field,setField]=useState('전체');
  const [meetingId,setMeetingId]=useState(1); const [statusFilter,setStatusFilter]=useState('전체');
  const [savedAt,setSavedAt]=useState(''); const fileInput=useRef<HTMLInputElement>(null);
  const [pendingAllowances,setPendingAllowances]=useState<Record<number,boolean>>({});
  const hasUnsaved=dirty||Object.values(pendingAllowances).some(Boolean);
  const {members,meetings,agendas,invites,allowances}=data;

  useEffect(()=>{
    if(cloud) {setReady(true);return;}
    try {const stored=localStorage.getItem(STORAGE_KEY); if (stored) setData(parseData(JSON.parse(stored)));}
    catch {setStorageIssue('저장된 데이터를 읽지 못했습니다. 기존 저장 내용은 유지했습니다. 백업 파일을 복원하거나 브라우저 저장소 설정을 확인하세요.');}
    setReady(true);
    const onStorage=(event:StorageEvent)=>{if(event.key===STORAGE_KEY || event.key===null) setStorageIssue('다른 탭에서 데이터가 변경되었습니다. 이 탭을 새로고침한 후 작업하세요.');};
    window.addEventListener('storage',onStorage); return ()=>window.removeEventListener('storage',onStorage);
  },[cloud]);
  useEffect(()=>{
    if(!hasUnsaved&&!saving) return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();};
    window.addEventListener('beforeunload',warn); return ()=>window.removeEventListener('beforeunload',warn);
  },[hasUnsaved,saving]);
  useEffect(()=>{if(meetingId!==0&&!meetings.some(x=>x.id===meetingId)) setMeetingId(meetings[0]?.id ?? 0);},[meetings,meetingId]);

  async function save(next:AdminData, message='변경 내용을 저장했습니다.', restoring=false) {
    if(!ready||savingLock.current) return false;
    if(storageIssue && (cloud||!restoring)) {setNotice(cloud?'공유 데이터를 다시 불러온 뒤 저장하세요.':'저장소 문제를 먼저 해결해 주세요. 데이터 관리에서 백업을 복원할 수 있습니다.'); return false;}
    try {parseData(next);} catch(error) {setNotice(errorText(error));return false;}
    savingLock.current=true;setSaving(true);
    try {
      if(cloud) {const result=await writeWorkspace(cloud.client,revision.current,next);revision.current=result.revision;}
      else localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
      setData(next); setSavedAt(new Date().toLocaleTimeString('ko-KR')); setNotice(message); setStorageIssue(''); return true;
    } catch(error) {
      const message=errorText(error);setNotice('저장하지 못했습니다. '+message);
      if(cloud) setStorageIssue('공유 DB 저장에 실패했습니다. 현재 입력을 확인한 뒤 새로고침해서 DB 최신 상태를 불러오세요.');
      return false;
    } finally {savingLock.current=false;setSaving(false);}
  }
  async function change(action:()=>AdminData, message?:string) {try {return await save(action(),message);} catch(error) {setNotice(errorText(error)); return false;}}
  function navigate(nextTab:string,nextSub:string,id:number|null=null) {
    if(hasUnsaved && !window.confirm('저장하지 않은 입력 내용이 있습니다. 이동하시겠습니까?')) return;
    setPendingAllowances({});
    setViewKey(value=>value+1);
    if((nextTab==='invites'||nextTab==='allowances')&&!meetingId) setMeetingId(meetings[0]?.id??0);
    setTab(nextTab);setSub(nextSub);setEditId(id);setDirty(false);setQuery('');setField('전체');setStatusFilter('전체');setNotice('');
  }
  function remove(kind:'members'|'meetings'|'agendas',id:number,name:string) {
    try {const next=removeRecord(data,kind,id); if(window.confirm(`‘${name}’ 항목을 삭제하시겠습니까? 삭제 후에는 백업 파일로만 복원할 수 있습니다.`)) save(next,'삭제했습니다.');}
    catch(error) {setNotice(errorText(error));}
  }
  async function submitMember(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=new FormData(event.currentTarget);
    const start=get(form,'start'),end=get(form,'end');
    if(!isDate(start)||!isDate(end)||start>end) return setNotice('임기 시작일과 종료일을 확인하세요.');
    const selectedFields=form.getAll('fields').map(String),selectedCommittees=form.getAll('committees').map(String);
    if(!selectedFields.length||!selectedCommittees.length) return setNotice('전문 분야와 소속 위원회를 각각 하나 이상 선택하세요.');
    const old=members.find(x=>x.id===editId);
    const member:Member={id:old?.id??nextId(members),name:get(form,'name'),gender:get(form,'gender') as Member['gender'],organization:get(form,'organization'),phone:get(form,'phone'),term:`${start} ~ ${end}`,fields:selectedFields,committees:selectedCommittees,invites:old?.invites??0,attended:old?.attended??0};
    if(await save({...data,members:old?members.map(x=>x.id===old.id?member:x):[...members,member]},old?'위원 정보를 수정했습니다.':'위원을 등록했습니다.')) {setDirty(false);setSub('list');setEditId(null);}
  }
  async function submitMeeting(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=new FormData(event.currentTarget); const old=meetings.find(x=>x.id===editId);
    const meeting:Meeting={id:old?.id??nextId(meetings),title:get(form,'title'),date:get(form,'date'),type:get(form,'type'),mode:get(form,'mode') as Meeting['mode'],status:get(form,'status')};
    if(!isDate(meeting.date)) return setNotice('올바른 개최일을 입력하세요.');
    if(await save({...data,meetings:old?meetings.map(x=>x.id===old.id?meeting:x):[...meetings,meeting]},old?'회의를 수정했습니다.':'회의를 등록했습니다.')) {setDirty(false);setSub('list');setEditId(null);setMeetingId(meeting.id);}
  }
  async function submitAgenda(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();const form=new FormData(event.currentTarget);const old=agendas.find(x=>x.id===editId);
    const agenda:Agenda={id:old?.id??nextId(agendas),title:get(form,'title'),location:get(form,'location'),meetingId:Number(get(form,'meetingId')),result:get(form,'result'),...(get(form,'previousId')?{previousId:Number(get(form,'previousId'))}:{})};
    if(await save({...data,agendas:old?agendas.map(x=>x.id===old.id?agenda:x):[...agendas,agenda]},old?'안건을 수정했습니다.':'안건을 등록했습니다.')) {setDirty(false);setSub('agendas');setEditId(null);}
  }
  async function restore(file:File|undefined) {
    if(!file) return;
    try {
      if(file.size>5*1024*1024) throw new Error('5MB 이하의 백업 파일을 선택하세요.');
      const next=parseData(JSON.parse(await file.text()));
      if(window.confirm(`위원 ${next.members.length}명, 회의 ${next.meetings.length}건, 안건 ${next.agendas.length}건을 복원합니다. ${cloud?'모든 관리자가 공유하는 DB의':'현재'} 데이터와 저장하지 않은 입력 내용을 모두 교체하시겠습니까?`)) {if(await save(next,'백업을 복원했습니다.',true)) {setDirty(false);setEditId(null);}}
    } catch(error) {setNotice('복원하지 못했습니다. '+errorText(error));}
    finally {if(fileInput.current) fileInput.current.value='';}
  }

  const menu=menus.find(x=>x.id===tab)!;
  const selectedMeeting=meetings.find(x=>x.id===meetingId);
  const meetingInvites=invites.filter(x=>x.meetingId===meetingId);
  const attended=invites.filter(x=>x.confirmed&&x.attended);
  const paid=allowances.filter(x=>x.paid).reduce((sum,x)=>sum+x.amount,0);
  const matches=(...values:string[])=>values.join(' ').toLowerCase().includes(query.trim().toLowerCase());
  const filteredMembers=members.filter(x=>matches(x.name,x.organization,x.phone,x.fields.join(' '))&&(field==='전체'||x.fields.includes(field)));
  const filteredMeetings=meetings.filter(x=>matches(x.title,x.type,x.date)&&(statusFilter==='전체'||x.status===statusFilter)).sort((a,b)=>b.date.localeCompare(a.date));
  const filteredAgendas=agendas.filter(x=>matches(x.title,x.location)&&(meetingId===0||x.meetingId===meetingId));
  const editingMember=members.find(x=>x.id===editId), editingMeeting=meetings.find(x=>x.id===editId), editingAgenda=agendas.find(x=>x.id===editId);
  const term=editingMember?.term.split(' ~ ')??['',''];
  const actionButtons=(kind:'members'|'meetings'|'agendas', id:number,name:string)=><div className="row-actions"><button aria-label={`${name} 수정`} onClick={()=>navigate(kind==='agendas'?'meetings':kind,kind==='agendas'?'agendaForm':'form',id)}><Pencil size={14}/>수정</button><button className="danger-text" aria-label={`${name} 삭제`} onClick={()=>remove(kind,id,name)}><Trash2 size={14}/>삭제</button></div>;
  const meetingPicker=(all=false)=><label className="meeting-picker">회의 선택<select aria-label="회의 선택" value={meetingId} onChange={e=>{if(Object.values(pendingAllowances).some(Boolean)&&!window.confirm('저장하지 않은 수당 입력을 버리고 회의를 변경하시겠습니까?')) return;setPendingAllowances({});setMeetingId(Number(e.target.value));}}>{all&&<option value={0}>전체 회의</option>}{!meetings.length&&!all&&<option value={0}>등록된 회의 없음</option>}{meetings.map(x=><option key={x.id} value={x.id}>{x.title} · {x.date}</option>)}</select></label>;
  const search=<label className="search"><Search size={16}/><input aria-label="검색" placeholder="검색어를 입력하세요" value={query} onChange={e=>setQuery(e.target.value)}/></label>;
  const cancel=<button type="button" onClick={()=>navigate(tab,sub==='agendaForm'?'agendas':'list')}>취소</button>;

  return <div className="shell" aria-busy={saving}>
    <aside className="sidebar" inert={saving}><div className="brand"><Image className="brand-logo" src="/branding/sejong-city-logo.jpg" alt="세종특별자치시 로고" width={170} height={100} priority/><div>세종시 건축위원회<small>운영자 관리 화면</small></div></div>
      <nav aria-label="주 메뉴">{menus.map(item=><div key={item.id}><button className={tab===item.id?'active':''} aria-expanded={tab===item.id} onClick={()=>navigate(item.id,item.children[0][0])}><item.icon size={18}/>{item.label}</button>{tab===item.id&&<div className="subnav">{item.children.map(([id,label])=><button key={id} className={sub===id?'selected':''} aria-current={sub===id?'page':undefined} onClick={()=>navigate(item.id,id)}>{id===sub&&editId!==null?'정보 수정':label}</button>)}</div>}</div>)}</nav>
      <div className="sidefoot">{cloud?'공유 DB · 관리자 전용':'브라우저 저장 방식 · 관리자 기능 미리보기'}{cloud&&<><p>{cloud.email}</p><button onClick={()=>{if(!hasUnsaved||window.confirm('저장하지 않은 입력을 버리고 로그아웃하시겠습니까?')) void cloud.signOut().catch(()=>setNotice('로그아웃하지 못했습니다.'));}}>로그아웃</button></>}</div>
    </aside>
    <main className="main" key={viewKey} inert={saving}><header><div><p className="eyebrow">운영자 업무 공간 / {menu.label}</p><h1>{editId!==null?'정보 수정':menu.children.find(x=>x[0]===sub)?.[1]}</h1><p>등록부터 섭외, 심의 결과와 수당까지 한곳에서 관리하세요.</p></div><div className="actions"><span className="chip"><Check size={14}/>{!ready?'불러오는 중':storageIssue?'저장소 확인 필요':savedAt?`${savedAt} 저장됨`:(cloud?'Supabase 공유 DB':'이 브라우저에 저장')}</span>{cloud&&<button onClick={()=>{if(!hasUnsaved||window.confirm('저장하지 않은 입력을 버리고 로그아웃하시겠습니까?')) void cloud.signOut().catch(()=>setNotice('로그아웃하지 못했습니다.'));}}>로그아웃</button>}</div></header>
      <div className="storage-banner">{cloud?'승인된 관리자들이 공유하는 데이터베이스입니다. 다른 관리자의 변경 내용은 새로고침하면 반영됩니다.':'입력 내용은 현재 기기의 같은 브라우저에 저장됩니다. 다른 관리자·기기와 공유되지 않습니다.'} <button onClick={()=>navigate('settings','backup')}>백업 관리 <ArrowRight size={13}/></button></div>
      {storageIssue&&<div className="notice error" role="alert">{storageIssue}</div>}
      {notice&&<div className="notice" role="status">{notice}<button aria-label="알림 닫기" onClick={()=>setNotice('')}>×</button></div>}
      {!ready?<section>저장된 내용을 불러오고 있습니다.</section>:<>
      {tab==='dashboard'&&<>
        <div className="cards"><Metric label="등록 위원" value={`${members.length}명`}/><Metric label="예정 회의" value={`${meetings.filter(x=>x.status==='예정').length}건`}/><Metric label="결과 입력 대기" value={`${agendas.filter(x=>x.result==='심의 전').length}건`}/><Metric label="지급 대기" value={`${attended.filter(i=>!allowances.some(a=>a.meetingId===i.meetingId&&a.memberId===i.memberId&&a.paid)).length}건`}/></div>
        <section><div className="sectionhead"><div><h2>자주 하는 업무</h2><p className="hint">필요한 입력 화면으로 바로 이동하세요.</p></div></div><div className="quick-actions"><button onClick={()=>navigate('members','form')}><Users/>위원 등록<Plus size={16}/></button><button onClick={()=>navigate('meetings','form')}><CalendarDays/>회의 등록<Plus size={16}/></button><button onClick={()=>navigate('meetings','agendaForm')}><ClipboardCheck/>안건 등록<Plus size={16}/></button><button onClick={()=>navigate('invites','contacts')}><PhoneCall/>위원 섭외<ArrowRight size={16}/></button></div></section>
        <section><div className="sectionhead"><h2>예정 회의</h2><button onClick={()=>navigate('meetings','list')}>전체 일정 보기</button></div><DataTable headers={['회의명','개최일','위원회','방식','관리']} rows={meetings.filter(x=>x.status==='예정').sort((a,b)=>a.date.localeCompare(b.date)).map(x=>[x.title,x.date,x.type,x.mode,<button key={x.id} onClick={()=>{navigate('invites','contacts');setMeetingId(x.id);}}>섭외 관리</button>])} empty="예정된 회의가 없습니다. 회의 등록에서 일정을 추가하세요."/></section>
      </>}

      {tab==='members'&&sub==='list'&&<section><div className="sectionhead"><div><h2>위원 명부 <span className="muted">{filteredMembers.length}명</span></h2><p className="hint">전문 분야·소속·연락처·임기를 관리합니다.</p></div><div className="actions"><button onClick={()=>csv('위원명부',[['번호','성명','성별','소속','연락처','전문 분야','위원회','임기'],...filteredMembers.map(x=>[x.id,x.name,x.gender,x.organization,x.phone,x.fields.join('/'),x.committees.join('/'),x.term])])}><Download size={16}/>CSV 내보내기</button><button className="primary" onClick={()=>navigate('members','form')}><Plus size={16}/>위원 등록</button></div></div><div className="filters">{search}<select aria-label="전문 분야 필터" value={field} onChange={e=>setField(e.target.value)}>{['전체',...fields].map(x=><option key={x}>{x}</option>)}</select></div><DataTable headers={['성명','성별','소속·연락처','전문 분야','소속 위원회','임기','관리']} rows={filteredMembers.map(x=>[<strong key="name">{x.name}</strong>,x.gender,<div key="org">{x.organization}<small className="cell-note">{x.phone||'연락처 미등록'}</small></div>,x.fields.join(', '),x.committees.join(', '),x.term,actionButtons('members',x.id,x.name)])}/></section>}
      {tab==='members'&&sub==='form'&&<section><h2>{editingMember?'위원 정보 수정':'새 위원 등록'}</h2><p className="hint">* 필수 항목입니다. 전문 분야와 위원회는 복수 선택할 수 있습니다.</p><form key={`member-${editId}`} onSubmit={submitMember} onChange={()=>setDirty(true)}><div className="form-grid"><Field label="성명 *"><input name="name" defaultValue={editingMember?.name} required maxLength={50}/></Field><Field label="성별 *"><select name="gender" defaultValue={editingMember?.gender??'남'}><option>남</option><option>여</option></select></Field><Field label="소속 *"><input name="organization" defaultValue={editingMember?.organization} required maxLength={100}/></Field><Field label="연락처"><input name="phone" type="tel" defaultValue={editingMember?.phone} placeholder="010-0000-0000" maxLength={30}/></Field><Field label="임기 시작일 *"><input type="date" name="start" defaultValue={term[0]} required/></Field><Field label="임기 종료일 *"><input type="date" name="end" defaultValue={term[1]} required/></Field></div><ChoiceGroup label="전문 분야 *" name="fields" options={fields} selected={editingMember?.fields??[]}/><ChoiceGroup label="소속 위원회 *" name="committees" options={committees} selected={editingMember?.committees??[]}/><div className="form-actions">{cancel}<button className="primary" type="submit">{editingMember?'수정 내용 저장':'위원 등록'}</button></div></form></section>}

      {tab==='meetings'&&sub==='list'&&<section><div className="sectionhead"><h2>회의 일정 <span className="muted">{filteredMeetings.length}건</span></h2><button className="primary" onClick={()=>navigate('meetings','form')}><Plus size={16}/>회의 등록</button></div><div className="filters">{search}<select aria-label="회의 상태 필터" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{['전체','예정','진행 중','완료','취소'].map(x=><option key={x}>{x}</option>)}</select></div><DataTable headers={['회의명','개최일','위원회','방식','상태','안건','관리']} rows={filteredMeetings.map(x=>[x.title,x.date,x.type,x.mode,<Badge key="status">{x.status}</Badge>,<button key="agendas" onClick={()=>{navigate('meetings','agendas');setMeetingId(x.id);}}>{agendas.filter(a=>a.meetingId===x.id).length}건 보기</button>,actionButtons('meetings',x.id,x.title)])}/></section>}
      {tab==='meetings'&&sub==='form'&&<section><h2>{editingMeeting?'회의 정보 수정':'새 회의 등록'}</h2><form key={`meeting-${editId}`} onSubmit={submitMeeting} onChange={()=>setDirty(true)}><div className="form-grid"><Field label="회의명 *"><input name="title" defaultValue={editingMeeting?.title} required maxLength={150}/></Field><Field label="개최일 *"><input type="date" name="date" defaultValue={editingMeeting?.date} required/></Field><Field label="위원회 *"><select name="type" defaultValue={editingMeeting?.type??committees[0]}>{committees.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="개최 방식"><select name="mode" defaultValue={editingMeeting?.mode??'대면'}><option>대면</option><option>서면</option></select></Field><Field label="진행 상태"><select name="status" defaultValue={editingMeeting?.status??'예정'}>{['예정','진행 중','완료','취소'].map(x=><option key={x}>{x}</option>)}</select></Field></div><div className="form-actions">{cancel}<button className="primary" type="submit">{editingMeeting?'수정 내용 저장':'회의 등록'}</button></div></form></section>}
      {tab==='meetings'&&sub==='agendas'&&<section><div className="sectionhead"><h2>안건 관리 <span className="muted">{filteredAgendas.length}건</span></h2><button className="primary" onClick={()=>navigate('meetings','agendaForm')}><Plus size={16}/>안건 등록</button></div><div className="filters">{meetingPicker(true)}{search}</div><DataTable headers={['번호','안건명','대지 위치','회의','이전 안건','결과','관리']} rows={filteredAgendas.map(x=>[x.id,x.title,x.location,meetings.find(m=>m.id===x.meetingId)?.title??'',x.previousId?`#${x.previousId}`:'없음',<Badge key="result">{x.result}</Badge>,actionButtons('agendas',x.id,x.title)])}/></section>}
      {tab==='meetings'&&sub==='agendaForm'&&<section><h2>{editingAgenda?'안건 정보 수정':'새 안건 등록'}</h2>{!meetings.length?<Empty>먼저 <button onClick={()=>navigate('meetings','form')}>회의를 등록</button>하세요.</Empty>:<form key={`agenda-${editId}`} onSubmit={submitAgenda} onChange={()=>setDirty(true)}><div className="form-grid"><Field label="안건명 *"><input name="title" defaultValue={editingAgenda?.title} required maxLength={200}/></Field><Field label="대지 위치 *"><input name="location" defaultValue={editingAgenda?.location} required maxLength={200}/></Field><Field label="상정 회의 *"><select name="meetingId" defaultValue={editingAgenda?.meetingId??selectedMeeting?.id??meetings[0].id}>{meetings.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></Field><Field label="심의 결과"><select name="result" defaultValue={editingAgenda?.result??'심의 전'}>{results.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="이전 안건 연결"><select name="previousId" defaultValue={editingAgenda?.previousId??''}><option value="">연결 안 함</option>{agendas.filter(x=>x.id!==editId).map(x=><option key={x.id} value={x.id}>#{x.id} {x.title}</option>)}</select></Field></div><p className="hint">재심의 안건은 이전 안건을 연결하세요. 순환 연결은 저장할 수 없습니다.</p><div className="form-actions">{cancel}<button className="primary" type="submit">{editingAgenda?'수정 내용 저장':'안건 등록'}</button></div></form>}</section>}

      {tab==='invites'&&<section><div className="sectionhead"><h2>{sub==='attendance'?'실제 참석 확정':'위원 섭외 관리'}</h2><button onClick={()=>csv('섭외참석현황',[['회의','위원','섭외 상태','실제 참석'],...meetingInvites.map(i=>[selectedMeeting?.title??'',members.find(m=>m.id===i.memberId)?.name??'',i.status,i.confirmed?(i.attended?'참석':'불참'):'미확정'])])}><Download size={16}/>CSV 내보내기</button></div><div className="filters">{meetingPicker()}{search}<select aria-label="섭외 상태 필터" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{['전체','미섭외',...inviteStatuses].map(x=><option key={x}>{x}</option>)}</select></div><p className="hint">모든 위원을 검색해 섭외할 수 있습니다. 참석 수락 후 실제 참석을 확정하세요. 분야·소속 위원회 및 이해충돌은 관리자가 확인해야 합니다.</p>{!selectedMeeting?<Empty>회의를 먼저 등록하세요.</Empty>:<><div className="summary-line">섭외 {meetingInvites.length}명 · 수락 {meetingInvites.filter(x=>x.status==='참석 수락').length}명 · 참석 확정 {meetingInvites.filter(x=>x.confirmed&&x.attended).length}명</div><DataTable headers={['위원','소속·연락처','전문 분야·위원회','섭외 상태',...(sub==='attendance'?['실제 참석']:[])]} rows={members.filter(m=>matches(m.name,m.organization,m.fields.join(' '))&&(statusFilter==='전체'||(meetingInvites.find(x=>x.memberId===m.id)?.status??'미섭외')===statusFilter)).map(m=>{
        const invite=meetingInvites.find(x=>x.memberId===m.id);
        return [m.name,<div key="contact">{m.organization}<small className="cell-note">{m.phone||'연락처 미등록'}</small></div>,<div key="fields">{m.fields.join(', ')}<small className="cell-note">{m.committees.join(', ')}</small></div>,<select key="status" aria-label={`${m.name} 섭외 상태`} value={invite?.status??''} onChange={e=>change(()=>changeInvite(data,meetingId,m.id,{status:e.target.value as typeof inviteStatuses[number]}))}><option value="" disabled>미섭외</option>{inviteStatuses.map(x=><option key={x}>{x}</option>)}</select>,...(sub==='attendance'?[<select key="attendance" aria-label={`${m.name} 실제 참석`} disabled={!invite||invite.status!=='참석 수락'} value={invite?.confirmed?(invite.attended?'참석':'불참'):'미확정'} onChange={e=>change(()=>changeInvite(data,meetingId,m.id,{confirmed:e.target.value!=='미확정',attended:e.target.value==='참석'}))}><option>미확정</option><option>참석</option><option>불참</option></select>]:[])];
      })}/></>}</section>}

      {tab==='results'&&<section><div className="sectionhead"><h2>안건별 심의 결과</h2><button onClick={()=>csv('심의결과',[['회의','안건','대지 위치','결과'],...filteredAgendas.map(x=>[meetings.find(m=>m.id===x.meetingId)?.title??'',x.title,x.location,x.result])])}><Download size={16}/>CSV 내보내기</button></div><div className="filters">{meetingPicker(true)}{search}</div><DataTable headers={['안건','대지 위치','이전 안건','심의 결과']} rows={filteredAgendas.map(a=>[a.title,a.location,a.previousId?`#${a.previousId}`:'없음',<select key="result" aria-label={`${a.title} 심의 결과`} value={a.result} onChange={e=>save({...data,agendas:agendas.map(x=>x.id===a.id?{...x,result:e.target.value}:x)})}>{results.map(x=><option key={x}>{x}</option>)}</select>])}/></section>}

      {tab==='allowances'&&<section><div className="sectionhead"><h2>수당 지급 관리</h2><button onClick={()=>csv('수당지급내역',[['회의','위원','지급액','지급 상태'],...allowances.filter(x=>x.meetingId===meetingId).map(x=>[selectedMeeting?.title??'',members.find(m=>m.id===x.memberId)?.name??'',x.amount,x.paid?'지급 완료':'지급 대기'])])}><Download size={16}/>CSV 내보내기</button></div><div className="filters">{meetingPicker()}</div><p className="hint">실제 참석 확정자가 표시됩니다. 금액 입력 후 저장을 누르세요. 지급 기준에 따른 금액은 관리자가 확인해 입력합니다.</p><div className="summary-line">선택 회의 지급 완료 합계 <strong>{allowances.filter(x=>x.meetingId===meetingId&&x.paid).reduce((sum,x)=>sum+x.amount,0).toLocaleString()}원</strong></div><div className="allowance-list">{meetingInvites.filter(x=>x.confirmed&&x.attended).map(i=>{const a=allowances.find(x=>x.meetingId===meetingId&&x.memberId===i.memberId);const member=members.find(x=>x.id===i.memberId)!;return <AllowanceRow key={`${meetingId}-${i.memberId}-${a?.amount}-${a?.paid}`} name={member.name} amount={a?.amount??0} paid={a?.paid??false} onDirty={value=>setPendingAllowances(old=>({...old,[i.memberId]:value}))} onSave={(amount,isPaid)=>change(()=>changeAllowance(data,meetingId,i.memberId,amount,isPaid),'수당 내역을 저장했습니다.')}/>;})}{!meetingInvites.some(x=>x.confirmed&&x.attended)&&<Empty>참석 확정자가 없습니다. <button onClick={()=>navigate('invites','attendance')}>참석 확정</button>에서 실제 참석을 먼저 기록하세요.</Empty>}</div></section>}

      {tab==='stats'&&<><div className="cards"><Metric label="남성 위원" value={`${members.filter(x=>x.gender==='남').length}명`}/><Metric label="여성 위원" value={`${members.filter(x=>x.gender==='여').length}명`}/><Metric label="누적 확정 참석" value={`${attended.length}건`}/><Metric label="지급 완료 합계" value={`${paid.toLocaleString()}원`}/></div><section><h2>전문 분야별 구성</h2>{fields.map(f=>{const count=members.filter(x=>x.fields.includes(f)).length;return <div className="barrow" key={f}><span>{f}</span><div className="bar"><div style={{width:`${members.length?count/members.length*100:0}%`}}/></div><b>{count}명</b></div>;})}<p className="hint">복수 전문 분야는 중복 집계됩니다. 참석 통계는 새로 확정한 참석 기록을 기준으로 합니다.</p></section></>}

      {tab==='settings'&&<><section><h2>백업·복원</h2><p>위원, 회의, 안건, 섭외·참석, 수당을 하나의 JSON 파일로 백업합니다. 브라우저 데이터를 지우거나 다른 기기로 이동하기 전에 백업하세요.</p><div className="backup-summary"><span>위원 <b>{members.length}명</b></span><span>회의 <b>{meetings.length}건</b></span><span>안건 <b>{agendas.length}건</b></span></div><div className="actions"><button className="primary" onClick={()=>download(`세종시건축위원회-백업-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(data,null,2),'application/json')}><Download size={16}/>전체 데이터 백업</button><button onClick={()=>fileInput.current?.click()}>백업 파일 복원</button><input ref={fileInput} aria-label="백업 파일 선택" hidden type="file" accept=".json,application/json" onChange={e=>void restore(e.target.files?.[0])}/></div><p className="hint">복원 전 현재 내용을 백업하세요. 형식과 데이터 간 연결을 검증한 뒤 전체 데이터를 교체합니다.</p></section><section><h2>저장 범위 안내</h2><p>{cloud?'Supabase 로그인과 관리자 승인 목록으로 공유 데이터를 관리합니다. 백업 복원은 공유 DB 전체를 교체하므로 작업 전에 반드시 백업하세요. 변경 이력과 자동 백업 정책은 별도 운영 설정이 필요합니다.':'현재는 관리자 입력 흐름을 확인하는 브라우저 저장 버전입니다. 로그인, 접근 권한, 서버 데이터베이스와 감사 이력은 연결되어 있지 않습니다. 실제 개인정보·심의 자료는 입력하지 마세요.'}</p></section></>}
      </>}
      <footer>세종시 건축위원회 · {cloud?'승인된 관리자 전용 · Supabase DB 저장':'관리자 기능 미리보기 · 실제 업무 사용 전 로그인과 서버 저장소 연결 필요'}</footer>
    </main>{saving&&<div className="save-blocker" role="status">변경 내용을 저장하고 있습니다…</div>}
  </div>;
}

function Metric({label,value}:{label:string;value:string}) {return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;}
function Field({label,children}:{label:string;children:ReactNode}) {return <label className="form-field"><span>{label}</span>{children}</label>;}
function ChoiceGroup({label,name,options,selected}:{label:string;name:string;options:string[];selected:string[]}) {return <fieldset className="choice-group"><legend>{label}</legend><div>{options.map(x=><label key={x}><input type="checkbox" name={name} value={x} defaultChecked={selected.includes(x)}/>{x}</label>)}</div></fieldset>;}
function Empty({children}:{children:ReactNode}) {return <div className="empty">{children}</div>;}
function Badge({children}:{children:ReactNode}) {return <span className="badge">{children}</span>;}
function DataTable({headers,rows,empty='조건에 맞는 데이터가 없습니다. 검색 조건을 바꾸거나 새 항목을 등록하세요.'}:{headers:string[];rows:ReactNode[][];empty?:string}) {
  const [page,setPage]=useState(1); const pageSize=15, pages=Math.max(1,Math.ceil(rows.length/pageSize));
  const current=Math.min(page,pages);
  const signature=JSON.stringify(rows.map(row=>row.slice(0,2).map(x=>typeof x==='string'||typeof x==='number'?x:typeof x)));
  useEffect(()=>setPage(1),[signature]);
  return <><div className="tablewrap"><table><thead><tr>{headers.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.slice((current-1)*pageSize,current*pageSize).map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody></table>{!rows.length&&<Empty>{empty}</Empty>}</div>{rows.length>0&&<div className="pagination"><span>총 {rows.length}건 · {current} / {pages} 페이지</span><div className="actions"><button disabled={current===1} onClick={()=>setPage(current-1)}>이전</button><button disabled={current===pages} onClick={()=>setPage(current+1)}>다음</button></div></div>}</>;
}
function AllowanceRow({name,amount,paid,onSave,onDirty}:{name:string;amount:number;paid:boolean;onSave:(amount:number,paid:boolean)=>Promise<boolean>;onDirty:(value:boolean)=>void}) {
  const [draft,setDraft]=useState(String(amount)),[checked,setChecked]=useState(paid);
  const changed=draft!==String(amount)||checked!==paid;
  return <form className="allowance-row" onSubmit={async e=>{e.preventDefault();if(await onSave(draft.trim()?Number(draft):NaN,checked)) onDirty(false);}}><strong>{name}</strong><Field label={`${name} 지급액 (원)`}><input aria-label={`${name} 지급액`} type="number" min="0" step="1" required value={draft} onChange={e=>{setDraft(e.target.value);onDirty(e.target.value!==String(amount)||checked!==paid);}}/></Field><label className="check-label"><input type="checkbox" checked={checked} onChange={e=>{setChecked(e.target.checked);onDirty(draft!==String(amount)||e.target.checked!==paid);}}/>지급 완료</label><button type="submit" className={changed?'primary':''} disabled={!changed}>저장</button>{changed&&<span className="hint">미저장</span>}</form>;
}
