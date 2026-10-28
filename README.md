# 세종시 건축위원회 통합관리시스템 — 관리자 기능 미리보기

환경 변수 설정 전에는 브라우저 저장 모드로, Supabase 설정 후에는 승인된 관리자 로그인·공유 DB 모드로 실행합니다. 실제 개인정보나 심의자료 사용 전에는 기관 운영 정책과 접근 권한·백업 구성을 확인하세요.

## Supabase 연결

프로젝트 생성부터 SQL 설치, 관리자 계정 승인, 로컬·Vercel 환경 변수 설정까지 [Supabase 연결 절차](supabase/README.md)에 정리했습니다. 설정 예시는 `.env.example`, DB 설치 SQL은 `supabase/migrations/001_committee_workspace.sql`입니다. 현재 원격 프로젝트는 아직 생성·연결하지 않았습니다.

로고 출처: [세종특별자치시 상징물(CI)](https://www.sejong.go.kr/kor/sub01_0301.do)의 국문 조합형 원본을 `public/branding/sejong-city-logo.jpg`로 사용했습니다. 원본 색상과 비율을 유지합니다.

## 준비
- VS Code
- Node.js 24.x (로컬과 Vercel에서 동일한 메이저 버전 사용)
- npm

## 실행
```powershell
npm.cmd ci
npm.cmd run dev
```
브라우저에서 `http://localhost:3000`에 접속합니다.

위 명령은 `package.json`이 있는 `sejong-committee-prototype` 폴더에서 실행합니다. 서버가 `Ready` 상태가 될 때까지 기다리고 터미널을 열어 두세요. 3000번 포트를 사용 중이면 터미널에 표시된 다른 포트로 접속합니다. 종료는 `Ctrl + C`입니다. Windows PowerShell의 실행 정책 오류를 피하기 위해 `npm.cmd`를 사용했습니다. macOS/Linux에서는 `npm`으로 바꾸세요.

## 배포 전 확인

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run start
```

`build`가 성공한 다음 `start`로 프로덕션 화면을 확인합니다. 타입만 확인하려면 `npm.cmd run typecheck`를 실행합니다.

데이터 연결과 삭제 보호·복원 검증 테스트는 `npm.cmd test`로 실행합니다.

선택적으로 `tests/admin.browser.cjs`는 Playwright와 설치된 Microsoft Edge로 등록·수정·저장·복원·모바일 화면을 검사합니다. 별도로 설치한 Playwright 모듈 경로를 `PLAYWRIGHT_MODULE`에, 실행 중인 앱 주소를 `TEST_URL`에 지정하고 `node tests/admin.browser.cjs`로 실행합니다. 기본 앱 주소는 `http://localhost:3100`입니다. 격리된 브라우저에서 가상 데이터만 사용합니다.

## 관리자 사용 방법

주 메뉴를 누르면 해당 업무의 소메뉴가 펼쳐집니다.

| 메뉴 | 관리 방법 |
| --- | --- |
| 업무 현황 | 예정 회의·결과 대기·수당 지급 대기 확인, 자주 하는 업무 바로가기 |
| 위원 관리 → 위원 등록 | 성명·소속·연락처·임기 입력, 전문 분야·위원회 복수 선택 |
| 위원 관리 → 위원 명부 | 검색·분야 필터·페이지 이동, 위원 정보 수정·삭제, CSV 다운로드 |
| 회의·안건 → 회의 등록 / 회의 일정 | 회의명·개최일·위원회·방식·상태 등록 및 수정·삭제 |
| 회의·안건 → 안건 등록 / 안건 관리 | 상정 회의·대지 위치·심의 결과 입력, 이전 안건 연결, 수정·삭제 |
| 위원 섭외·참석 → 섭외 관리 | 회의 선택 후 전체 위원 검색, 섭외 상태 입력 |
| 위원 섭외·참석 → 참석 확정 | 참석 수락한 위원의 실제 참석·불참 확정 |
| 심의 결과 → 결과 관리 | 회의별 안건 결과 변경 및 CSV 다운로드 |
| 수당 관리 → 지급 관리 | 참석 확정자의 지급액·지급 상태 입력 후 행별 저장 |
| 데이터 관리 → 백업·복원 | 모든 관리 데이터를 JSON으로 내려받거나 백업 파일 복원 |

위원·회의·안건 입력 폼은 저장 버튼으로 반영합니다. 섭외·참석·심의 결과 선택은 즉시 저장되며, 수당은 각 행의 **저장** 버튼을 누릅니다. 저장 실패 시 알림을 표시하고 기존 데이터를 유지합니다.

섭외·수당이 연결된 위원, 안건·섭외·수당이 연결된 회의, 재심의에서 참조하는 이전 안건은 삭제할 수 없습니다. 지급 완료한 위원의 참석을 변경하려면 먼저 지급 완료를 해제하고 저장하세요. 지급 완료를 해제한 뒤 참석을 취소하면 해당 미지급 수당 내역은 제거됩니다.

기본 브라우저 모드에서는 데이터가 `localStorage`의 `sejong-committee-admin-v1`에 저장되므로 새로고침과 브라우저 재실행 후에도 유지됩니다. **같은 기기의 같은 브라우저·주소에서만 유지**되며, 다른 브라우저·Vercel 미리보기 주소·운영 주소 사이에는 공유되지 않습니다. 시크릿 모드 종료나 브라우저 데이터 삭제 전에는 백업하세요. 다른 탭에서 데이터가 바뀌면 새로고침하도록 안내하여 덮어쓰기를 막습니다. Supabase 모드에서는 승인된 관리자들이 공유 DB를 사용하며, 브라우저 업무 저장소와 자동으로 병합하지 않습니다.

백업 복원은 기존 데이터를 전부 교체합니다. 복원 전 백업 파일을 내려받으세요. 손상되거나 참조 관계가 잘못된 백업은 거부합니다.

## Vercel 배포: GitHub 연결

1. GitHub에 저장소를 만들고 이 프로젝트 파일을 올립니다. `package-lock.json`, `package.json`, `vercel.json`, `app`, `lib`, TypeScript 설정을 포함합니다. `.gitignore`에서 제외한 `node_modules`, `.next`, `.vercel`, `.env` 파일은 올리지 않습니다.
2. [Vercel](https://vercel.com/new)에 로그인하고 **Add New → Project**에서 GitHub 저장소를 Import합니다. 처음 연결할 때는 해당 저장소 접근을 허용합니다.
3. 다음 설정을 확인합니다.

| 항목 | 값 |
| --- | --- |
| Project Name | `sejong-committee-prototype` 또는 원하는 영문 이름 |
| Framework Preset | Next.js |
| Root Directory | 아래 폴더 구조 설명 참고 |
| Node.js Version | 24.x (`package.json`의 `engines`에도 지정) |
| Install Command | `npm ci` (`vercel.json`에 지정) |
| Build Command | `npm run build` (`vercel.json`에 지정) |
| Output Directory | Next.js 기본값 유지, 별도 재정의하지 않음 |
| Environment Variables | 브라우저 모드: 없음 / 공유 DB 모드: Supabase URL·공개 키 |

**Root Directory는 저장소에서 `package.json`이 있는 위치입니다.** 저장소 첫 화면에 `sejong-committee-prototype` 폴더가 보이면 그 폴더를 선택하세요. 이 프로젝트 폴더의 내용만 저장소 최상위에 올렸다면 기본값 `./`를 사용하세요.

4. **Deploy**를 누릅니다. 빌드 성공 후 생성되는 `https://프로젝트주소.vercel.app` 주소로 접속합니다. `localhost` 주소는 본인 컴퓨터에서 로컬 서버를 실행할 때만 사용합니다.
5. 이후 연결된 프로덕션 브랜치(보통 `main`)에 변경 내용을 push하면 자동으로 다시 배포됩니다.

## Vercel 배포: GitHub 없이 터미널 사용

프로젝트 폴더에서 다음 명령을 실행합니다. Vercel CLI는 `npx`가 필요할 때 다운로드하므로 전역 설치는 필요 없습니다.

```powershell
cd "C:\Users\hj\OneDrive\바탕 화면\위원회\sejong-committee-prototype"
npx.cmd vercel@latest login
npx.cmd vercel@latest
```

처음 실행할 때 CLI 설치 질문에 동의하고, 로그인한 계정의 배포 대상 팀을 선택합니다. 새 프로젝트라면 기존 프로젝트 연결 질문에는 No를 선택하고, 프로젝트 이름은 영문으로 지정하세요. 코드 위치는 현재 폴더 `./`이며, 감지된 Next.js 기본 설정을 사용합니다. 첫 명령은 미리보기 배포를 생성합니다. 미리보기 주소에서 화면을 확인한 후 공개 운영 주소로 배포하려면 실행합니다.

```powershell
npx.cmd vercel@latest --prod
```

이 명령은 실제 Vercel 계정에 배포합니다. 이 저장소 준비 작업 자체는 외부 배포를 수행하지 않습니다.

## 배포 후 확인 및 오류 해결

- 대시보드와 각 메뉴가 열리는지, 위원 검색과 CSV 다운로드가 동작하는지 확인합니다.
- 브라우저 모드에서는 같은 브라우저에서, Supabase 모드에서는 승인된 관리자 간 공유 DB에서 데이터가 유지됩니다.
- `No Next.js version detected`, `package.json` 또는 잠금 파일을 찾을 수 없다는 오류: Root Directory와 업로드 파일을 확인합니다.
- `npm ci`에서 잠금 파일 불일치 오류: 로컬에서 `npm.cmd install`을 실행하고 변경된 `package-lock.json`과 `package.json`을 함께 올립니다.
- 빌드 실패: Vercel의 해당 Deployment → Build Logs에서 첫 오류를 확인하고, 로컬에서도 `npm.cmd run build`로 재현합니다.
- 배포 주소에서 Vercel 로그인을 요구하면 프로젝트의 Deployment Protection 설정과 접근 권한을 확인합니다.

공식 문서: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [빌드와 Root Directory 설정](https://vercel.com/docs/builds/configure-a-build), [Node.js 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [CLI 배포](https://vercel.com/docs/cli/deploy), [GitHub 연동](https://vercel.com/docs/git/vercel-for-github).

## 현재 구현
- 가상 위원 100명, 전문 분야·위원회 다중 소속
- 소메뉴별 위원·회의·안건 입력 폼과 등록·수정·삭제
- 위원 검색 및 전문 분야 필터, 페이지 구분, CSV 내보내기
- 회의별 섭외 상태 및 실제 참석 확정
- 심의 결과 변경과 이전 안건 연결 표시
- 참석 확정자 수당 수기 입력·지급 표시
- 위원 구성 통계, 업무 대기 현황, 바로가기
- 브라우저 저장 및 JSON 백업·복원, 참조 관계와 지급 내역 보호

## 한계 및 다음 단계
- Supabase 미설정 시 데이터는 현재 브라우저에만 저장됩니다. 설정 시 승인된 관리자가 로그인해 공유 DB를 사용합니다.
- Supabase 모드에서도 실시간 자동 갱신·변경 이력·심의 문서 업로드는 없습니다. 최신 공유 내용은 새로고침하고, JSON 백업으로 복원합니다.
- 법령상 구성 기준이나 이해충돌을 자동 검증하지 않습니다.
- 수당은 자동 계산이 아니라 수기 입력입니다.
- 위원별 의견 입력·문서 자동 생성·정식 이력 관리는 미구현입니다.
- 초기 데이터의 과거 참석 횟수는 가상 예시값이며 신규 확정 참석 통계와 분리됩니다.
- CSV는 엑셀에서 열 수 있지만 XLSX 형식은 아닙니다.

운영용 구현 전 기관 보안 승인, 접속망 범위, 계정 관리, 법령·수당 규칙, 비식별 데이터 매핑을 확정해야 합니다.
