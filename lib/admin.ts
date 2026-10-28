import type {Member, Meeting, Agenda} from './mock';

export const inviteStatuses = ['확인 중', '참석 수락', '참석 불가', '연락 안 됨', '수락 후 취소'] as const;
export const results = ['심의 전', '원안 의결', '조건부 의결', '부결', '재심의·보류'];
export type Invite = {meetingId:number; memberId:number; status:typeof inviteStatuses[number]; confirmed:boolean; attended:boolean};
export type Allowance = {meetingId:number; memberId:number; amount:number; paid:boolean};
export type AdminData = {version:1; members:Member[]; meetings:Meeting[]; agendas:Agenda[]; invites:Invite[]; allowances:Allowance[]};
export const STORAGE_KEY = 'sejong-committee-admin-v1';
export const nextId = (items:{id:number}[]) => Math.max(0, ...items.map(x => x.id)) + 1;
export const isDate = (value:string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;

export function removeRecord(data:AdminData, kind:'members'|'meetings'|'agendas', id:number):AdminData {
  if (kind === 'members' && (data.invites.some(x => x.memberId === id) || data.allowances.some(x => x.memberId === id))) throw new Error('섭외·참석 또는 수당 기록이 있는 위원은 삭제할 수 없습니다.');
  if (kind === 'meetings' && (data.agendas.some(x => x.meetingId === id) || data.invites.some(x => x.meetingId === id) || data.allowances.some(x => x.meetingId === id))) throw new Error('연결된 안건·섭외·수당 기록이 있는 회의는 삭제할 수 없습니다.');
  if (kind === 'agendas' && data.agendas.some(x => x.previousId === id)) throw new Error('다른 안건의 이전 안건으로 연결되어 삭제할 수 없습니다.');
  return {...data, [kind]:data[kind].filter(x => x.id !== id)};
}

export function changeInvite(data:AdminData, meetingId:number, memberId:number, patch:Partial<Invite>):AdminData {
  if (!data.meetings.some(x=>x.id===meetingId) || !data.members.some(x=>x.id===memberId)) throw new Error('회의와 위원을 먼저 선택하세요.');
  const old = data.invites.find(x=>x.meetingId===meetingId && x.memberId===memberId);
  const updated:Invite = {...(old ?? {meetingId,memberId,status:'확인 중',confirmed:false,attended:false}), ...patch, meetingId, memberId};
  if (patch.status && patch.status !== '참석 수락') {updated.confirmed=false; updated.attended=false;}
  if (updated.attended && !updated.confirmed) throw new Error('참석 여부를 확정해 주세요.');
  if (updated.confirmed && updated.attended && updated.status !== '참석 수락') throw new Error('참석 수락 상태에서만 참석 확정할 수 있습니다.');
  if (updated.status !== '참석 수락') {updated.confirmed=false; updated.attended=false;}
  const allowance = data.allowances.find(x=>x.meetingId===meetingId && x.memberId===memberId);
  if (allowance?.paid && (!updated.confirmed || !updated.attended)) throw new Error('지급 완료 기록이 있습니다. 지급 완료를 해제한 뒤 참석을 변경하세요.');
  return {...data, invites:[...data.invites.filter(x=>!(x.meetingId===meetingId && x.memberId===memberId)), updated], allowances: updated.confirmed && updated.attended ? data.allowances : data.allowances.filter(x=>!(x.meetingId===meetingId && x.memberId===memberId))};
}

export function changeAllowance(data:AdminData, meetingId:number, memberId:number, amount:number, paid:boolean):AdminData {
  if (!data.invites.some(x=>x.meetingId===meetingId && x.memberId===memberId && x.confirmed && x.attended)) throw new Error('실제 참석이 확정된 위원만 수당을 등록할 수 있습니다.');
  if (!Number.isSafeInteger(amount) || amount < 0 || (paid && amount === 0)) throw new Error('지급액은 0 이상의 정수이며, 지급 완료 시에는 1원 이상이어야 합니다.');
  return {...data, allowances:[...data.allowances.filter(x=>!(x.meetingId===meetingId && x.memberId===memberId)), {meetingId,memberId,amount,paid}]};
}

// Validate stored data and imported backups before replacing the current workspace.
export function parseData(value:unknown):AdminData {
  const fail = () => {throw new Error('저장 파일의 형식 또는 연결된 데이터가 올바르지 않습니다.');};
  if (!value || typeof value !== 'object') return fail();
  const d = value as AdminData;
  if (d.version !== 1 || !['members','meetings','agendas','invites','allowances'].every(k=>Array.isArray((d as unknown as Record<string,unknown>)[k]))) return fail();
  const text = (v:unknown) => typeof v === 'string';
  const strings = (v:unknown):v is string[] => Array.isArray(v) && v.every(text);
  const integer = (v:unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
  for (const rows of [d.members,d.meetings,d.agendas]) if (rows.some(x=>!x || !Number.isSafeInteger(x.id) || x.id<=0) || new Set(rows.map(x=>x.id)).size !== rows.length) return fail();
  if (d.members.some(x=>!text(x.name)||!x.name.trim()||!text(x.organization)||!x.organization.trim()||!text(x.phone)||!text(x.term)||!['남','여'].includes(x.gender)||!strings(x.fields)||!x.fields.length||!strings(x.committees)||!x.committees.length||!integer(x.attended)||!integer(x.invites))) return fail();
  if (d.meetings.some(x=>!text(x.title)||!x.title.trim()||!text(x.date)||!isDate(x.date)||!text(x.type)||!['대면','서면'].includes(x.mode)||!['예정','진행 중','완료','취소'].includes(x.status))) return fail();
  if (d.agendas.some(x=>!text(x.title)||!x.title.trim()||!text(x.location)||!results.includes(x.result)||!d.meetings.some(m=>m.id===x.meetingId)||(x.previousId!==undefined && (!d.agendas.some(a=>a.id===x.previousId)||x.previousId===x.id)))) return fail();
  for (const agenda of d.agendas) {
    const seen = new Set<number>([agenda.id]); let previous = agenda.previousId;
    while (previous !== undefined) {if (seen.has(previous)) return fail(); seen.add(previous); previous=d.agendas.find(x=>x.id===previous)?.previousId;}
  }
  for (const rows of [d.invites,d.allowances]) {
    if (rows.some(x=>!x||!d.members.some(m=>m.id===x.memberId)||!d.meetings.some(m=>m.id===x.meetingId))) return fail();
    if (new Set(rows.map(x=>`${x.meetingId}:${x.memberId}`)).size !== rows.length) return fail();
  }
  if (d.invites.some(x=>!inviteStatuses.includes(x.status)||typeof x.confirmed!=='boolean'||typeof x.attended!=='boolean'||(x.attended&&!x.confirmed)||(x.confirmed&&x.status!=='참석 수락'))) return fail();
  if (d.allowances.some(x=>!integer(x.amount)||typeof x.paid!=='boolean'||(x.paid&&x.amount===0)||!d.invites.some(i=>i.meetingId===x.meetingId&&i.memberId===x.memberId&&i.confirmed&&i.attended))) return fail();
  return d;
}
