# 배포 가이드 / 인수인계

**작성:** 2026-08-11
**최종 갱신:** 2026-08-12 (배포 완료)
**상태:** **프로덕션 배포 완료 · 라이브 정상 동작**

---

## 지금 어디까지 되어 있나

| 항목 | 상태 |
|------|:----:|
| Worker 재작성 (TourAPI 전환) | ✅ |
| 프론트엔드 재구성 (단일 페이지) | ✅ |
| 문서 갱신 (API·CLAUDE·README·HISTORY) | ✅ |
| `main` 병합 및 GitHub 푸시 | ✅ `b996a3f` |
| 로컬 검증 (Worker 16항목 + 브라우저 43항목) | ✅ 전체 통과 |
| 프로덕션 배포 | ✅ |
| `TOUR_API_KEY` 시크릿 등록 | ✅ |

라이브 사이트(https://ctfschedule.qudgns200.workers.dev)는 v2.1 코드로 동작하며,
`/api/health`가 `ok:true`·`resultCode:"0000"`을, `/api/festivals`가 이번 주말 행사 59건을 반환한다.

---

## 배포 절차

### 사전 준비

이 프로젝트에는 `package.json`이 없고 wrangler도 전역 설치되어 있지 않다. `npx`로 실행한다.

> **Windows PowerShell 주의** — `npx`를 그대로 치면 실행 정책 때문에
> `npx.ps1 파일을 로드할 수 없습니다` 오류가 난다. **`npx.cmd`** 를 쓰면 우회된다.
> 또는 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`로 정책을 한 번 바꿔도 된다.

### 1. Cloudflare 로그인

```powershell
cd <프로젝트 경로>
npx.cmd wrangler login
```

브라우저가 열리면 Allow. 확인:

```powershell
npx.cmd wrangler whoami
```

> API 토큰 방식을 쓴다면 [API Tokens](https://dash.cloudflare.com/profile/api-tokens)에서
> **Edit Cloudflare Workers** 템플릿으로 발급한다. 발급 토큰은 보통 40자다.
> 토큰은 `.dev.vars`가 아니라 셸 환경변수(`CLOUDFLARE_API_TOKEN`)로 넘기는 것이 낫다 —
> `.dev.vars` 값은 `wrangler dev` 실행 시 Worker의 `env`로 주입되어 앱 코드에 노출된다.

### 2. 프로덕션 시크릿 등록

**시크릿 이름이 `SERVICE_KEY` → `TOUR_API_KEY`로 바뀌었다.** 등록하지 않으면 `CONFIG_ERROR`가 난다.

```powershell
npx.cmd wrangler secret list                  # 현재 등록 상태 확인
npx.cmd wrangler secret put TOUR_API_KEY      # 값 입력 프롬프트
```

기존 `SERVICE_KEY`가 남아 있다면 지운다.

```powershell
npx.cmd wrangler secret delete SERVICE_KEY
```

> ⚠️ **키 끝에 문자가 붙는 사고가 실제로 있었다.** 로컬 `.dev.vars`의 `TOUR_API_KEY`가
> 65자로 저장되어 `SERVICE_KEY_IS_NOT_REGISTERED_ERROR`가 났고, 마지막 1자를 제거한
> 64자가 정답이었다. 붙여넣기 후 길이를 반드시 확인할 것.

#### 실제로 겪은 시크릿 사고 2건 (2026-08-12)

**① 이름 자리에 키 값을 넣었다.** `wrangler secret put <키값>` 형태로 실행되어
이름이 API 키 원문인 시크릿이 생성됐다. **시크릿 이름은 `secret list`와 대시보드에
평문으로 노출되므로 키가 그대로 드러난다.** `secret list` 결과에 `TOUR_API_KEY` 외의
이름이 보이면 즉시 삭제할 것.

```powershell
"y" | npx.cmd wrangler secret delete <노출된_이름>   # 비대화형에서는 y를 파이프로
```

**② PowerShell 파이프 입력이 값을 오염시켰다.** `$k | wrangler secret put TOUR_API_KEY`로
등록하면 끝에 개행(`\r\n`)이 붙어 위 65자 사고와 같은 증상이 난다.
**개행이 끼어들 수 없는 `secret bulk`를 쓰는 것이 안전하다.**

```powershell
# {"TOUR_API_KEY":"<64자>"} 형태의 JSON을 BOM 없이 쓰고 등록한다
npx.cmd wrangler secret bulk secrets.json
Remove-Item secrets.json -Force              # 등록 후 반드시 삭제
```

> 파일 크기가 `64 + 19`바이트(= 83)면 값에 군더더기가 없다는 뜻이다.

### 3. 배포

```powershell
npx.cmd wrangler deploy
```

### 4. 검증

> ⚠️ **`curl`이 아니라 `curl.exe`를 써야 한다.** Windows PowerShell에서 `curl`은
> `Invoke-WebRequest`의 별칭이라 4xx/5xx 응답을 받으면 본문을 보여주고도 예외를 던진다
> (`InvalidOperation ... WebException`). 배포 실패로 오해하기 쉽다.

```powershell
# ① 상위 API 연결 — 가장 먼저 볼 것
curl.exe -s https://ctfschedule.qudgns200.workers.dev/api/health
# 기대: {"ok":true,"resultCode":"0000","resultMsg":"OK","totalCount":<숫자>,...}

# ② 목록
curl.exe -s https://ctfschedule.qudgns200.workers.dev/api/festivals
# 기대: ok:true, weekend가 이번 주말, items 다수

# ③ 실제 호출 수 감시 (일 1,000건 예산 대비)
npx.cmd wrangler tail
```

> ⚠️ **시크릿을 고친 직후 `/api/health`는 최대 5분간 옛 오류를 반환한다.**
> `handleHealth`가 상위 응답을 `cf.cacheTtl: 300`으로 캐싱하기 때문이다.
> 즉시 확인하려면 캐시 키가 다른 상세 라우트를 쓴다 —
> `curl.exe -s https://ctfschedule.qudgns200.workers.dev/api/festivals/4090201`

브라우저로 사이트를 열어 카드·필터·모달·찜하기가 동작하는지도 확인한다.

### 키가 정상인데 프로덕션만 실패할 때 — 원인 분리법

로컬은 되는데 라이브만 `AUTH_ERROR`라면, 아래 순서로 변수를 하나씩 배제한다.
이번 사고를 몇 단계 만에 시크릿 문제로 확정한 경로다.

| 실행 위치 | 명령 | 사용하는 키 | 실행 네트워크 |
|-----------|------|-------------|---------------|
| 로컬 | `wrangler dev` → `:8787` | `.dev.vars` | 내 PC |
| 엣지 | `wrangler dev --remote` → `:8788` | `.dev.vars` | Cloudflare 엣지 |
| 프로덕션 | 라이브 URL | Workers Secret | Cloudflare 엣지 |

- 로컬 ✅ / 엣지 ❌ → 엣지 IP 또는 네트워크 경로 문제
- 로컬 ✅ / 엣지 ✅ / 프로덕션 ❌ → **Workers Secret 값 문제로 확정**

### 문제 발생 시 롤백

```powershell
npx.cmd wrangler rollback
```

---

## 배포 후 정리할 것

- [x] `.dev.vars`에서 `CLOUDFLARE_API_TOKEN` 줄 제거 — 현재 작업 PC의 `.dev.vars`에는
      해당 줄이 없음을 확인. 인수인계서를 작성한 다른 환경에 남아 있다면 그쪽에서 제거할 것
- [x] `.dev.vars` 변수명을 `SERVICE_KEY` → `TOUR_API_KEY`로 통일
- [x] `HISTORY.md`의 v2.0·v2.1 섹션에 실제 커밋 해시 기입 (`dd0842f`, `b996a3f`)
- [x] 구 `SERVICE_KEY` 및 이름에 키가 노출된 시크릿 삭제 확인 (현재 `TOUR_API_KEY` 하나만 등록)
- [ ] 노출됐던 API 키 재발급 검토 — 시크릿 이름으로 평문 노출된 이력이 있다.
      저장소에 커밋된 적은 없고 계정 소유자만 조회 가능한 위치였으나, 재발급이 확실하다
- [ ] 브라우저에서 카드·필터·모달·찜하기 최종 확인

---

## 알아두면 좋은 것

배포 자체와 무관하지만, 이후 작업에서 반복해서 걸릴 만한 것들이다.
자세한 내용은 [CLAUDE.md](CLAUDE.md)의 "반드시 알아야 할 것" 절과 [API.md](API.md)에 있다.

- **일 1,000건 쿼터** — 개발계정 한도. 목록은 6시간 캐시된다.
- **subrequest 50개 한도** — Workers 무료 플랜의 요청당 제한. 요금 보강을 상위 40건
  (`MAX_ENRICH`)으로 자른 이유다. 유료 플랜이면 상수만 올리면 전체 보강된다.
- **캐시는 로컬에서 검증되지 않는다** — `caches.default`와 `cf.cacheTtl`은
  `wrangler dev`에서 동작하지 않는다. `--remote`나 배포 후에 확인해야 한다.
- **키는 Decoding 형태**를 쓴다. 코드가 Encoding 형태도 처리하지만 기본은 Decoding이다.

---

## 미구현 (명세서 Phase 2~3)

- 최근 본 행사, 행사 공유
- 📍 내 주변 행사, 거리순 정렬, 지도 표시, 길찾기
  (좌표 `lat`/`lng`는 이미 API 응답에 포함되어 있어 착수 가능)
