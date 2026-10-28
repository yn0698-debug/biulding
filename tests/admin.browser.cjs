// Optional end-to-end check: set PLAYWRIGHT_MODULE to an installed Playwright module.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  const main=page.locator('main'),nav=page.getByRole('navigation');
  const clickNav=async label=>nav.getByRole('button',{name:label,exact:true}).click();
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('sejong-committee-admin-v1')));
  const search=async value=>main.getByRole('textbox',{name:'검색',exact:true}).fill(value);
  try {
    await page.goto(process.env.TEST_URL||'http://localhost:3100');
    await main.getByRole('heading',{name:'업무 현황',exact:true}).waitFor();
    await clickNav('위원 관리');await clickNav('위원 등록');
    await main.getByLabel('성명 *',{exact:true}).fill('테스트운영위원');
    await main.getByLabel('소속 *',{exact:true}).fill('테스트 사무소');
    await main.getByLabel('연락처',{exact:true}).fill('010-0000-9999');
    await main.getByLabel('임기 시작일 *',{exact:true}).fill('2026-01-01');
    await main.getByLabel('임기 종료일 *',{exact:true}).fill('2027-12-31');
    await main.getByLabel('건축계획',{exact:true}).check();
    await main.getByLabel('일반 건축위원회',{exact:true}).check();
    await main.getByRole('button',{name:'위원 등록',exact:true}).click();
    await search('테스트운영위원');
    assert.equal(await main.locator('tbody tr').count(),1);
    await main.getByRole('button',{name:'테스트운영위원 수정',exact:true}).click();
    await main.getByLabel('성명 *',{exact:true}).fill('테스트관리위원');
    await main.getByRole('button',{name:'수정 내용 저장',exact:true}).click();
    await page.reload();await main.getByRole('heading',{name:'업무 현황',exact:true}).waitFor();
    assert.equal((await stored()).members.length,101);
    assert.ok((await stored()).members.some(x=>x.name==='테스트관리위원'));

    await clickNav('회의·안건');await clickNav('회의 등록');
    await main.getByLabel('회의명 *',{exact:true}).fill('운영 테스트 회의');
    await main.getByLabel('개최일 *',{exact:true}).fill('2026-12-01');
    await main.getByRole('button',{name:'회의 등록',exact:true}).click();
    await clickNav('안건 등록');
    await main.getByLabel('안건명 *',{exact:true}).fill('운영 테스트 안건');
    await main.getByLabel('대지 위치 *',{exact:true}).fill('가상동 1');
    await main.getByRole('button',{name:'안건 등록',exact:true}).click();
    const snapshot=await stored(),meeting=snapshot.meetings.find(x=>x.title==='운영 테스트 회의');
    assert.equal(snapshot.agendas.find(x=>x.title==='운영 테스트 안건').meetingId,meeting.id);
    // The all-meetings filter must remain selected, rather than reverting to the first meeting.
    await main.getByRole('combobox',{name:'회의 선택',exact:true}).selectOption('0');
    assert.equal(await main.getByRole('combobox',{name:'회의 선택',exact:true}).inputValue(),'0');

    await clickNav('위원 섭외·참석');
    await main.getByRole('combobox',{name:'회의 선택',exact:true}).selectOption(String(meeting.id));
    await search('테스트관리위원');
    await main.getByRole('combobox',{name:'테스트관리위원 섭외 상태',exact:true}).selectOption('참석 수락');
    await clickNav('참석 확정');await search('테스트관리위원');
    await main.getByRole('combobox',{name:'테스트관리위원 실제 참석',exact:true}).selectOption('참석');
    await clickNav('수당 관리');
    await main.getByRole('spinbutton',{name:'테스트관리위원 지급액',exact:true}).fill('100000');
    await main.getByRole('checkbox',{name:'지급 완료',exact:true}).check();
    await main.getByRole('button',{name:'저장',exact:true}).click();
    assert.equal((await stored()).allowances[0].amount,100000);
    await clickNav('위원 섭외·참석');await clickNav('참석 확정');await search('테스트관리위원');
    await main.getByRole('combobox',{name:'테스트관리위원 실제 참석',exact:true}).selectOption('미확정');
    await main.getByRole('status').filter({hasText:'지급 완료 기록'}).waitFor();
    assert.equal((await stored()).invites[0].attended,true);
    await clickNav('위원 관리');await search('테스트관리위원');
    await main.getByRole('button',{name:'테스트관리위원 삭제',exact:true}).click();
    await main.getByRole('status').filter({hasText:'삭제할 수 없습니다'}).waitFor();

    await clickNav('데이터 관리');
    const downloadEvent=page.waitForEvent('download');
    await main.getByRole('button',{name:'전체 데이터 백업',exact:true}).click();
    const backup=await downloadEvent;
    await page.locator('input[type=file]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"version":2}')});
    await main.getByRole('status').filter({hasText:'복원하지 못했습니다'}).waitFor();
    assert.equal((await stored()).members.length,101);
    await page.locator('input[type=file]').setInputFiles(await backup.path());
    await main.getByRole('status').filter({hasText:'백업을 복원했습니다'}).waitFor();
    assert.equal((await stored()).allowances[0].paid,true);
    // A second tab must prevent stale writes in this tab.
    const other=await context.newPage();await other.goto(process.env.TEST_URL||'http://localhost:3100');
    await other.evaluate(()=>{const key='sejong-committee-admin-v1';const data=JSON.parse(localStorage.getItem(key));data.members[0].organization='다른 탭 변경';localStorage.setItem(key,JSON.stringify(data));});
    await main.getByRole('alert').filter({hasText:'다른 탭'}).waitFor();await other.close();
    await page.reload();await main.getByRole('heading',{name:'업무 현황',exact:true}).waitFor();
    await clickNav('위원 관리');
    if(process.env.SCREENSHOT_PATH) await page.screenshot({path:process.env.SCREENSHOT_PATH,fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'mobile viewport must not overflow');
    await page.setViewportSize({width:1440,height:1000});
    await clickNav('위원 등록');
    await main.getByLabel('성명 *',{exact:true}).fill('버릴 입력');
    await clickNav('위원 등록');
    assert.equal(await main.getByLabel('성명 *',{exact:true}).inputValue(),'');
    // Empty workspaces must support first-time entry without dangling selections.
    await clickNav('데이터 관리');
    const empty={version:1,members:[],meetings:[],agendas:[],invites:[],allowances:[]};
    await page.locator('input[type=file]').setInputFiles({name:'empty.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(empty))});
    await main.getByRole('status').filter({hasText:'백업을 복원했습니다'}).waitFor();
    await clickNav('통계');
    assert.equal(await main.getByText('0명',{exact:true}).count(),10);
    await clickNav('위원 섭외·참석');await main.getByText('회의를 먼저 등록하세요.',{exact:true}).waitFor();
    await clickNav('회의·안건');await clickNav('회의 등록');
    await main.getByLabel('회의명 *',{exact:true}).fill('첫 회의');
    await main.getByLabel('개최일 *',{exact:true}).fill('2026-12-15');
    await main.getByRole('button',{name:'회의 등록',exact:true}).click();
    assert.equal((await stored()).meetings[0].id,1);
    await main.getByRole('button',{name:'첫 회의 삭제',exact:true}).click();
    assert.equal((await stored()).meetings.length,0);
    // Corrupt local data is preserved until the operator explicitly restores a backup.
    await page.evaluate(()=>localStorage.setItem('sejong-committee-admin-v1','broken-data'));
    await page.reload();
    await main.getByRole('alert').filter({hasText:'저장된 데이터를 읽지 못했습니다'}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('sejong-committee-admin-v1')),'broken-data');
    await clickNav('데이터 관리');
    await page.locator('input[type=file]').setInputFiles(await backup.path());
    await main.getByRole('status').filter({hasText:'백업을 복원했습니다'}).waitFor();
    assert.equal((await stored()).members.length,101);
    assert.deepEqual(errors,[]);
    console.log('PASS: member create/edit, persistence, meeting/agenda links, attendance, payment, deletion protection, backup/restore, cross-tab guard, mobile layout');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
