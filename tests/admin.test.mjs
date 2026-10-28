import test from 'node:test';
import assert from 'node:assert/strict';
import {parseData, removeRecord, changeInvite, changeAllowance, nextId, isDate} from '../lib/admin.ts';

function fixture() {
  return {version:1,members:[{id:1,name:'테스트 위원',gender:'남',organization:'테스트 소속',phone:'',term:'2026-01-01 ~ 2027-01-01',fields:['건축계획'],committees:['일반 건축위원회'],attended:0,invites:0}],meetings:[{id:1,title:'테스트 회의',date:'2026-11-05',type:'일반 건축위원회',mode:'대면',status:'예정'}],agendas:[],invites:[],allowances:[]};
}
const attending = () => changeInvite(fixture(),1,1,{status:'참석 수락',confirmed:true,attended:true});

test('백업을 JSON으로 왕복 복원하고 빈 데이터도 허용한다',()=>{
  const data=attending();assert.deepEqual(parseData(JSON.parse(JSON.stringify(data))),data);
  assert.equal(parseData({version:1,members:[],meetings:[],agendas:[],invites:[],allowances:[]}).members.length,0);
  assert.equal(nextId([]),1);assert.equal(isDate('2026-02-30'),false);assert.equal(isDate('2028-02-29'),true);
});
test('관계가 없는 항목은 삭제할 수 있고 연결된 위원과 회의는 보호한다',()=>{
  assert.equal(removeRecord(fixture(),'members',1).members.length,0);
  assert.throws(()=>removeRecord(attending(),'members',1),/삭제할 수 없습니다/);
  assert.throws(()=>removeRecord(attending(),'meetings',1),/삭제할 수 없습니다/);
});
test('참석 확정 전에는 수당 등록을 허용하지 않는다',()=>{
  assert.throws(()=>changeAllowance(fixture(),1,1,100000,false),/참석이 확정/);
  assert.throws(()=>changeInvite(fixture(),1,1,{confirmed:true,attended:true}),/참석 수락/);
  assert.throws(()=>changeInvite(fixture(),999,1,{status:'확인 중'}),/회의와 위원/);
});
test('지급액은 정수이고 지급 완료를 해제해야 참석을 바꿀 수 있다',()=>{
  for(const amount of [-1,0.5,Infinity,NaN]) assert.throws(()=>changeAllowance(attending(),1,1,amount,false));
  assert.throws(()=>changeAllowance(attending(),1,1,0,true));
  const paid=changeAllowance(attending(),1,1,100000,true);
  assert.throws(()=>changeInvite(paid,1,1,{status:'수락 후 취소'}),/지급 완료/);
  const unpaid=changeAllowance(paid,1,1,100000,false);
  const canceled=changeInvite(unpaid,1,1,{status:'수락 후 취소'});
  assert.equal(canceled.invites[0].attended,false);assert.equal(canceled.allowances.length,0);
  assert.equal(paid.allowances[0].paid,true,'원본 상태는 변경하지 않음');
});
test('중복 ID, 참조 누락, 잘못된 날짜와 안건 순환이 있는 백업을 거부한다',()=>{
  const duplicate=fixture();duplicate.members.push({...duplicate.members[0]});assert.throws(()=>parseData(duplicate));
  const orphan=fixture();orphan.invites=[{meetingId:99,memberId:1,status:'확인 중',confirmed:false,attended:false}];assert.throws(()=>parseData(orphan));
  const invalidDate=fixture();invalidDate.meetings[0].date='2026-02-30';assert.throws(()=>parseData(invalidDate));
  const cycle=fixture();cycle.agendas=[{id:1,title:'첫 안건',location:'위치',meetingId:1,result:'심의 전',previousId:2},{id:2,title:'두번째 안건',location:'위치',meetingId:1,result:'심의 전',previousId:1}];assert.throws(()=>parseData(cycle));
  cycle.agendas[1].previousId=undefined;assert.equal(parseData(cycle).agendas.length,2);
  assert.throws(()=>removeRecord(cycle,'agendas',2),/이전 안건/);
});
test('수당만 있는 백업이나 중복 섭외 기록을 거부한다',()=>{
  const orphanPayment=fixture();orphanPayment.allowances=[{meetingId:1,memberId:1,amount:100000,paid:false}];assert.throws(()=>parseData(orphanPayment));
  const duplicate=attending();duplicate.invites.push({...duplicate.invites[0]});assert.throws(()=>parseData(duplicate));
  assert.throws(()=>parseData(null));assert.throws(()=>parseData({version:2}));
});
