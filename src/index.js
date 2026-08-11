/**
 * K-FESTIVAL 2.0 — Cloudflare Workers 진입점
 *
 * 라우팅
 *   GET /api/health         상위 API 연결 진단 (키 만료 즉시 식별)
 *   GET /api/festivals      이번 주말 행사 목록 (KST 기준)
 *   GET /api/festivals/:id  행사 상세 (detailCommon2 + detailIntro2)
 *   그 외                    public/ 정적 파일
 *
 * 상위: 한국관광공사 TourAPI KorService2 (개발계정 일 1,000건)
 */

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const TOUR_API_BASE = 'https://apis.data.go.kr/B551011/KorService2';
const MOBILE_APP = 'K-FESTIVAL';

/** 일요일에 접속하면 다음 주말이 아니라 오늘 포함 이번 주말을 보여준다. */
const SUNDAY_SHOWS_CURRENT_WEEKEND = true;

/**
 * TourAPI의 eventStartDate/eventEndDate는 "겹침" 의미로 동작함을 실측 확인(Step 0.2).
 * 주말 창만 요청해도 이전에 시작한 장기 행사가 함께 반환되므로 소급 조회가 불필요하다.
 * 만약 상위 동작이 바뀌면 이 값만 올리면 된다 — 후처리 겹침 필터는 항상 적용된다.
 */
const LOOKBACK_DAYS = 0;

/** 한 번에 받는 행사 수. 실측상 1000 요청 시 전량 반환되어 페이지네이션이 사실상 불필요. */
const PAGE_SIZE = 1000;
const MAX_PAGES = 5;

/**
 * 요금 보강 상한.
 * Workers 무료 플랜은 요청당 subrequest 50개가 한도다.
 * 목록 1회 + 보강 MAX_ENRICH회가 그 안에 들어와야 한다.
 * 유료 플랜(한도 1,000)이면 200 이상으로 올려도 된다.
 */
const MAX_ENRICH = 40;
const ENRICH_CONCURRENCY = 8;

const UPSTREAM_TIMEOUT_MS = 8000;
const LIST_CACHE_TTL = 21600;   // 6시간
const DETAIL_CACHE_TTL = 86400; // 24시간 — 상세는 사실상 정적

/**
 * 지역 목록.
 * 2026년 행정구역 개편으로 광주광역시와 전라남도가 '전남광주통합특별시'로 통합되어
 * 상위 데이터에 개별 값이 존재하지 않는다(Step 0.6 실측). 데이터에 맞춰 하나로 묶는다.
 */
const REGIONS = [
  '서울', '부산', '대구', '인천', '광주·전남', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '경북', '경남', '제주',
];

/**
 * 법정동 시도 코드 → 지역. lDongRegnCd는 100% 채워져 있어 주소 파싱보다 신뢰도가 높다.
 * 세종은 36110처럼 5자리로 오는 경우가 있어 앞 2자리로 매칭한다.
 * 구 코드(29 광주, 42 강원, 45 전북, 46 전남)는 방어적으로 함께 매핑한다.
 */
const REGN_CD_TO_REGION = {
  11: '서울', 12: '광주·전남', 26: '부산', 27: '대구', 28: '인천',
  29: '광주·전남', 30: '대전', 31: '울산', 36: '세종', 41: '경기',
  42: '강원', 43: '충북', 44: '충남', 45: '전북', 46: '광주·전남',
  47: '경북', 48: '경남', 50: '제주', 51: '강원', 52: '전북',
};

/**
 * 주소 첫 토큰 prefix → 지역 (lDongRegnCd가 없을 때의 폴백).
 * includes()가 아니라 첫 토큰 prefix로 매칭해야 '경기도 광주시'와 '광주광역시'가 섞이지 않는다.
 */
const ADDR_PREFIX_TO_REGION = [
  ['서울', '서울'], ['부산', '부산'], ['대구', '대구'], ['인천', '인천'],
  ['광주', '광주·전남'], ['전남', '광주·전남'], ['전라남', '광주·전남'],
  ['대전', '대전'], ['울산', '울산'], ['세종', '세종'], ['경기', '경기'],
  ['강원', '강원'], ['충북', '충북'], ['충청북', '충북'],
  ['충남', '충남'], ['충청남', '충남'], ['전북', '전북'], ['전라북', '전북'],
  ['경북', '경북'], ['경상북', '경북'], ['경남', '경남'], ['경상남', '경남'],
  ['제주', '제주'],
];

/** 카테고리 태그. 분류체계 소분류(lclsSystm3)는 실측 100% 채워져 있다. */
const CATEGORIES = ['가족', '공연', '체험', '야외', '먹거리', '축제'];

const LCLS3_TAGS = {
  EV010100: ['축제'],                  // 문화관광축제
  EV010200: ['축제', '공연'],           // 문화예술축제
  EV010300: ['축제', '먹거리'],         // 지역특산물축제
  EV010400: ['축제', '체험'],           // 전통역사축제
  EV010500: ['축제', '야외', '가족'],   // 생태자연축제
  EV010600: ['축제'],                  // 기타축제
  EV020100: ['공연'], EV020200: ['공연'], EV020300: ['공연'],
  EV020400: ['공연'], EV020500: ['공연'], EV020600: ['공연'],
  EV020700: ['공연'], EV020800: ['공연'], EV020900: ['공연'],
  EV021000: ['공연', '가족'],           // 넌버벌
  EV030100: ['체험'],                  // 전시회
  EV030200: ['체험'],                  // 박람회
  EV030300: ['야외'],                  // 스포츠경기
  EV030400: [],                        // 기타행사
};

const LCLS2_TAGS = { EV01: ['축제'], EV02: ['공연'], EV03: ['체험'] };

const KEYWORD_TAGS = [
  ['가족', /아이|어린이|가족|키즈|유아|동화|캐릭터|놀이|인형/],
  ['먹거리', /음식|맛|먹거리|미식|푸드|막걸리|커피|와인|맥주|딸기|사과|포도|한우|수산|김치|떡|빵|치맥/],
  ['야외', /꽃|벚꽃|장미|튤립|국화|단풍|억새|해변|바다|공원|캠핑|불꽃|야경|숲|정원|해수욕/],
  ['체험', /체험|만들기|공방|워크숍|워크샵|클래스|플리마켓|마켓/],
  ['공연', /공연|콘서트|페스티벌|뮤지컬|연극|음악|재즈|국악|버스킹/],
  ['축제', /축제|페스타|festival/i],
];

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────

const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

/** 상위 데이터에 HTML 엔티티가 섞여 온다. 클라이언트가 textContent를 쓰므로 서버에서 푼다. */
function decodeEntities(s) {
  if (!s) return '';
  return String(s)
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => HTML_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));
}

/** <br>은 줄바꿈으로 살리고 나머지 태그는 제거한 뒤 엔티티를 푼다. */
function stripTags(s) {
  if (!s) return '';
  return decodeEntities(
    String(s)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]*>/g, '')
  ).replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * addr2(상세주소)에는 "3953" 같은 숫자 부스러기가 섞여 온다.
 * 그대로 장소로 표시하면 카드가 고장난 것처럼 보이므로 의미 없는 값은 버린다.
 */
function cleanPlace(s) {
  const v = decodeEntities(s ?? '').trim();
  if (!v || v.length < 2) return '';
  if (/^[\d\s.,\-()]+$/.test(v)) return ''; // 숫자·기호뿐
  return v;
}

/** HTTPS 페이지에서 http:// 이미지는 혼합 콘텐츠로 차단된다(실측 552건 중 4건 존재). */
function httpsify(url) {
  if (!url) return '';
  const u = String(url).trim();
  if (!u) return '';
  return u.startsWith('http://') ? 'https://' + u.slice(7) : u;
}

/** 문자열에서 첫 http(s) URL을 뽑는다. homepage는 평문 URL일 수도, <a> 덩어리일 수도 있다. */
function extractUrl(raw) {
  if (!raw) return null;
  const s = decodeEntities(String(raw));
  const href = s.match(/href\s*=\s*["']([^"']+)["']/i);
  const cand = href ? href[1] : (s.match(/https?:\/\/[^\s"'<>)]+/i) || [])[0];
  if (!cand) return null;
  return /^https?:\/\//i.test(cand) ? cand : null;
}

const pad2 = (n) => String(n).padStart(2, '0');
const toCompact = (d) => `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
const toDashed = (c) => (c && c.length === 8 ? `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}` : '');

function shiftCompact(compact, days) {
  const d = new Date(`${toDashed(compact)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toCompact(d);
}

/**
 * KST 기준 '이번 주말'.
 * KST는 DST가 없는 고정 +09:00이므로 오프셋을 더한 뒤 getUTC* 로 읽으면 KST 벽시계가 된다.
 * Worker는 UTC로 도므로 이 보정이 없으면 한국 시각 00~09시에 하루가 어긋난다.
 */
function getWeekend(nowMs = Date.now(), todayOverride = null) {
  let kst;
  if (todayOverride) {
    kst = new Date(`${todayOverride}T00:00:00Z`);
  } else {
    kst = new Date(nowMs + 9 * 3600 * 1000);
  }
  const dow = kst.getUTCDay(); // 0=일 … 6=토
  const sat = new Date(kst);
  if (dow === 0) {
    sat.setUTCDate(kst.getUTCDate() + (SUNDAY_SHOWS_CURRENT_WEEKEND ? -1 : 6));
  } else if (dow !== 6) {
    sat.setUTCDate(kst.getUTCDate() + (6 - dow));
  }
  const sun = new Date(sat);
  sun.setUTCDate(sat.getUTCDate() + 1);
  const startCompact = toCompact(sat);
  const endCompact = toCompact(sun);
  return { start: toDashed(startCompact), end: toDashed(endCompact), startCompact, endCompact };
}

// ─────────────────────────────────────────────────────────────
// 상위 API 호출
// ─────────────────────────────────────────────────────────────

class UpstreamError extends Error {
  constructor(code, message, detail, status) {
    super(message);
    this.code = code;
    this.detail = detail;
    this.status = status || 502;
  }
}

const AUTH_CODES = new Set(['20', '30', '31', '32']);

function mapUpstreamError(errMsg, reasonCode) {
  const code = String(reasonCode ?? '').trim();
  if (code === '22' || /LIMITED_NUMBER_OF_SERVICE_REQUESTS/.test(errMsg || '')) {
    return new UpstreamError('QUOTA_EXCEEDED', '오늘 조회 한도를 초과했어요.', errMsg, 429);
  }
  if (AUTH_CODES.has(code) || /SERVICE_KEY|DEADLINE|ACCESS_DENIED|UNREGISTERED/.test(errMsg || '')) {
    return new UpstreamError('AUTH_ERROR', '행사 정보를 불러오지 못했어요.', errMsg, 502);
  }
  return new UpstreamError('UPSTREAM_ERROR', '행사 정보를 불러오지 못했어요.', errMsg, 502);
}

/**
 * TourAPI 호출.
 * data.go.kr은 Encoding/Decoding 두 형태의 키를 발급한다.
 * 이미 퍼센트 인코딩된 키면 한 번 풀어서, URLSearchParams가 정확히 한 번만 인코딩하게 한다.
 * (이중 인코딩 %2B → %252B 가 전형적인 인증 실패 원인)
 */
async function callTourApi(env, op, params, cacheTtl) {
  const rawKey = env.TOUR_API_KEY || env.SERVICE_KEY;
  if (!rawKey) {
    throw new UpstreamError('CONFIG_ERROR', '서버 설정이 올바르지 않아요.', 'TOUR_API_KEY 미설정', 500);
  }
  const key = /%[0-9A-Fa-f]{2}/.test(rawKey) ? decodeURIComponent(rawKey) : rawKey;

  const url = new URL(`${TOUR_API_BASE}/${op}`);
  const all = {
    serviceKey: key, MobileOS: 'ETC', MobileApp: env.MOBILE_APP || MOBILE_APP,
    _type: 'json', ...params,
  };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, String(v));

  let res;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cf: cacheTtl
        ? { cacheTtl, cacheTtlByStatus: { '200-299': cacheTtl, '400-499': 0, '500-599': 0 } }
        : undefined,
    });
  } catch (e) {
    throw new UpstreamError('UPSTREAM_ERROR', '행사 정보를 불러오지 못했어요.',
      e.name === 'TimeoutError' ? '상위 API 응답 시간 초과' : String(e.message), 502);
  }

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 아래에서 처리 */ }

  // 인증/쿼터 오류는 HTTP 403 + JSON OpenAPI_ServiceResponse 로 온다(Step 0.8 실측).
  const errHeader = json?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (errHeader) {
    throw mapUpstreamError(errHeader.errMsg, errHeader.returnReasonCode);
  }
  if (!json) {
    // XML 오류 봉투 등 JSON이 아닌 응답
    const m = text.match(/<returnAuthMsg>([^<]*)<\/returnAuthMsg>/) || text.match(/<errMsg>([^<]*)<\/errMsg>/);
    throw mapUpstreamError(m ? m[1] : 'NON_JSON_RESPONSE', null);
  }
  if (!res.ok) {
    throw new UpstreamError('UPSTREAM_ERROR', '행사 정보를 불러오지 못했어요.', `HTTP ${res.status}`, 502);
  }

  const header = json?.response?.header;
  const code = String(header?.resultCode ?? '').trim();
  // NODATA는 오류가 아니라 '결과 없음'이다.
  if (code === '03' || /NODATA/i.test(header?.resultMsg || '')) {
    return { items: [], totalCount: 0, header };
  }
  if (code !== '0000' && code !== '00') {
    throw mapUpstreamError(header?.resultMsg, code);
  }

  const body = json?.response?.body;
  const rawItems = body?.items;
  let list = [];
  if (rawItems && rawItems !== '') {
    const it = rawItems.item;
    if (it) list = Array.isArray(it) ? it : [it];
  }
  return { items: list, totalCount: Number(body?.totalCount ?? list.length), header };
}

// ─────────────────────────────────────────────────────────────
// 정규화 / 파생
// ─────────────────────────────────────────────────────────────

function deriveRegion(raw) {
  const cd = String(raw.lDongRegnCd ?? '').trim();
  if (cd) {
    const hit = REGN_CD_TO_REGION[Number(cd.slice(0, 2))];
    if (hit) return hit;
  }
  const token = String(raw.addr1 ?? '').trim().split(/\s+/)[0] || '';
  for (const [prefix, region] of ADDR_PREFIX_TO_REGION) {
    if (token.startsWith(prefix)) return region;
  }
  return '기타';
}

function deriveTags(raw) {
  const tags = new Set();
  const l3 = String(raw.lclsSystm3 ?? '').trim();
  const l2 = String(raw.lclsSystm2 ?? '').trim();
  for (const t of LCLS3_TAGS[l3] ?? LCLS2_TAGS[l2] ?? []) tags.add(t);

  const title = decodeEntities(raw.title ?? '');
  for (const [tag, re] of KEYWORD_TAGS) if (re.test(title)) tags.add(tag);

  if (tags.size === 0 && String(raw.lclsSystm1 ?? '') === 'EV') tags.add('축제');
  return CATEGORIES.filter((c) => tags.has(c)); // 항상 같은 순서로
}

/**
 * 이용요금 문자열 판정.
 * 실측 예: "무료" / "유료(셔틀버스 이용료 3,000원)" / "무료(먹거리장터의 경우 개별 음식구매는 유료)"
 * 세 번째처럼 '유료'가 뒤에 섞여도 입장 자체는 무료이므로 앞머리를 우선 본다.
 * §8.3 원칙: 명확히 확인되지 않으면 무료로 간주하지 않는다.
 */
function parseFee(rawFee) {
  const text = stripTags(rawFee);
  if (!text) return { raw: '', isFree: false, resolved: false };
  if (/^\s*무료/.test(text)) return { raw: text, isFree: true, resolved: true };
  if (/^\s*유료/.test(text)) return { raw: text, isFree: false, resolved: true };
  if (/\d[\d,]*\s*원/.test(text)) return { raw: text, isFree: false, resolved: true };
  if (/무료|free/i.test(text)) return { raw: text, isFree: true, resolved: true };
  return { raw: text, isFree: false, resolved: false };
}

function overlapDays(startC, endC, weekend) {
  const s = startC > weekend.startCompact ? startC : weekend.startCompact;
  const e = endC < weekend.endCompact ? endC : weekend.endCompact;
  if (s > e) return 0;
  return s === e ? 1 : 2;
}

function normalize(raw, weekend) {
  const title = decodeEntities(raw.title ?? '').trim();
  const startCompact = String(raw.eventstartdate ?? '').trim();
  const endCompact = String(raw.eventenddate ?? '').trim();
  const lat = parseFloat(raw.mapy); // mapy=위도, mapx=경도 (순서 주의)
  const lng = parseFloat(raw.mapx);

  return {
    id: String(raw.contentid ?? ''),
    title,
    place: cleanPlace(raw.addr2),
    address: decodeEntities(raw.addr1 ?? '').trim(),
    region: deriveRegion(raw),
    startDate: toDashed(startCompact),
    endDate: toDashed(endCompact),
    startCompact,
    endCompact,
    image: httpsify(raw.firstimage),
    thumb: httpsify(raw.firstimage2),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    tel: decodeEntities(raw.tel ?? '').trim(),
    tags: deriveTags(raw),
    isFree: /무료/.test(title),
    feeResolved: false,
    fee: '',
    overlapDays: overlapDays(startCompact, endCompact, weekend),
  };
}

/** §11 인기 정렬 — 사용자 행동 데이터가 없으므로 정보 충실도로 근사한다. */
function popularityScore(f) {
  return (f.image ? 100 : 0)
    + f.overlapDays * 20
    + (f.isFree ? 15 : 0)
    + (f.tel ? 5 : 0)
    + (f.lat !== null ? 5 : 0)
    + (f.place ? 3 : 0);
}

/** 동시 실행 수를 제한한 map. 상위 API를 한꺼번에 때리지 않기 위함. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx], idx);
      }
    })
  );
  return out;
}

// ─────────────────────────────────────────────────────────────
// 응답 헬퍼
// ─────────────────────────────────────────────────────────────

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
};

function json(body, { status = 200, cache = null, extra = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...BASE_HEADERS,
      // Cache API는 no-cache가 붙은 응답을 저장하지 않으므로 명시적 TTL을 준다.
      'Cache-Control': cache ?? 'no-store',
      ...extra,
    },
  });
}

function errorEnvelope(e, weekend) {
  const err = e instanceof UpstreamError
    ? e
    : new UpstreamError('INTERNAL_ERROR', '행사 정보를 불러오지 못했어요.', String(e?.message ?? e), 500);
  return {
    body: {
      ok: false,
      generatedAt: new Date().toISOString(),
      weekend: weekend ?? null,
      counts: { total: 0, returned: 0, upstreamTotal: 0 },
      truncated: false,
      warnings: [],
      items: [],
      error: { code: err.code, message: err.message, detail: err.detail ?? null },
    },
    status: err.status,
  };
}

// ─────────────────────────────────────────────────────────────
// 라우트: /api/festivals
// ─────────────────────────────────────────────────────────────

async function buildWeekendPayload(env, weekend) {
  const warnings = [];

  // 1) 목록 — 겹침 의미이므로 주말 창만 요청하면 장기 행사도 함께 온다.
  const first = await callTourApi(env, 'searchFestival2', {
    eventStartDate: LOOKBACK_DAYS ? shiftCompact(weekend.startCompact, -LOOKBACK_DAYS) : weekend.startCompact,
    eventEndDate: weekend.endCompact,
    numOfRows: PAGE_SIZE,
    pageNo: 1,
    arrange: 'C',
  }, LIST_CACHE_TTL);

  let rawItems = first.items;
  const upstreamTotal = first.totalCount;
  let truncated = false;

  if (upstreamTotal > rawItems.length && rawItems.length > 0) {
    const pages = Math.min(Math.ceil(upstreamTotal / rawItems.length), MAX_PAGES);
    const rest = await Promise.all(
      Array.from({ length: pages - 1 }, (_, k) =>
        callTourApi(env, 'searchFestival2', {
          eventStartDate: weekend.startCompact, eventEndDate: weekend.endCompact,
          numOfRows: PAGE_SIZE, pageNo: k + 2, arrange: 'C',
        }, LIST_CACHE_TTL).catch((e) => {
          // 1페이지는 이미 확보했으므로 부분 반환하되 사실을 숨기지 않는다.
          warnings.push(`페이지 ${k + 2} 조회 실패: ${e.code ?? 'ERROR'}`);
          truncated = true;
          return { items: [] };
        })
      )
    );
    for (const r of rest) rawItems = rawItems.concat(r.items);
    if (Math.ceil(upstreamTotal / PAGE_SIZE) > MAX_PAGES) truncated = true;
  }

  // 2) 정규화 + 겹침 후처리 (상위 필터 의미가 바뀌어도 안전하도록 항상 적용)
  const seen = new Set();
  let items = rawItems
    .filter((r) => String(r.contenttypeid ?? '15') === '15')
    .map((r) => normalize(r, weekend))
    .filter((f) => {
      if (!f.id || !f.title || !f.startCompact || !f.endCompact) return false;
      if (f.startCompact > weekend.endCompact || f.endCompact < weekend.startCompact) return false;
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });

  items.sort((a, b) => popularityScore(b) - popularityScore(a) || a.title.localeCompare(b.title, 'ko'));

  // 3) 요금 보강 — subrequest 한도 안에서 인기 상위부터
  const targets = items.slice(0, MAX_ENRICH);
  if (targets.length) {
    const fees = await mapLimit(targets, ENRICH_CONCURRENCY, async (f) => {
      try {
        const r = await callTourApi(env, 'detailIntro2',
          { contentId: f.id, contentTypeId: 15 }, DETAIL_CACHE_TTL);
        return parseFee((r.items[0] ?? {}).usetimefestival);
      } catch {
        return null; // 개별 실패는 목록 전체를 망치지 않는다
      }
    });
    let failed = 0;
    fees.forEach((fee, i) => {
      if (!fee) { failed++; return; }
      targets[i].fee = fee.raw;
      targets[i].feeResolved = fee.resolved;
      if (fee.resolved) targets[i].isFree = fee.isFree;
    });
    if (failed) warnings.push(`요금 정보 ${failed}건 조회 실패`);
  }
  if (items.length > MAX_ENRICH) {
    warnings.push(`요금 정보는 상위 ${MAX_ENRICH}건만 확인되었습니다.`);
  }

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    weekend,
    counts: { total: items.length, returned: items.length, upstreamTotal },
    truncated,
    warnings,
    items,
    error: null,
  };
}

async function handleFestivals(url, env, ctx) {
  const debug = env.DEBUG === '1' || env.DEBUG === 'true';

  const todayParam = debug ? url.searchParams.get('today') : null;
  if (todayParam && !/^\d{4}-\d{2}-\d{2}$/.test(todayParam)) {
    return json({ ok: false, error: { code: 'BAD_REQUEST', message: 'today 형식은 YYYY-MM-DD 입니다.' } }, { status: 400 });
  }
  const weekend = getWeekend(Date.now(), todayParam);

  const region = url.searchParams.get('region');
  if (region && region !== 'all' && !REGIONS.includes(region)) {
    return json({
      ok: false,
      error: { code: 'BAD_REQUEST', message: '알 수 없는 지역입니다.', detail: `허용: all, ${REGIONS.join(', ')}` },
    }, { status: 400 });
  }

  const cache = caches.default;
  // 쿼리 순서로 캐시가 쪼개지지 않도록 합성 키를 쓴다. 주말이 바뀌면 자연히 무효화된다.
  const cacheKey = new Request(`https://kfest.cache/v2/weekend/${weekend.startCompact}`);

  let payload = null;
  let hit = false;
  if (!debug) {
    const cached = await cache.match(cacheKey);
    if (cached) { payload = await cached.json(); hit = true; }
  }

  if (!payload) {
    try {
      payload = await buildWeekendPayload(env, weekend);
      if (!debug) {
        const store = new Response(JSON.stringify(payload), {
          headers: { ...BASE_HEADERS, 'Cache-Control': `public, max-age=${LIST_CACHE_TTL}` },
        });
        ctx.waitUntil(cache.put(cacheKey, store));
      }
    } catch (e) {
      // stale-on-error: 오래된 데이터라도 있으면 장애 화면보다 낫다.
      const stale = await cache.match(cacheKey);
      if (stale) {
        const body = await stale.json();
        body.stale = true;
        body.warnings = [...(body.warnings ?? []), '최신 정보를 불러오지 못해 이전 데이터를 표시합니다.'];
        return json(body, { cache: 'public, max-age=60', extra: { 'X-Cache': 'STALE' } });
      }
      const { body, status } = errorEnvelope(e, weekend);
      return json(body, { status });
    }
  }

  // 지역 필터는 캐시된 전체 집합에 대한 후처리 — 캐시를 지역별로 쪼개지 않는다.
  let items = payload.items;
  if (region && region !== 'all') items = items.filter((f) => f.region === region);

  return json(
    { ...payload, items, counts: { ...payload.counts, returned: items.length } },
    { cache: `public, max-age=600, s-maxage=${LIST_CACHE_TTL}`, extra: { 'X-Cache': hit ? 'HIT' : 'MISS' } }
  );
}

// ─────────────────────────────────────────────────────────────
// 라우트: /api/festivals/:id
// ─────────────────────────────────────────────────────────────

async function handleDetail(id, env) {
  const [common, intro] = await Promise.all([
    callTourApi(env, 'detailCommon2', { contentId: id }, DETAIL_CACHE_TTL),
    callTourApi(env, 'detailIntro2', { contentId: id, contentTypeId: 15 }, DETAIL_CACHE_TTL),
  ]);

  const c = common.items[0];
  const i = intro.items[0] ?? {};
  if (!c) {
    return json({ ok: false, error: { code: 'NOT_FOUND', message: '행사를 찾을 수 없어요.' } }, { status: 404 });
  }

  const fee = parseFee(i.usetimefestival);
  // homepage는 평문 URL일 수도, <a href=...> 덩어리일 수도 있다(둘 다 실측 확인).
  const homepage = extractUrl(i.eventhomepage) ?? extractUrl(c.homepage);

  return json({
    ok: true,
    item: {
      id: String(c.contentid ?? id),
      title: decodeEntities(c.title ?? '').trim(),
      overview: stripTags(c.overview),
      address: decodeEntities(c.addr1 ?? '').trim(),
      place: cleanPlace(i.eventplace) || cleanPlace(c.addr2),
      region: deriveRegion(c),
      startDate: toDashed(String(i.eventstartdate ?? '').trim()),
      endDate: toDashed(String(i.eventenddate ?? '').trim()),
      image: httpsify(c.firstimage),
      lat: Number.isFinite(parseFloat(c.mapy)) ? parseFloat(c.mapy) : null,
      lng: Number.isFinite(parseFloat(c.mapx)) ? parseFloat(c.mapx) : null,
      tel: decodeEntities(i.sponsor1tel || c.tel || '').trim(),
      homepage,
      fee: { raw: fee.raw, isFree: fee.isFree, resolved: fee.resolved },
      playtime: stripTags(i.playtime),
      agelimit: stripTags(i.agelimit),
      program: stripTags(i.program),
      sponsor: decodeEntities(i.sponsor1 ?? '').trim(),
      tags: deriveTags(c),
    },
    error: null,
  }, { cache: `public, max-age=3600, s-maxage=${DETAIL_CACHE_TTL}` });
}

// ─────────────────────────────────────────────────────────────
// 라우트: /api/health
// ─────────────────────────────────────────────────────────────

async function handleHealth(env) {
  const weekend = getWeekend();
  try {
    const r = await callTourApi(env, 'searchFestival2', {
      eventStartDate: weekend.startCompact, eventEndDate: weekend.endCompact,
      numOfRows: 1, pageNo: 1,
    }, 300);
    return json({
      ok: true,
      upstream: 'KorService2/searchFestival2',
      resultCode: r.header?.resultCode ?? null,
      resultMsg: r.header?.resultMsg ?? null,
      totalCount: r.totalCount,
      weekend,
    });
  } catch (e) {
    const err = e instanceof UpstreamError ? e : new UpstreamError('INTERNAL_ERROR', String(e?.message ?? e));
    return json({
      ok: false,
      upstream: 'KorService2/searchFestival2',
      error: { code: err.code, message: err.message, detail: err.detail ?? null },
      weekend,
    }, { status: err.status });
  }
}

// ─────────────────────────────────────────────────────────────
// 진입점
// ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname.startsWith('/api/')) {
        if (request.method === 'OPTIONS') {
          return new Response(null, {
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Max-Age': '86400',
            },
          });
        }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '지원하지 않는 요청입니다.' } },
            { status: 405, extra: { Allow: 'GET, OPTIONS' } });
        }

        if (pathname === '/api/health') return handleHealth(env);
        if (pathname === '/api/festivals') return handleFestivals(url, env, ctx);

        const detail = pathname.match(/^\/api\/festivals\/(\d{1,12})$/);
        if (detail) return handleDetail(detail[1], env);

        // 매칭되지 않는 /api/* 는 정적 파일로 흘리지 않는다.
        return json({ ok: false, error: { code: 'NOT_FOUND', message: '존재하지 않는 경로입니다.' } }, { status: 404 });
      }

      // 구 버전 경로 정리
      if (pathname === '/list.html') {
        return Response.redirect(new URL('/', url).toString(), 301);
      }

      return env.ASSETS.fetch(request);
    } catch (e) {
      if (pathname.startsWith('/api/')) {
        const { body, status } = errorEnvelope(e, null);
        return json(body, { status });
      }
      return new Response('Internal Error', { status: 500 });
    }
  },
};
