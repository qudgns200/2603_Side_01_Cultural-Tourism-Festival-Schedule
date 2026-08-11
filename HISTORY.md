# 프로젝트 수정 히스토리

**프로젝트:** K-Festival — 대한민국 문화관광축제 스케줄러  
**작성자:** lee byeonghoon  
**저장소:** https://github.com/qudgns200/Cultural-Tourism-Festival-Schedule

---

## v0.1 — 초기 개발
**날짜:** 2026-03-30  
**커밋:** `787c3da`, `1ac18f9`

Python Flask 기반의 웹 서버로 프로젝트를 시작했다. 공공데이터포털 API를 호출해 축제 정보를 가져오는 로직(`dateResponse.py`, `main.py`)과 기본 HTML 템플릿(`templates/index.html`, `templates/list.html`)을 구성했다. iframe을 활용한 레이아웃과 축제 데이터 매핑도 이 시점에 완성됐다.

**주요 변경 파일**
- `main.py`, `dateResponse.py` (신규)
- `templates/index.html`, `templates/list.html` (신규)

---

## v0.2 — Cloudflare Workers 마이그레이션
**날짜:** 2026-03-30  
**커밋:** `126eb62` ~ `745d0e0`, `d621525`

로컬 Python 서버에서 Cloudflare Workers 서버리스 환경으로 전환했다. 초기에는 단일 `_worker.js`로 시도했으나 Cloudflare Functions 구조(`functions/api/festivals.js`)로 재편하고, 최종적으로 `wrangler.toml`과 `src/index.js`를 기반으로 하는 표준 Workers 구조로 확정했다. HTML 파일은 `public/` 디렉토리로 이동했으며, 모든 Python 파일은 삭제됐다.

**주요 변경 파일**
- `src/index.js`, `wrangler.toml` (신규)
- `functions/api/festivals.js` (신규)
- `public/index.html`, `public/list.html` (이동)
- `main.py`, `dateResponse.py`, `_worker.js` (삭제)

---

## v0.3 — 안정화 및 버그 수정
**날짜:** 2026-03-30  
**커밋:** `b010097`, `1eb1825`, `e708ae1`, `0cfaa73`, `255b891`, `08275a4`, `432e280`

배포 후 발생한 라우팅 문제와 API 응답 파싱 오류를 수정했다. 비(非) JSON 응답에 대한 에러 핸들링을 강화했고, Service Key 인코딩 이슈를 해결하기 위해 API 호출 로직을 단순화했다. 루트 경로(`/`) 처리와 정적 파일 라우팅도 이 단계에서 안정화됐다. 또한 중복 축제 제거 및 가나다순 정렬 기능을 추가했다.

**주요 변경 파일**
- `src/index.js`
- `public/list.html`

---

## v0.4 — UI 리디자인 (Glassmorphism + K-Festival 브랜딩)
**날짜:** 2026-03-30  
**커밋:** `2f68d41`, `2380957`, `589a5bd` ~ `0c06e95`

Variant 디자인 시스템을 적용한 후, Glassmorphism 효과와 K-Festival 브랜딩으로 대규모 UI 리디자인을 진행했다. Crimson Red(`#E11D48`) · Amber Gold(`#F59E0B`) 컬러 팔레트, 반투명 헤더, 카드 호버 애니메이션을 도입했다. 동시에 `README.md`를 최초 작성하고 프로젝트 소개, 기술 스택, 향후 개선 계획을 정리했다.

**주요 변경 파일**
- `public/index.html`, `public/list.html`
- `README.md` (신규 및 업데이트)

---

## v0.5 — 보안 업데이트
**날짜:** 2026-06-06  
**커밋:** `78cfb25`

소스 코드에 하드코딩되어 있던 공공데이터포털 Service Key를 환경변수로 분리했다. Cloudflare Workers의 Secret 기능을 통해 `SERVICE_KEY`를 주입하도록 변경했고, 로컬 개발 환경을 위한 `.dev.vars.example` 파일을 추가했다. `.gitignore`에 `.dev.vars`를 추가해 실제 키 값이 저장소에 노출되지 않도록 했다.

**주요 변경 파일**
- `src/index.js`, `functions/api/festivals.js`
- `.dev.vars.example` (신규)
- `.gitignore`

---

## v0.6 — UI 리디자인 (Vibrant Festival 스타일)
**날짜:** 2026-07-07  
**커밋:** `9b37f21`

Glassmorphism 스타일을 Vibrant Festival 스타일로 교체했다. 핑크 → 퍼플 → 블루 그라디언트 배경, 카드 상단 3색 그라디언트 바, 그라디언트 버튼 등 활기찬 축제 분위기를 연출했다. 동시에 미사용 CSS 변수, 불필요한 래퍼 태그, 중복 폰트 웨이트 등 코드를 대거 정리해 파일 크기를 줄였다 (155줄 삭제, 81줄 추가).

**주요 변경 파일**
- `public/index.html`, `public/list.html`

---

## v0.7 — 날짜 검색 기능 추가 및 문서 정비
**날짜:** 2026-07-08  
**커밋:** `2d3c122`, `e8422ce`, `f0a61b3`, `378ceeb`

날짜 선택기(달력)와 검색 버튼을 카드 목록 상단에 추가했다. 초기 로드는 기존과 동일하게 오늘 기준 7일치 축제를 보여주고, 날짜 선택 후 검색 시 해당 날짜에 진행 중인 축제(시작일 ≤ 선택일 ≤ 종료일)를 출력한다. 백엔드는 선택일 기준 30일 이전까지 병렬 호출 후 종료일 기준으로 필터링한다. 아울러 API URL을 `http://`에서 `https://`로 수정하고, 화면 메시지를 간결하게 개선했다. 프로젝트 문서(`CLAUDE.md`, `API.md`, `HISTORY.md`)도 이 시점에 최초 작성됐다.

**주요 변경 파일**
- `public/list.html` (날짜 검색 UI, 메시지 개선)
- `src/index.js` (`?date=` 파라미터 지원, https 수정, fetchDay 리팩터링)
- `CLAUDE.md` (신규 — 프로젝트 가이드 + 작업 규칙)
- `API.md` (신규 — API 명세서)
- `HISTORY.md` (신규 — 개발 변경 이력)

---

## v2.0 — K-FESTIVAL 2.0 리뉴얼 (1) 데이터 소스 전환 및 Worker 재작성
**날짜:** 2026-08-11  
**브랜치:** `feat/k-festival-2.0`

`K-FESTIVAL_2.0_개발명세서.md`에 따라 "날짜별 축제 검색"에서 **"이번 주말, 어디 갈까?" 주말 행사 발견 서비스**로 리뉴얼을 시작했다. 이번 단계는 백엔드 전면 재작성이다.

**데이터 소스 전환의 배경**

기존 서비스가 라이브에서 모든 조회에 빈 배열을 반환하고 있었다. 상위 API의 인증 오류 응답이 `JSON.parse` 실패 → `catch` → `null` → `200 []` 경로로 삼켜져 장애가 "축제 없음"으로 위장되고 있었기 때문이다. 또한 명세서가 요구하는 이미지·이용요금·카테고리가 기존 행정안전부 전국문화축제표준데이터에는 아예 존재하지 않는 필드임을 확인했다. 이에 한국관광공사 TourAPI(`KorService2`)로 데이터 소스를 전환했다.

전환에 앞서 공식 매뉴얼(`tour_API_Guide/`)과 실제 응답을 함께 검증해 다음을 확정했다.

- `eventStartDate`/`eventEndDate`는 **겹침(overlap) 의미**로 동작한다 → 주말 창만 요청해도 장기 행사가 함께 조회되므로 기존의 31일 소급 호출이 불필요해졌다
- `cat1~3`·`areacode`·`sigungucode`는 사실상 비어 있고(0.7%), 분류는 `lclsSystm1~3`(100% 채움), 지역은 `lDongRegnCd`(100% 채움)로 판별해야 한다
- 2026년 행정구역 개편으로 광주·전남이 `전남광주통합특별시`(코드 12)로 통합되어 데이터에 개별 값이 없다 → 지역 목록을 16개 시·도로 조정
- `mapx`가 경도, `mapy`가 위도로 순서가 반대다
- 인증 오류는 XML이 아니라 HTTP 403 + JSON(`OpenAPI_ServiceResponse`)으로 온다

**주요 변경**

- **응답 봉투 도입** — 순수 배열에서 `{ok, weekend, counts, truncated, warnings, items, error}` 구조로 변경. 명세서 §19가 요구하는 "API 장애 vs 결과 없음" 구분이 가능해졌다
- **KST 주말 자동 계산** — UTC로 도는 Worker에서 +09:00 보정 후 판정. 한국 시각 00~09시에 하루가 어긋나던 문제 해결. 일요일 접속 시 오늘 포함 이번 주말을 보여준다
- **`/api/health` 신설** — 상위 API 연결 상태와 `resultCode`를 즉시 확인. 이번 장애를 몇 초 만에 드러냈을 진단 경로다
- **오류 처리 전면 개편** — `res.ok`·`OpenAPI_ServiceResponse`·`resultCode`를 순서대로 검사해 `AUTH_ERROR`/`QUOTA_EXCEEDED`/`UPSTREAM_ERROR`로 분류하고 실제 HTTP 상태를 반환한다. 장애를 빈 목록으로 위장하지 않는다
- **캐싱** — `caches.default` 합성 키(주말 단위) + `cf.cacheTtl` 6시간. 지역 필터는 캐시된 전체 집합에 대한 후처리로 구현해 캐시가 지역별로 쪼개지지 않는다. 개발계정 일 1,000건 제한 대응
- **필드 정규화** — 카테고리 태그(분류체계 + 행사명 키워드), 지역 판별, HTML 엔티티 디코딩, `http://` 이미지 https 전환, `addr2`의 숫자 부스러기 제거
- **요금 보강** — 인기 상위 40건에 `detailIntro2`를 호출해 무료 여부를 확정. Workers 무료 플랜의 요청당 subrequest 50개 한도를 고려한 상한이다
- **상세 라우트** — `GET /api/festivals/:id`. `homepage`가 평문 URL과 `<a>` 태그 두 형태로 오는 것을 모두 처리하고, 프로토콜 검증과 태그 제거를 서버에서 수행해 클라이언트가 `innerHTML`을 쓰지 않아도 되게 했다
- **라우팅 위생** — 미매칭 `/api/*`는 정적 파일로 흘리지 않고 404 JSON, `OPTIONS` 204, 비허용 메서드 405, `/list.html` → `/` 301
- **레거시 제거** — 도달 불가 상태로 남아 있던 `functions/api/festivals.js` 삭제
- **`.gitignore` 정비** — 키 파일·`node_modules/`·`.wrangler/`·개인 설정 등 커밋되면 안 될 항목 보강

**검증 결과** — 겹침 규칙 위반 0건, 중복·필수필드 누락 0건, 태그 커버리지 59/59(100%), 캐시 HIT 동작, 잘못된 키 투입 시 `502 AUTH_ERROR` 정상 노출.

**주요 변경 파일**
- `src/index.js` (전면 재작성)
- `wrangler.toml` (`compatibility_date` 상향, `[vars]`, `[observability]`)
- `.dev.vars.example` (`SERVICE_KEY` → `TOUR_API_KEY`, 발급 안내 보강)
- `.gitignore` (보안 항목 정비)
- `functions/api/festivals.js` (삭제)
- `tour_API_Guide/` (신규 — 공식 매뉴얼 3종)
- `K-FESTIVAL_2.0_개발명세서.md` (신규)

> **다음 단계 (v2.1 예정)** — 프론트엔드 재구성. `public/index.html`·`public/list.html`은 아직 옛 응답 형식을 읽고 있어 **현재 브랜치 상태로는 화면이 동작하지 않는다.** iframe 제거 및 단일 페이지 통합, 카드 UI 리뉴얼, 지역·날짜·무료·카테고리 필터, 상세 모달, 찜하기, 그리고 `API.md`·`CLAUDE.md`·`README.md` 갱신이 남아 있다.

---

## 전체 통계

| 항목 | 내용 |
|------|------|
| 전체 커밋 수 | 28개 (+ v2.0 작업 진행 중) |
| 개발 기간 | 2026-03-30 ~ 진행 중 |
| 주요 기술 전환 | Flask → Cloudflare Workers → TourAPI 데이터 소스 전환 |
| UI 리디자인 횟수 | 2회 (v2.0 리뉴얼 진행 중) |
| 보안 수정 | 2회 (API 키 환경변수 분리, `.gitignore` 정비) |
| 기능 추가 | 2회 (날짜 검색, 주말 자동 조회) |
| README 개편 | 1회 (v0.7 완성본 기준 전면 재작성) |
