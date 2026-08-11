# K-FESTIVAL — 이번 주말, 어디 갈까?

우리 동네에서 열리는 축제와 문화행사를 쉽고 빠르게 찾는 웹 서비스입니다.
한국관광공사 공공데이터를 기반으로 **이번 주말에 갈 만한 행사**를 지역·날짜·무료 여부·관심사별로 골라 보여줍니다.

🔗 **Live Demo** → [https://ctfschedule.qudgns200.workers.dev](https://ctfschedule.qudgns200.workers.dev)

---

## 주요 기능

- **이번 주말 자동 조회** — 접속하면 별도 조작 없이 이번 주말(토·일) 행사가 바로 뜹니다. 주말에 하루라도 겹치면 노출되므로 장기 축제도 놓치지 않습니다.
- **지역 필터** — 16개 시·도로 좁혀 봅니다.
- **날짜 필터** — 전체 / 토요일 / 일요일.
- **무료 행사 필터** — 이용요금이 **확인된** 무료 행사만 골라 봅니다.
- **관심사 태그** — 가족 · 공연 · 체험 · 야외 · 먹거리 · 축제.
- **인기 행사 추천** — 정보가 충실하고 주말에 오래 겹치는 행사를 상단에 모아 보여줍니다.
- **행사 상세** — 소개, 이용요금, 관람시간, 문의처, 공식 홈페이지, 지도 링크.
- **❤️ 찜하기** — 회원가입 없이 브라우저에 저장됩니다.
- **모바일 우선 반응형** — 1열 → 2열 → 3열 → 4열.

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 런타임 | Cloudflare Workers |
| 언어 | HTML5, Vanilla JavaScript, CSS3 (프레임워크·빌드 없음) |
| 배포 | Wrangler CLI |
| 데이터 | 한국관광공사 TourAPI (`KorService2`) |
| 폰트 | Google Fonts (Noto Sans KR, Montserrat) |

---

## 프로젝트 구조

```
📦 Cultural-Tourism-Festival-Schedule
├── 📁 src/
│   └── index.js          ← Workers 진입점 (라우팅 · API 프록시 · 정규화 · 캐싱)
├── 📁 public/
│   ├── index.html        ← 단일 페이지
│   ├── 📁 css/style.css
│   └── 📁 js/app.js      ← 상태 → 필터 → 렌더
├── 📁 tour_API_Guide/    ← 한국관광공사 공식 매뉴얼
├── wrangler.toml
├── .dev.vars.example
├── API.md                ← API 명세서
└── HISTORY.md            ← 버전별 변경 이력
```

---

## 로컬 실행

### 1. API 키 발급

[공공데이터포털](https://www.data.go.kr)에서 **한국관광공사_국문 관광정보 서비스**를 활용신청합니다.
개발계정은 자동승인이며 **일 1,000건**을 제공합니다.

### 2. 환경변수 설정

`.dev.vars.example`을 복사해 `.dev.vars`를 만듭니다.

```bash
TOUR_API_KEY=발급받은_Decoding_키
```

> Encoding 키가 아니라 **Decoding 키**를 넣으세요. `.dev.vars`는 커밋되지 않습니다.

### 3. 개발 서버 실행

```bash
wrangler dev
```

키가 제대로 들어갔는지는 `/api/health`로 바로 확인할 수 있습니다.

```bash
curl http://localhost:8787/api/health
# {"ok":true,"resultCode":"0000","resultMsg":"OK","totalCount":59,...}
```

---

## 배포

```bash
wrangler secret put TOUR_API_KEY   # 프로덕션 키는 코드가 아닌 Secret으로
wrangler deploy
```

---

## API

| 엔드포인트 | 설명 |
|------------|------|
| `GET /api/health` | 상위 API 연결 진단 |
| `GET /api/festivals` | 이번 주말 행사 목록 |
| `GET /api/festivals?region=서울` | 지역으로 필터링 |
| `GET /api/festivals/:id` | 행사 상세 |

응답 필드, 오류 코드, 지역·태그·무료 판정 규칙은 [API.md](API.md)에 정리되어 있습니다.

---

## 개발 이력

버전별 상세 내역은 [HISTORY.md](HISTORY.md)를 참고하세요.

| 버전 | 내용 |
|------|------|
| v0.1 | Flask 기반 초기 개발 |
| v0.2 | Cloudflare Workers 마이그레이션 |
| v0.3 | 라우팅·에러 핸들링 안정화 |
| v0.4 | Glassmorphism UI 리디자인 |
| v0.5 | API 키 환경변수 분리 (보안) |
| v0.6 | Vibrant Festival 스타일 리디자인 |
| v0.7 | 날짜 검색 기능 추가 |
| **v2.0** | **TourAPI 전환 · 주말 발견 서비스로 리뉴얼** |

---

## 데이터 출처

한국관광공사 국문 관광정보 서비스 (공공데이터포털)
