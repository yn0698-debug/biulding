# Supabase 프로젝트 생성 및 연결

Supabase 환경 변수가 없으면 기존 브라우저 저장 모드로 실행됩니다. URL과 공개 키를 설정하면 관리자 로그인과 공유 DB 모드로 전환됩니다. 설정이 일부만 있거나 연결에 실패하면 브라우저 저장으로 우회하지 않고 오류를 표시합니다.

## 1. 프로젝트 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인합니다.
2. **New project**에서 조직을 선택하고 프로젝트 이름을 `sejong-committee` 등으로 입력합니다.
3. 데이터베이스 비밀번호를 정해 안전하게 보관합니다. 이 앱의 프런트엔드 설정에는 DB 비밀번호를 사용하지 않습니다.
4. 사용자와 가까운 리전을 선택하고 프로젝트를 생성합니다. 생성 완료까지 기다립니다.

## 2. 테이블과 권한 설치

1. 생성한 프로젝트의 **SQL Editor → New query**를 엽니다.
2. [migrations/001_committee_workspace.sql](migrations/001_committee_workspace.sql) 내용을 전체 복사해 붙여 넣고 **Run**을 누릅니다.
3. `committee_admins`와 `committee_workspace`가 생성됩니다. 초기 데이터는 비어 있습니다. 로컬 가상 데이터를 자동 업로드하지 않습니다.

SQL은 재실행해도 저장된 업무 데이터를 초기화하지 않습니다. 기존에 같은 이름의 테이블을 따로 만든 프로젝트보다는 새 프로젝트에서 시작하세요.

## 3. 관리자 계정 만들기와 승인

1. **Authentication → Users**에서 사용자 추가 기능으로 관리자 이메일·비밀번호 계정을 만듭니다. 직접 생성하는 경우 이메일 확인 상태도 확인하세요.
2. 생성된 사용자의 **User UID / UUID**를 복사합니다.
3. SQL Editor에서 아래 UUID를 실제 값으로 바꿔 실행합니다.

```sql
insert into public.committee_admins (user_id)
values ('여기에_사용자_UUID')
on conflict (user_id) do nothing;
```

Auth 계정 생성만으로 관리자 권한이 생기지 않습니다. `committee_admins`에 등록된 계정만 업무 데이터를 읽고 저장할 수 있습니다. 회원가입 화면은 제공하지 않습니다. Authentication 설정에서 공개 신규 가입도 끄고, 필요한 관리자만 직접 추가하세요.

관리자 권한 해제는 다음 SQL로 처리합니다. 해제한 계정은 DB 읽기·저장을 더 이상 할 수 없습니다. 이미 화면에 불러온 내용은 해당 세션이 종료되거나 새로고침될 때까지 보일 수 있습니다.

```sql
delete from public.committee_admins
where user_id = '권한을_해제할_사용자_UUID';
```

## 4. URL과 공개 키 확인

프로젝트의 **Connect** 또는 프로젝트 설정의 **API / API Keys**에서 다음 두 값을 확인합니다.

- Project URL: `https://프로젝트ID.supabase.co`
- Publishable key: `sb_publishable_...`

기존 프로젝트의 `anon` 공개 키도 지원합니다. **Secret key(`sb_secret_...`), `service_role` 키, DB 비밀번호는 코드·브라우저·채팅에 넣지 마세요.** 이 프로젝트는 서버 비밀 키 없이 로그인한 관리자의 세션과 RLS로 접근합니다.

## 5. 로컬 설정

`package.json` 옆에 `.env.local` 파일을 만들고 실제 값을 입력합니다. [.env.example](../.env.example)을 참고하세요.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://프로젝트ID.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_공개키
```

기존 anon 키를 쓰는 경우 두 번째 변수 이름을 `NEXT_PUBLIC_SUPABASE_ANON_KEY`로 바꿉니다. `.env.local`은 Git에서 제외됩니다.

```powershell
npm.cmd ci
npm.cmd run dev
```

이미 실행 중이면 종료한 뒤 다시 실행합니다. 브라우저에서 터미널에 나온 주소를 열고 3단계에서 만든 관리자 계정으로 로그인하세요. 비밀번호는 로그인 화면에만 입력합니다.

## 6. Vercel 설정

Vercel 프로젝트의 **Settings → Environment Variables**에 다음 항목을 실제 값으로 추가합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (기존 anon 키 사용 시 `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

운영 배포를 연결하려면 Production 환경에 적용하고 새로 **Redeploy**합니다. `NEXT_PUBLIC_` 변수는 빌드 시 반영되므로 기존 배포에 변수만 추가하는 것으로는 바뀌지 않습니다. 공개 키라도 DB RLS와 관리자 승인 목록은 반드시 설치해야 합니다.

## 7. 기존 브라우저 데이터 옮기기

1. 환경 변수 추가 전 브라우저 저장 화면의 **데이터 관리 → 전체 데이터 백업**에서 JSON을 다운로드합니다.
2. Supabase 연결 후 승인된 관리자 계정으로 로그인합니다.
3. **데이터 관리 → 백업 파일 복원**에서 JSON을 선택하고 공유 DB 교체 확인에 동의합니다.

복원은 공유 데이터 전체를 교체합니다. 다른 관리자도 같은 데이터를 사용하므로 기존 DB 내용을 먼저 백업하세요. 브라우저 저장 데이터는 자동으로 DB에 병합하거나 덮어쓰지 않습니다.

## 8. 연결 확인

- 로그인 전에는 관리자 화면이 열리지 않는지 확인합니다.
- 승인 목록에 없는 Auth 계정으로 로그인하면 접근이 거부되는지 확인합니다.
- 위원 또는 회의를 등록한 뒤 새로고침해 데이터가 유지되는지 확인합니다.
- 다른 브라우저에서 승인된 관리자 계정으로 로그인해 같은 데이터가 보이는지 확인합니다.
- 두 화면을 열어 한쪽에서 먼저 저장하고 다른 쪽에서 저장하면 충돌 안내가 나오는지 확인합니다. 최신 내용을 다시 불러오고 재입력하세요.

오류가 나면 URL·공개 키, SQL 실행 여부, Auth 이메일 확인 상태, 승인한 사용자 UUID를 차례로 확인합니다. 공유 DB 저장 실패 시 로컬 저장으로 전환하지 않습니다. 네트워크 오류로 저장 성공 여부가 불명확한 경우도 새로고침해 DB 상태를 확인하세요.

## 현재 저장 설계와 검증 범위

- 현재 관리 화면의 전체 데이터 구조를 `committee_workspace.data` JSONB 한 행에 저장합니다. 위원·회의별 개별 테이블로 나누는 형태는 아닙니다.
- 공유 작업 공간 하나를 모든 승인 관리자가 사용합니다. 전체 데이터는 5MB까지이며, 대규모 검색·분석을 위한 테이블 분리는 후속 작업입니다.
- `revision` 비교 후 원자적으로 저장하여 오래된 화면의 덮어쓰기를 막습니다. 자동 병합·실시간 화면 갱신은 없으며 새로고침으로 최신 상태를 불러옵니다.
- SQL은 DB 접근 권한, 문서 구조·크기와 동시 저장을 검사합니다. 업무 데이터의 상세 연결 관계는 앱에서 검증합니다. 개별 테이블의 외래 키 제약·변경 이력·자동 백업·MFA·기관 운영 정책은 별도 보완 범위입니다.
- 세션은 Supabase 브라우저 클라이언트가 관리합니다. 업무 DB 내용은 브라우저 업무 저장소로 복사하지 않습니다. 서버 렌더링에서 인증된 데이터를 다루는 기능은 없습니다.
- `tests/supabase.sql.cjs`는 로컬 PostgreSQL 호환 엔진(PGlite)에서 익명·미승인 접근 차단, 관리자 쓰기, 직접 쓰기 차단, 충돌 검사와 권한 회수를 검증합니다. `PGLITE_MODULE`에 별도 설치한 모듈 경로를 지정하여 실행합니다.
- `tests/supabase.browser.cjs`는 테스트 URL·공개 키를 설정한 서버에서 Playwright로 로그인·미승인 접근 차단·저장·충돌·로그아웃을 검증합니다. 기본 앱 주소는 `http://localhost:3101`, 테스트 Supabase URL은 `https://committee-test.supabase.co`이며 모든 API 요청을 가로채므로 실제 프로젝트를 사용하지 않습니다.
- 실제 Supabase 프로젝트가 아직 없으므로 실제 계정 로그인과 원격 DB 연결은 프로젝트 생성 후 확인해야 합니다.

공식 참고: [Next.js 연결](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs), [API 키](https://supabase.com/docs/guides/getting-started/api-keys), [비밀번호 로그인](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
