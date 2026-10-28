# 세종시 건축위원회 통합관리시스템 — 시연용 프로토타입

**운영용 시스템이 아닙니다. 실제 개인정보나 심의자료를 입력하지 마세요.**

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
| Environment Variables | 현재 앱은 필요 없음 |

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
- 회의나 섭외 정보를 변경한 뒤 새로고침하면 초기화되는 것이 현재 시연용 동작입니다. 사용자 간 데이터도 공유되지 않습니다.
- `No Next.js version detected`, `package.json` 또는 잠금 파일을 찾을 수 없다는 오류: Root Directory와 업로드 파일을 확인합니다.
- `npm ci`에서 잠금 파일 불일치 오류: 로컬에서 `npm.cmd install`을 실행하고 변경된 `package-lock.json`과 `package.json`을 함께 올립니다.
- 빌드 실패: Vercel의 해당 Deployment → Build Logs에서 첫 오류를 확인하고, 로컬에서도 `npm.cmd run build`로 재현합니다.
- 배포 주소에서 Vercel 로그인을 요구하면 프로젝트의 Deployment Protection 설정과 접근 권한을 확인합니다.

공식 문서: [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [빌드와 Root Directory 설정](https://vercel.com/docs/builds/configure-a-build), [Node.js 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [CLI 배포](https://vercel.com/docs/cli/deploy), [GitHub 연동](https://vercel.com/docs/git/vercel-for-github).

## 현재 구현
- 가상 위원 100명, 전문 분야·위원회 다중 소속
- 위원 검색 및 전문 분야 필터, CSV 내보내기
- 회의·안건 조회 및 간단한 등록
- 회의별 섭외 상태 및 실제 참석 확정
- 심의 결과 변경과 이전 안건 연결 표시
- 참석 확정자 수당 수기 입력·지급 표시
- 위원 구성 통계 및 간단한 대시보드

## 한계 및 다음 단계
- 모든 변경 내용은 브라우저 메모리에만 있으며 새로고침 시 초기화됩니다.
- 로그인·접근 권한·PostgreSQL·감사 로그·백업·파일 업로드가 없습니다.
- 위원 후보 표시는 시연용 정렬이며 법령상 구성 기준이나 이해충돌을 검증하지 않습니다.
- 수당은 자동 계산이 아니라 수기 입력입니다.
- 위원별 의견 입력·문서 자동 생성·정식 이력 관리는 미구현입니다.
- 초기 데이터의 과거 참석 횟수는 가상 예시값이며 신규 확정 참석 통계와 분리됩니다.
- CSV는 엑셀에서 열 수 있지만 XLSX 형식은 아닙니다.

운영용 구현 전 기관 보안 승인, 접속망 범위, 계정 관리, 법령·수당 규칙, 비식별 데이터 매핑을 확정해야 합니다.
