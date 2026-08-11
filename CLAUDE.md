# CLAUDE.md — K-Festival 프로젝트 가이드

## 프로젝트 개요

대한민국 문화관광축제 스케줄러 **K-FESTIVAL 2.0 — "이번 주말, 어디 갈까?"**

한국관광공사 TourAPI를 기반으로 **이번 주말(KST)에 열리는 행사**를 지역·날짜·무료·관심사별로 발견하는 모바일 우선 웹앱.

- **라이브 URL:** https://ctfschedule.qudgns200.workers.dev
- **런타임:** Cloudflare Workers (서버리스, 엣지)
- **언어:** Vanilla HTML / CSS / JavaScript (프레임워크·빌드 없음)

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 런타임 | Cloudflare Workers |
| 정적 파일 서빙 | Cloudflare Assets 바인딩 (`ASSETS`) |
| 언어 | HTML5, Vanilla JavaScript(ES5 문법 유지), CSS3 |
| 폰트 | Google Fonts — Noto Sans KR, Montserrat |
| 외부 API | 한국관광공사 TourAPI `KorService2` |
| 배포 도구 | Wrangler CLI |

---

## 프로젝트 구조

```
├── src/
│   └── index.js              # Workers 진입점 — 라우팅, API 프록시, 정규화, 캐싱
├── public/
│   ├── index.html            # 단일 페이지 (헤더·히어로·인기레일·필터·목록·모달)
│   ├── css/style.css
│   └── js/app.js             # 상태 → 필터 → 렌더
├── tour_API_Guide/           # 한국관광공사 공식 매뉴얼 (설계 근거)
├── wrangler.toml
├── .dev.vars                 # 로컬 환경변수 (gitignore)
├── .dev.vars.example
├── API.md                    # API 명세 — 필드 채움률, 파생 규칙 포함
├── HISTORY.md                # 버전별 개발 이력
└── K-FESTIVAL_2.0_개발명세서.md
```

---

## 로컬 개발

### 1. 환경변수

`.dev.vars.example`을 복사해 `.dev.vars`를 만들고 키를 입력한다.

```
TOUR_API_KEY=발급받은_Decoding_키
```

data.go.kr에서 **한국관광공사_국문 관광정보 서비스** 활용신청 (개발계정 자동승인).

### 2. 개발 서버

```bash
wrangler dev
```

첫 확인은 `/api/health` — 상위 연결과 `resultCode`를 즉시 보여준다.

---

## 배포

```bash
wrangler secret put TOUR_API_KEY
wrangler deploy
```

---

## 환경변수

| 변수명 | 필수 | 설명 |
|--------|:----:|------|
| `TOUR_API_KEY` | Y | TourAPI 인증키 (**Decoding 형태**) |
| `MOBILE_APP` | N | TourAPI `MobileApp` 값. 기본 `K-FESTIVAL` |
| `DEBUG` | N | `1`이면 캐시 우회 + `?today=` 오버라이드 허용 |

---

## 라우팅 구조 (src/index.js)

| 경로 | 처리 |
|------|------|
| `GET /api/health` | 상위 API 연결 진단 |
| `GET /api/festivals` | 이번 주말 행사 목록 (`?region=` 지원) |
| `GET /api/festivals/:id` | 행사 상세 (`detailCommon2` + `detailIntro2`) |
| `GET /list.html` | `/`로 301 (v0.7 잔재) |
| 기타 `/api/*` | 404 JSON (정적 파일로 흘리지 않음) |
| 그 외 | `public/` 정적 파일 |

---

## 디자인 시스템

**Vibrant Festival 팔레트**

| 역할 | 색상 |
|------|------|
| 배경 그라디언트 | `#ff6b9d` → `#c44dff` → `#4facfe` |
| 헤더 배경 | `rgba(0,0,0,.25)` + `backdrop-filter: blur(12px)` |
| 카드 상단 바 | 3색 그라디언트 (4px) |
| 버튼 | `#ff6b9d` → `#c44dff` |
| 카드 배경 | `#ffffff` |
| 결과 영역 | `#fafafa` 시트 (그라디언트 위 라운드 면) |

브레이크포인트: 1열 → 768px 2열 → 1024px 3열 → 1400px 4열.

> `--primary`는 `#c2334a`다. 기존 `#f5576c`는 흰 배경 대비 3.4:1로 WCAG AA 미달이라 어둡게 조정했다.

---

## 반드시 알아야 할 것 (실측으로 확인된 함정)

- **키 인코딩** — data.go.kr은 Encoding/Decoding 두 형태를 준다. 이중 인코딩(`%2B` → `%252B`)이 전형적 인증 실패 원인이라, 코드가 퍼센트 인코딩을 감지하면 먼저 풀고 `URLSearchParams`로 한 번만 인코딩한다.
- **일 1,000건 쿼터** — 개발계정 한도. 캐싱이 선택이 아니라 필수다.
- **subrequest 50개 한도** — Workers 무료 플랜의 요청당 제한. 요금 보강을 상위 40건으로 자른 이유다(`MAX_ENRICH`). 유료 플랜이면 상수만 올리면 된다.
- **`mapx`=경도, `mapy`=위도** — 순서가 직관과 반대다.
- **응답 봉투가 한 단계 깊다** — `response.body.items.item[]`.
- **`cat1~3`·`areacode`·`sigungucode`는 비어 있다(0.7%)** — 분류는 `lclsSystm1~3`, 지역은 `lDongRegnCd`로 판별해야 한다.
- **광주·전남 통합** — 2026년 개편으로 `전남광주통합특별시`(코드 12). 지역 목록은 16개다.
- **KST 보정** — Worker는 UTC로 돈다. `+09:00` 보정 없이 날짜를 계산하면 한국 시각 00~09시에 하루가 어긋난다. 주말 기준은 **서버가 유일한 소스**이고 브라우저는 재계산하지 않는다.
- **`addr2`(장소)는 거의 비어 있다** — 정리 후 실사용 약 19%. 카드 위치 표시는 `address` 기준으로 잡는다.
- **로컬 `wrangler dev`에서 캐시가 동작하지 않는다** — `caches.default`와 `cf.cacheTtl` 검증은 `--remote`나 배포 후에 해야 한다.

---

## 코드 규칙

- **API 문자열에 `innerHTML`을 쓰지 않는다.** 카드는 `<template>` + `cloneNode` + `textContent`로 만든다. 서버가 태그 제거·엔티티 디코딩·URL 프로토콜 검증까지 끝내서 내려준다.
- **장애를 빈 목록으로 위장하지 않는다.** 상위 실패는 반드시 `ok:false` + 오류 코드로 드러낸다. v0.7의 라이브 장애가 이것 때문에 몇 달간 감춰져 있었다.
- **필터는 클라이언트에서 한다.** 명세서 §4.2 원칙 2 — 한 번 받은 데이터를 메모리에서 거른다. 필터 조작 시 API 재호출은 0회여야 한다.
- **상태 변경은 `setState()` 한 경로로.** `setState` → `applyFilters` → `render`.

---

## 작업 규칙

기능 추가, 버그 수정, 디자인 변경, 보안 수정 등 유의미한 변경이 발생하면 작업 완료 후 **반드시 `HISTORY.md`를 업데이트**한다.

- 기존 버전 번호에서 하나 올려 새 섹션(`## vX.X`)을 추가할 것
- 날짜, 커밋 해시, 변경 요약, 주요 변경 파일을 포함할 것
- GitHub 푸시 전에 HISTORY.md 업데이트를 먼저 완료할 것

---

## 참고 문서

- [API.md](API.md) — 상위/클라이언트 API 명세, 필드 채움률, 파생 규칙
- [HISTORY.md](HISTORY.md) — 버전별 개발 이력
- [K-FESTIVAL_2.0_개발명세서.md](K-FESTIVAL_2.0_개발명세서.md) — 리뉴얼 요구사항
- `tour_API_Guide/` — 한국관광공사 공식 매뉴얼
