# API 명세서 — K-FESTIVAL 2.0

## 개요

| 항목 | 내용 |
|------|------|
| 상위 API | 한국관광공사 국문 관광정보 서비스 (TourAPI) |
| 서비스 | `KorService2` |
| 베이스 URL | `https://apis.data.go.kr/B551011/KorService2` |
| 제공처 | 공공데이터포털 (data.go.kr) |
| 인증 | Service Key (환경변수 `TOUR_API_KEY`) |
| 응답 형식 | JSON (`_type=json`) |
| **쿼터** | **개발계정 일 1,000건** |

> **v0.7까지는** 행정안전부 전국문화축제표준데이터(`tn_pubr_public_cltur_fstvl_api`)를 사용했다.
> 해당 API에는 이미지·이용요금·카테고리 필드가 없어 2.0 요구사항을 충족할 수 없어 전환했다.

---

## 1. 클라이언트 API (브라우저 → Worker)

### 1.1 `GET /api/festivals`

이번 주말(KST 기준)에 열리는 행사 목록.

| 쿼리 | 필수 | 설명 |
|------|:----:|------|
| `region` | N | 지역 필터. `all`(기본) 또는 아래 16개 지역명. 그 외 값은 400 |
| `today` | N | **`DEBUG=1`일 때만.** `YYYY-MM-DD`로 오늘을 덮어써 주말 경계를 테스트 |

**성공 응답**

```jsonc
{
  "ok": true,
  "generatedAt": "2026-08-11T08:00:00.000Z",
  "weekend": {
    "start": "2026-08-15", "end": "2026-08-16",
    "startCompact": "20260815", "endCompact": "20260816"
  },
  "counts": { "total": 59, "returned": 59, "upstreamTotal": 59 },
  "truncated": false,
  "warnings": ["요금 정보는 상위 40건만 확인되었습니다."],
  "items": [ /* 아래 항목 스키마 */ ],
  "error": null
}
```

**항목 스키마**

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | String | `contentid` |
| `title` | String | 행사명 (HTML 엔티티 디코딩 완료) |
| `place` | String | 장소. 상위 `addr2` 기준이며 **채워진 비율이 낮다(약 19%)**. 숫자뿐인 쓰레기 값은 제거되어 빈 문자열 |
| `address` | String | 주소 (`addr1`) |
| `region` | String | 아래 16개 지역 중 하나, 판별 실패 시 `기타` |
| `startDate` / `endDate` | String | `YYYY-MM-DD` |
| `startCompact` / `endCompact` | String | `YYYYMMDD` (문자열 비교가 곧 날짜 비교) |
| `image` / `thumb` | String | 대표 이미지 / 썸네일. `http://`는 `https://`로 정규화 |
| `lat` / `lng` | Number\|null | **`lat`=상위 `mapy`, `lng`=상위 `mapx`** (순서 반대 주의) |
| `tel` | String | 전화번호 |
| `tags` | String[] | `가족`·`공연`·`체험`·`야외`·`먹거리`·`축제` 중 해당하는 것 |
| `isFree` | Boolean | 무료 여부. `feeResolved=false`면 행사명 키워드에 의한 추정값 |
| `feeResolved` | Boolean | `detailIntro2`로 요금이 확정되었는지 |
| `fee` | String | 확정된 이용요금 원문 |
| `overlapDays` | Number | 주말과 겹치는 일수 (0~2) |

**오류 응답**

```jsonc
{ "ok": false, "error": { "code": "AUTH_ERROR", "message": "행사 정보를 불러오지 못했어요.", "detail": "..." },
  "items": [], "weekend": { ... } }
```

| `error.code` | HTTP | 발생 조건 |
|---|:--:|---|
| `BAD_REQUEST` | 400 | 알 수 없는 `region`, 잘못된 `today` 형식 |
| `NOT_FOUND` | 404 | 없는 경로 또는 없는 행사 id |
| `METHOD_NOT_ALLOWED` | 405 | GET/HEAD/OPTIONS 외 |
| `QUOTA_EXCEEDED` | 429 | 상위 일일 호출 한도 초과 |
| `AUTH_ERROR` | 502 | 키 미등록·만료·IP 미등록·접근 거부 |
| `UPSTREAM_ERROR` | 502 | 상위 5xx, 타임아웃, 비정상 응답 |
| `CONFIG_ERROR` | 500 | `TOUR_API_KEY` 미설정 |
| `INTERNAL_ERROR` | 500 | 그 외 |

> 클라이언트는 **HTTP 상태가 아니라 `ok` 필드로 분기**한다. 다만 상태 코드도 정확히 반환한다.
> 상위 조회 실패 시 이전 캐시가 있으면 `stale: true`를 붙여 오래된 데이터라도 제공한다.

**응답 헤더**

| 헤더 | 값 |
|------|----|
| `Content-Type` | `application/json; charset=utf-8` |
| `Access-Control-Allow-Origin` | `*` |
| `Cache-Control` | `public, max-age=600, s-maxage=21600` |
| `X-Cache` | `HIT` / `MISS` / `STALE` |

### 1.2 `GET /api/festivals/:id`

행사 상세. `id`는 숫자 1~12자리.

```jsonc
{
  "ok": true,
  "item": {
    "id": "2541883", "title": "...", "overview": "...",
    "address": "...", "place": "...", "region": "강원",
    "startDate": "2026-08-14", "endDate": "2026-08-16",
    "image": "https://...", "lat": 37.75, "lng": 128.89, "tel": "033-...",
    "homepage": "https://...",
    "fee": { "raw": "무료", "isFree": true, "resolved": true },
    "playtime": "18:00~23:00", "agelimit": "...", "program": "...",
    "sponsor": "...", "tags": ["공연", "축제"]
  },
  "error": null
}
```

서버에서 미리 처리하는 것 — 클라이언트가 `innerHTML`을 쓸 필요가 없다.

- `overview` — `<br>`은 줄바꿈으로, 나머지 태그 제거, 엔티티 디코딩
- `homepage` — **평문 URL과 `<a href=...>` 두 형태로 모두 온다.** `href`를 추출하고 `^https?://`를 검증해 실패 시 `null`

### 1.3 `GET /api/health`

상위 API 연결 진단. 키 만료·쿼터 초과를 즉시 식별한다.

```jsonc
{ "ok": true, "upstream": "KorService2/searchFestival2",
  "resultCode": "0000", "resultMsg": "OK", "totalCount": 59, "weekend": { ... } }
```

---

## 2. 상위 API 호출 (Worker → TourAPI)

### 2.1 공통 파라미터

| 파라미터 | 값 |
|---|---|
| `serviceKey` | `TOUR_API_KEY` |
| `MobileOS` | `ETC` |
| `MobileApp` | `K-FESTIVAL` (필수) |
| `_type` | `json` |

> **키 인코딩 함정** — data.go.kr은 Encoding/Decoding 두 형태를 발급한다.
> 코드는 퍼센트 인코딩이 감지되면 먼저 `decodeURIComponent` 한 뒤 `URLSearchParams`에 넘겨
> **정확히 한 번만** 인코딩되게 한다. 이중 인코딩(`%2B` → `%252B`)이 전형적인 인증 실패 원인이다.

### 2.2 `searchFestival2` — 목록

| 파라미터 | 값 | 비고 |
|---|---|---|
| `eventStartDate` | 주말 토요일 `YYYYMMDD` | 필수 |
| `eventEndDate` | 주말 일요일 `YYYYMMDD` | |
| `numOfRows` | `1000` | 실측상 전량 반환 |
| `pageNo` | `1` | |
| `arrange` | `C` | 수정일순 |

> **겹침 의미 확인됨** — `eventStartDate`/`eventEndDate`에 주말 창만 넘겨도
> 그 이전에 시작한 장기 행사가 함께 반환된다(실측). 따라서 소급 조회가 필요 없다(`LOOKBACK_DAYS = 0`).
> 다만 상위 동작 변경에 대비해 Worker는 항상 `시작일 ≤ 주말종료 && 종료일 ≥ 주말시작`을 후처리로 재검증한다.

**응답 봉투:** `response.body.items.item[]` — 표준데이터(`response.body.items`)보다 **한 단계 깊다.**

**실제로 쓸 수 있는 필드 (2026-08 실측, 표본 561건)**

| 필드 | 채움률 | 용도 |
|---|---:|---|
| `contentid`, `title`, `eventstartdate`, `eventenddate` | 100% | 필수 |
| `addr1` | 100% | 주소·지역 폴백 |
| `lDongRegnCd` | 100% | **지역 판별 (주 경로)** |
| `lclsSystm1/2/3` | 100% | **카테고리 태그** |
| `mapx`(경도) / `mapy`(위도) | 100% | 좌표 |
| `tel` | 99.6% | 문의 |
| `firstimage` / `firstimage2` | 98.4% | 카드 이미지 |
| `progresstype` | 85.2% | 미사용 |
| `addr2` | 44.6% | 장소 (정리 후 실사용은 약 19%) |
| `cat1/2/3`, `areacode`, `sigungucode` | **0.7%** | **사용 불가** |
| `festivaltype` | **0.5%** | **사용 불가** |

### 2.3 `detailCommon2` / `detailIntro2` — 상세

- `detailCommon2?contentId=` → `overview`, `homepage`, `firstimage`, `addr1`, `tel`
- `detailIntro2?contentId=&contentTypeId=15` → `usetimefestival`(이용요금), `eventplace`, `playtime`, `agelimit`, `program`, `sponsor1`, `sponsor1tel`, `eventhomepage`

---

## 3. 파생 규칙

### 3.1 지역 판별

`lDongRegnCd` 앞 2자리를 우선 사용하고, 없으면 `addr1` 첫 토큰의 prefix로 폴백한다.
`includes()`가 아니라 **첫 토큰 prefix**여야 경기도 *광주*시와 *광주*광역시가 섞이지 않는다.

| 코드 | 지역 | 코드 | 지역 |
|---|---|---|---|
| 11 | 서울 | 41 | 경기 |
| **12** | **광주·전남** | 43 | 충북 |
| 26 | 부산 | 44 | 충남 |
| 27 | 대구 | 47 | 경북 |
| 28 | 인천 | 48 | 경남 |
| 30 | 대전 | 50 | 제주 |
| 31 | 울산 | **51** | **강원** |
| 36 | 세종 (`36110`처럼 5자리로 오므로 앞 2자리 매칭) | **52** | **전북** |

> **2026년 행정구역 개편** — 광주광역시와 전라남도가 `전남광주통합특별시`(코드 12)로 통합되어
> 상위 데이터에 개별 값이 존재하지 않는다. 명세서 §6.2의 18개 목록 대신 **16개 시·도 + 전국**을 쓴다.
> 강원·전북은 특별자치도 코드 `51`/`52`로 오며, 구 코드(`29`/`42`/`45`/`46`)도 방어적으로 매핑한다.

### 3.2 카테고리 태그

**1차 — `lclsSystm3` 매핑**

| 코드 | 태그 | 코드 | 태그 |
|---|---|---|---|
| EV010100 문화관광축제 | 축제 | EV020100~020900 | 공연 |
| EV010200 문화예술축제 | 축제, 공연 | EV021000 넌버벌 | 공연, 가족 |
| EV010300 지역특산물축제 | 축제, 먹거리 | EV030100 전시회 | 체험 |
| EV010400 전통역사축제 | 축제, 체험 | EV030200 박람회 | 체험 |
| EV010500 생태자연축제 | 축제, 야외, 가족 | EV030300 스포츠경기 | 야외 |
| EV010600 기타축제 | 축제 | EV030400 기타행사 | — |

`lclsSystm3`이 비면 `lclsSystm2`로 폴백 (`EV01`→축제, `EV02`→공연, `EV03`→체험).

**2차 — 행사명 키워드** (항상 추가 적용, 중복 제거)

카드에는 최대 3개를 표시하고 필터에는 전체 배열을 쓴다. **칩 선택은 OR** 조건이다.

### 3.3 무료 여부

목록 API에 요금 필드가 없다. 이용요금은 `detailIntro2`에만 있고 행사당 1회 호출이 필요하다.

- **목록** — 인기 상위 `MAX_ENRICH`(40)건만 `detailIntro2`로 요금을 확정한다.
  Workers 무료 플랜의 **요청당 subrequest 50개 한도** 때문이다. 유료 플랜(1,000)이면 상수만 올리면 된다.
  보강되지 않은 항목은 행사명에 `무료`가 있을 때만 추정 표시하고 `feeResolved=false`로 둔다.
- **판정 규칙** — 실측 예시가 `"무료"`, `"유료(셔틀버스 이용료 3,000원)"`,
  `"무료(먹거리장터의 경우 개별 음식구매는 유료)"` 형태다. 세 번째처럼 뒤에 `유료`가 섞여도
  입장 자체는 무료이므로 **앞머리를 우선** 본다.

  | 순서 | 조건 | 결과 |
  |---|---|---|
  | 1 | `^무료` | 무료 (확정) |
  | 2 | `^유료` | 유료 (확정) |
  | 3 | `숫자+원` 포함 | 유료 (확정) |
  | 4 | `무료`/`free` 포함 | 무료 (확정) |
  | 5 | 그 외 / 빈 값 | **미확인 — 무료로 간주하지 않음** |

  마지막 줄은 명세서 §8.3의 "무료 여부가 명확하게 확인되는 경우만 무료" 원칙 그대로다.

### 3.4 인기 정렬

사용자 행동 데이터가 없으므로 정보 충실도로 근사한다.

```
score = (이미지 100) + (주말 겹침일수 × 20) + (무료 15) + (전화 5) + (좌표 5) + (장소 3)
```

---

## 4. 캐싱 / 쿼터

| 대상 | TTL | 방식 |
|---|---|---|
| 목록 봉투 | 6시간 | `caches.default`, 합성 키 `https://kfest.cache/v2/weekend/{YYYYMMDD}` |
| 상위 요청 | 6시간 | `fetch(..., { cf: { cacheTtl } })` |
| 상세 | 24시간 | 사실상 정적 |
| health | 5분 | |

캐시 키를 주말 단위로 잡아 주말이 바뀌면 자연히 무효화된다.
**지역 필터는 캐시된 전체 집합에 대한 후처리**로 구현해 캐시가 지역별로 쪼개지지 않게 한다.

> Cache API는 `Cache-Control: no-cache`가 붙은 응답을 저장하지 않는다. 그래서 명시적 TTL을 준다.
> **로컬 `wrangler dev`에서는 `caches.default`와 `cf.cacheTtl`이 동작하지 않는다** —
> 캐시 검증은 `wrangler dev --remote` 또는 배포 후에 해야 한다.

---

## 5. 관련 파일

| 파일 | 역할 |
|------|------|
| `src/index.js` | Worker — 라우팅, 상위 호출, 정규화, 캐싱, 오류 매핑 |
| `public/index.html` | 단일 페이지 마크업 + 카드 `<template>` |
| `public/js/app.js` | 상태 → 필터 → 렌더 |
| `public/css/style.css` | 스타일 |
| `.dev.vars` | 로컬 키 (gitignore) |
| `.dev.vars.example` | 키 설정 템플릿 |
| `tour_API_Guide/` | 한국관광공사 공식 매뉴얼 |
