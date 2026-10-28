// Optional SQL integration test. PGLITE_MODULE points to an external @electric-sql/pglite installation.
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const db=new PGlite();
  const admin='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002';
  try {
    await db.exec(`create role anon;create role authenticated;create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth,public to authenticated,anon;
      insert into auth.users values ('${admin}'),('${other}');`);
    const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/001_committee_workspace.sql'),'utf8');
    await db.exec(migration);await db.exec(migration);
    const payload={version:1,members:[],meetings:[],agendas:[],invites:[],allowances:[]};
    await db.exec('set role anon');
    await assert.rejects(()=>db.query('select * from public.committee_workspace'),error=>error.code==='42501');
    await assert.rejects(()=>db.query('select public.save_committee_workspace(0,$1::jsonb)',[JSON.stringify(payload)]),error=>error.code==='42501');
    await db.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${other}'`);
    assert.equal((await db.query('select * from public.committee_workspace')).rows.length,0);
    await assert.rejects(()=>db.query('insert into public.committee_admins(user_id) values ($1)',[other]),error=>error.code==='42501');
    await assert.rejects(()=>db.query('select public.save_committee_workspace(0,$1::jsonb)',[JSON.stringify(payload)]),error=>error.code==='42501');
    await db.exec(`reset role;insert into public.committee_admins(user_id) values ('${admin}');set role authenticated;set request.jwt.claim.sub='${admin}'`);
    assert.equal((await db.query('select * from public.committee_workspace')).rows.length,1);
    assert.equal((await db.query('select * from public.committee_admins')).rows.length,1);
    const result=await db.query('select public.save_committee_workspace(0,$1::jsonb) as saved',[JSON.stringify(payload)]);
    assert.equal(result.rows[0].saved.revision,1);assert.equal(result.rows[0].saved.updated_by,admin);
    await assert.rejects(()=>db.query('select public.save_committee_workspace(0,$1::jsonb)',[JSON.stringify(payload)]),error=>error.code==='40001');
    await assert.rejects(()=>db.query('select public.save_committee_workspace(1,$1::jsonb)',['{}']),error=>error.code==='22023');
    await assert.rejects(()=>db.query('update public.committee_workspace set revision=100'),error=>error.code==='42501');
    await db.exec(`reset role;delete from public.committee_admins where user_id='${admin}';set role authenticated;set request.jwt.claim.sub='${admin}'`);
    assert.equal((await db.query('select * from public.committee_workspace')).rows.length,0);
    await assert.rejects(()=>db.query('select public.save_committee_workspace(1,$1::jsonb)',[JSON.stringify(payload)]),error=>error.code==='42501');
    console.log('PASS: SQL rerun, anonymous denial, non-admin denial, self-escalation denial, approved admin read/write, revision conflict, malformed payload rejection, direct-write denial, access revocation');
  } finally {await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
