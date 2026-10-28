// Run against a test server configured with https://committee-test.supabase.co and a dummy publishable key.
// This intercepts every Supabase request; it does not connect to a real project.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
  const id='00000000-0000-0000-0000-000000000001';
  const user={id,email:'admin@example.test',aud:'authenticated',role:'authenticated',created_at:new Date().toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[]};
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated',aud:'authenticated',email:user.email})+'.test';
  let approved=false,readFailure=false,reads=0,writes=0;
  let row={data:{version:1,members:[],meetings:[],agendas:[],invites:[],allowances:[]},revision:0,updated_at:new Date().toISOString()};
  await page.route('https://committee-test.supabase.co/**',async route=>{
    const request=route.request(),url=new URL(request.url());
    const reply=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    if(request.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    if(url.pathname==='/auth/v1/token') return reply(200,{access_token:token,refresh_token:'test-refresh-token',expires_in:3600,token_type:'bearer',user});
    if(url.pathname==='/auth/v1/user') return reply(200,user);
    if(url.pathname==='/auth/v1/logout') return route.fulfill({status:204});
    if(url.pathname==='/rest/v1/committee_admins') return reply(200,approved?[{user_id:id}]:[]);
    if(url.pathname==='/rest/v1/committee_workspace') {reads++;return readFailure?reply(403,{code:'42501',message:'Denied'}):reply(200,row);}
    if(url.pathname==='/rest/v1/rpc/save_committee_workspace') {
      const body=request.postDataJSON();
      if(body.expected_revision!==row.revision) return reply(409,{code:'40001',message:'Workspace changed'});
      writes++;row={data:body.next_data,revision:row.revision+1,updated_at:new Date().toISOString()};return reply(200,row);
    }
    throw new Error('Unexpected test request: '+request.method()+' '+url.pathname);
  });
  const main=page.locator('main');
  const login=async()=>{await page.getByLabel('이메일',{exact:true}).fill(user.email);await page.getByLabel('비밀번호',{exact:true}).fill('Test-password-only');await page.getByRole('button',{name:'로그인',exact:true}).click();};
  try {
    await page.goto(process.env.TEST_URL||'http://localhost:3101');
    await page.getByRole('heading',{name:'관리자 로그인',exact:true}).waitFor();
    assert.equal(await main.count(),0);
    await login();await page.getByRole('alert').filter({hasText:'관리자로 승인되지 않은 계정'}).waitFor();
    assert.equal(reads,0);
    await page.getByRole('button',{name:'로그아웃',exact:true}).click();
    approved=true;await login();
    await main.getByRole('heading',{name:'업무 현황',exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('sejong-committee-admin-v1')),null);
    const nav=page.getByRole('navigation');
    await nav.getByRole('button',{name:'회의·안건',exact:true}).click();
    await nav.getByRole('button',{name:'회의 등록',exact:true}).click();
    await main.getByLabel('회의명 *',{exact:true}).fill('DB 저장 테스트');
    await main.getByLabel('개최일 *',{exact:true}).fill('2026-12-01');
    await main.getByRole('button',{name:'회의 등록',exact:true}).click();
    await main.getByRole('heading',{name:'회의 일정',exact:true}).waitFor();
    assert.equal(writes,1);assert.equal(row.data.meetings[0].title,'DB 저장 테스트');
    await page.reload();await main.getByRole('heading',{name:'업무 현황',exact:true}).waitFor();
    await nav.getByRole('button',{name:'회의·안건',exact:true}).click();
    await main.getByText('DB 저장 테스트',{exact:true}).waitFor();
    await nav.getByRole('button',{name:'회의 등록',exact:true}).click();
    await main.getByLabel('회의명 *',{exact:true}).fill('충돌 테스트');
    await main.getByLabel('개최일 *',{exact:true}).fill('2026-12-02');
    row.revision++;
    await main.getByRole('button',{name:'회의 등록',exact:true}).click();
    await main.getByRole('status').filter({hasText:'다른 관리자가 먼저 저장'}).waitFor();
    assert.equal(writes,1);assert.equal(row.data.meetings.length,1);
    assert.equal(await main.getByLabel('회의명 *',{exact:true}).inputValue(),'충돌 테스트');
    await page.setViewportSize({width:390,height:844});
    await main.getByRole('button',{name:'로그아웃',exact:true}).click();
    await page.getByRole('heading',{name:'관리자 로그인',exact:true}).waitFor();
    readFailure=true;await login();
    await page.getByRole('alert').filter({hasText:'DB를 읽지 못했습니다'}).waitFor();
    assert.equal(await main.count(),0,'DB failure must not fall back to a local workspace');
    assert.deepEqual(errors,[]);
    console.log('PASS: cloud login gate, unapproved account denial, shared save/reload, no browser data copy, stale write rejection, mobile logout, fail-closed database read');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
