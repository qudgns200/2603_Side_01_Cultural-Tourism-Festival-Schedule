/* ============================================================
   K-FESTIVAL 2.0 — app.js
   흐름: state 변경 → applyFilters() → render()
   원칙: API 문자열은 textContent/setAttribute로만 넣는다 (innerHTML 금지).
   ============================================================ */
(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────

  var REGIONS = ['서울', '부산', '대구', '인천', '광주·전남', '대전', '울산', '세종',
    '경기', '강원', '충북', '충남', '전북', '경북', '경남', '제주'];

  var FAV_KEY = 'favoriteFestivals';
  var FAV_VERSION = 2;
  var POPULAR_MAX = 10;

  // ── STATE ─────────────────────────────────────────────────

  var state = {
    region: 'all',
    weekend: null,
    dateFilter: 'all',      // 'all' | 'sat' | 'sun'
    freeOnly: false,
    categories: [],
    favoritesOnly: false,
    festivals: [],
    filtered: [],
    favorites: [],
    status: 'idle',         // 'idle' | 'loading' | 'ready' | 'error'
    error: null,
  };

  var el = {};

  // ── FAVORITES (LocalStorage) ──────────────────────────────
  // id만 저장하면 지난 주 찜한 행사가 이번 주말 목록에 없어 아무것도 못 그린다.
  // 그래서 화면을 그리기에 충분한 스냅샷을 통째로 저장한다.

  function loadFavorites() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;                    // v1 형식
      if (parsed && Array.isArray(parsed.items)) return parsed.items;
      return [];
    } catch (e) {
      return []; // Safari 프라이빗 모드 등에서 접근 자체가 실패할 수 있다
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify({ v: FAV_VERSION, items: state.favorites }));
    } catch (e) { /* 저장 실패해도 화면 동작은 계속된다 */ }
  }

  function isFav(id) {
    return state.favorites.some(function (f) { return f.id === id; });
  }

  function toggleFav(item) {
    if (isFav(item.id)) {
      state.favorites = state.favorites.filter(function (f) { return f.id !== item.id; });
    } else {
      state.favorites = state.favorites.concat([{
        id: item.id, title: item.title, endDate: item.endDate,
        region: item.region, image: item.image, savedAt: new Date().toISOString(),
      }]);
    }
    saveFavorites();
    updateFavBadge();
  }

  function updateFavBadge() {
    el.favBadge.textContent = String(state.favorites.length);
  }

  // ── API ───────────────────────────────────────────────────

  function fetchFestivals() {
    setState({ status: 'loading', error: null });
    return fetch('/api/festivals')
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (body) {
          return { res: res, body: body };
        });
      })
      .then(function (r) {
        var body = r.body;
        if (!body || body.ok !== true) {
          var code = (body && body.error && body.error.code) || 'UPSTREAM_ERROR';
          throw { code: code };
        }
        state.weekend = body.weekend;
        setState({ festivals: body.items || [], status: 'ready', error: null });
        renderWeekendLine();
      })
      .catch(function (e) {
        setState({ status: 'error', error: (e && e.code) || 'NETWORK_ERROR', festivals: [] });
      });
  }

  function fetchDetail(id) {
    return fetch('/api/festivals/' + encodeURIComponent(id))
      .then(function (res) { return res.json(); })
      .then(function (body) {
        if (!body || body.ok !== true) throw new Error('detail');
        return body.item;
      });
  }

  // ── DERIVE ────────────────────────────────────────────────

  var DOW = ['일', '월', '화', '수', '목', '금', '토'];

  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return Number(p[1]) + '.' + Number(p[2]);
  }

  function fmtLong(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T00:00:00Z');
    return Number(iso.split('-')[1]) + '월 ' + Number(iso.split('-')[2]) + '일(' + DOW[d.getUTCDay()] + ')';
  }

  /** 카드 위치 문구. addr2는 채워진 비율이 낮아(약 19%) 주소를 기본으로 쓴다. */
  function locationText(f) {
    var addr = f.address || '';
    var parts = addr.split(/\s+/).filter(Boolean);
    var base = parts.length >= 2 ? parts[0] + ' ' + parts[1] : (addr || f.region || '');
    return f.place ? base + ' · ' + f.place : (base || '장소 정보 없음');
  }

  function matchesDate(f, which) {
    if (which === 'all') return true;
    var day = which === 'sat' ? state.weekend.startCompact : state.weekend.endCompact;
    return f.startCompact <= day && f.endCompact >= day;
  }

  // ── FILTER ────────────────────────────────────────────────

  function applyFilters() {
    var out = state.festivals;

    if (state.favoritesOnly) {
      out = out.filter(function (f) { return isFav(f.id); });
    }
    if (state.region !== 'all') {
      out = out.filter(function (f) { return f.region === state.region; });
    }
    if (state.dateFilter !== 'all') {
      out = out.filter(function (f) { return matchesDate(f, state.dateFilter); });
    }
    if (state.freeOnly) {
      // §8.3 — 무료임이 확인된 것만. 미확인은 무료로 치지 않는다.
      out = out.filter(function (f) { return f.isFree === true; });
    }
    if (state.categories.length) {
      out = out.filter(function (f) {
        return state.categories.some(function (c) { return f.tags.indexOf(c) !== -1; });
      });
    }
    state.filtered = out;
  }

  function hasAnyFilter() {
    return state.region !== 'all' || state.dateFilter !== 'all' ||
      state.freeOnly || state.categories.length > 0 || state.favoritesOnly;
  }

  function setState(patch) {
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    applyFilters();
    render();
  }

  // ── RENDER ────────────────────────────────────────────────

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function renderWeekendLine() {
    if (!state.weekend) return;
    el.weekendLine.textContent = fmtLong(state.weekend.start) + ' ~ ' + fmtLong(state.weekend.end);
  }

  function buildCard(f) {
    var node = el.cardTpl.content.cloneNode(true);
    var card = node.querySelector('.card');
    card.dataset.id = f.id;

    var img = node.querySelector('.card-img');
    var noimg = node.querySelector('.card-noimg');
    if (f.image) {
      img.src = f.image;
      img.alt = f.title + ' 포스터';
      // 상위 이미지 서버가 간헐적으로 실패한다. 깨진 아이콘 대신 플레이스홀더로 바꾼다.
      img.addEventListener('error', function () { img.hidden = true; noimg.hidden = false; });
      noimg.hidden = true;
    } else {
      img.hidden = true;
      noimg.hidden = false;
    }

    node.querySelector('.card-title').textContent = f.title;
    node.querySelector('.card-loc-text').textContent = locationText(f);
    node.querySelector('.card-date-text').textContent =
      fmtDate(f.startDate) + ' ~ ' + fmtDate(f.endDate);

    if (f.isFree) node.querySelector('.badge-free').hidden = false;

    var tagList = node.querySelector('.card-tags');
    f.tags.slice(0, 3).forEach(function (t) {
      var li = document.createElement('li');
      li.textContent = t;
      tagList.appendChild(li);
    });

    var favBtn = node.querySelector('.fav-btn');
    syncFavBtn(favBtn, f.id);
    favBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      toggleFav(f);
      syncFavBtn(favBtn, f.id);
      if (state.favoritesOnly) setState({});
    });

    node.querySelector('.detail-btn').addEventListener('click', function () { openDetail(f); });
    return node;
  }

  function syncFavBtn(btn, id) {
    var on = isFav(id);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '찜 해제' : '찜하기');
    btn.firstElementChild.textContent = on ? '❤️' : '🤍';
  }

  function renderSkeletons() {
    clear(el.grid);
    el.grid.setAttribute('aria-busy', 'true');
    for (var i = 0; i < 6; i++) {
      var li = document.createElement('li');
      li.className = 'skeleton';
      var m = document.createElement('div'); m.className = 'sk-media';
      var l1 = document.createElement('div'); l1.className = 'sk-line';
      var l2 = document.createElement('div'); l2.className = 'sk-line short';
      li.appendChild(m); li.appendChild(l1); li.appendChild(l2);
      el.grid.appendChild(li);
    }
  }

  /** 알림 박스. 문구는 코드가 만들고 API 문자열은 넣지 않는다. */
  function notice(title, desc, actions) {
    var box = document.createElement('div');
    box.className = 'notice';
    var h = document.createElement('h3'); h.textContent = title; box.appendChild(h);
    if (desc) { var p = document.createElement('p'); p.textContent = desc; box.appendChild(p); }
    if (actions && actions.length) {
      var wrap = document.createElement('div'); wrap.className = 'actions';
      actions.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = a.label;
        if (a.ghost) b.className = 'ghost';
        b.addEventListener('click', a.onClick);
        wrap.appendChild(b);
      });
      box.appendChild(wrap);
    }
    return box;
  }

  function renderPopular() {
    // 인기 레일은 지역만 반영한다. 카테고리·무료 칩까지 반영하면 추천면이 계속 흔들린다.
    var pool = state.festivals;
    if (state.region !== 'all') {
      pool = pool.filter(function (f) { return f.region === state.region; });
    }
    var top = pool.slice(0, POPULAR_MAX); // 서버가 이미 인기순으로 정렬해 보낸다
    clear(el.popularRail);
    if (state.status !== 'ready' || top.length < 3) {
      el.popular.hidden = true;
      return;
    }
    el.popular.hidden = false;
    top.forEach(function (f) { el.popularRail.appendChild(buildCard(f)); });
  }

  function render() {
    clear(el.stateArea);
    el.resetBtn.hidden = !hasAnyFilter();

    // 로딩
    if (state.status === 'loading') {
      el.resultCount.textContent = '행사를 불러오는 중…';
      renderSkeletons();
      el.popular.hidden = true;
      return;
    }

    clear(el.grid);
    el.grid.setAttribute('aria-busy', 'false');

    // 오류 — 빈 목록으로 위장하지 않는다
    if (state.status === 'error') {
      el.resultCount.textContent = '';
      var msg = state.error === 'QUOTA_EXCEEDED'
        ? '오늘 조회 한도를 초과했어요.'
        : '행사 정보를 불러오지 못했어요.';
      el.stateArea.appendChild(notice('😥 ' + msg, '잠시 후 다시 시도해주세요.', [
        { label: '다시 불러오기', onClick: function () { fetchFestivals(); } },
      ]));
      el.popular.hidden = true;
      return;
    }

    renderPopular();

    var n = state.filtered.length;
    el.resultCount.textContent = n > 0 ? '총 ' + n + '개' : '';
    el.resultsTitle.textContent = state.favoritesOnly ? '찜한 행사' : '이번 주말 행사';

    // 빈 결과 — 두 경우를 구분한다
    if (n === 0) {
      if (state.favoritesOnly && state.favorites.length === 0) {
        el.stateArea.appendChild(notice('🤍 아직 찜한 행사가 없어요.',
          '마음에 드는 행사의 하트를 눌러보세요.', [
            { label: '전체 행사 보기', ghost: true, onClick: function () { setFavoritesOnly(false); } },
          ]));
        return;
      }
      if (state.festivals.length === 0) {
        el.stateArea.appendChild(notice('🎪 이번 주말에는 등록된 행사가 없어요.',
          '다음 주말에 다시 확인해주세요.'));
        return;
      }
      var actions = [];
      if (state.freeOnly) actions.push({ label: '무료 필터 해제', ghost: true, onClick: function () { toggleFree(false); } });
      if (state.region !== 'all') actions.push({ label: '전국 행사 보기', ghost: true, onClick: function () { setRegion('all'); } });
      if (state.categories.length) actions.push({ label: '카테고리 초기화', ghost: true, onClick: clearCategories });
      if (state.dateFilter !== 'all') actions.push({ label: '전체 날짜 보기', ghost: true, onClick: function () { setDateFilter('all'); } });
      actions.push({ label: '필터 전체 초기화', onClick: resetAll });
      el.stateArea.appendChild(notice('😢 조건에 맞는 행사가 없어요.', '필터를 조금 완화해보세요.', actions));
      return;
    }

    var frag = document.createDocumentFragment();
    state.filtered.forEach(function (f) { frag.appendChild(buildCard(f)); });
    el.grid.appendChild(frag);
  }

  // ── 상세 모달 ─────────────────────────────────────────────

  var lastFocused = null;

  function openDetail(f) {
    lastFocused = document.activeElement;

    clear(el.detailBody);
    var loading = document.createElement('p');
    loading.className = 'd-loading';
    loading.textContent = '불러오는 중…';
    el.detailBody.appendChild(loading);

    if (typeof el.dialog.showModal === 'function') el.dialog.showModal();
    else el.dialog.setAttribute('open', '');

    fetchDetail(f.id)
      .then(function (item) { renderDetail(item, f); })
      .catch(function () { renderDetail(null, f); });
  }

  function closeDetail() {
    if (typeof el.dialog.close === 'function') el.dialog.close();
    else el.dialog.removeAttribute('open');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function metaRow(label, value) {
    var p = document.createElement('p');
    p.className = 'd-meta';
    var s = document.createElement('span'); s.textContent = label; s.setAttribute('aria-hidden', 'true');
    var v = document.createElement('strong'); v.textContent = value;
    p.appendChild(s); p.appendChild(v);
    return p;
  }

  function renderDetail(item, fallback) {
    var d = item || fallback;
    clear(el.detailBody);

    if (d.image) {
      var media = document.createElement('div'); media.className = 'd-media';
      var img = document.createElement('img');
      img.src = d.image; img.alt = d.title + ' 포스터';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('error', function () { media.removeChild(img); });
      media.appendChild(img);
      el.detailBody.appendChild(media);
    }

    var body = document.createElement('div');
    body.className = 'd-body';

    var h = document.createElement('h2');
    h.id = 'detail-title';
    h.textContent = d.title;
    body.appendChild(h);

    body.appendChild(metaRow('📅', fmtLong(d.startDate) + ' ~ ' + fmtLong(d.endDate)));
    if (d.address) body.appendChild(metaRow('📍', d.address));
    if (d.place) body.appendChild(metaRow('🏛', d.place));
    if (d.tel) body.appendChild(metaRow('☎️', d.tel));
    if (item && item.playtime) body.appendChild(metaRow('🕒', item.playtime));

    var badges = document.createElement('div');
    badges.className = 'd-badges';
    var fee = item && item.fee;
    if (fee && fee.resolved) {
      var b = document.createElement('span');
      b.className = 'badge ' + (fee.isFree ? 'badge-free' : 'badge-today');
      b.textContent = (fee.isFree ? '🆓 ' : '💳 ') + fee.raw;
      badges.appendChild(b);
    }
    (d.tags || []).forEach(function (t) {
      var s = document.createElement('span');
      s.className = 'badge badge-today';
      s.textContent = t;
      badges.appendChild(s);
    });
    if (badges.childNodes.length) body.appendChild(badges);

    if (item && item.overview) {
      var sep = document.createElement('div'); sep.className = 'd-sep'; body.appendChild(sep);
      var ov = document.createElement('p');
      ov.className = 'd-overview';
      ov.textContent = item.overview;   // 서버에서 태그 제거·엔티티 디코딩 완료
      body.appendChild(ov);
    }

    if (!item) {
      var warn = document.createElement('p');
      warn.className = 'd-overview';
      warn.textContent = '상세 정보를 불러오지 못했어요. 기본 정보만 표시합니다.';
      body.appendChild(warn);
    }

    var actions = document.createElement('div');
    actions.className = 'd-actions';

    // 서버가 프로토콜을 검증해 http/https만 내려준다.
    if (item && item.homepage) {
      var a = document.createElement('a');
      a.className = 'primary';
      a.href = item.homepage;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = '🌐 공식 홈페이지 (새 창)';
      actions.appendChild(a);
    }
    if (d.lat != null && d.lng != null) {
      var map = document.createElement('a');
      map.className = 'ghost';
      map.href = 'https://map.kakao.com/link/map/' + encodeURIComponent(d.title) + ',' + d.lat + ',' + d.lng;
      map.target = '_blank';
      map.rel = 'noopener noreferrer';
      map.textContent = '🗺️ 지도에서 보기 (새 창)';
      actions.appendChild(map);
    }
    var favB = document.createElement('button');
    favB.type = 'button';
    favB.className = 'ghost';
    favB.textContent = isFav(d.id) ? '❤️ 찜 해제' : '🤍 찜하기';
    favB.addEventListener('click', function () {
      toggleFav(d);
      favB.textContent = isFav(d.id) ? '❤️ 찜 해제' : '🤍 찜하기';
      setState({});
    });
    actions.appendChild(favB);

    body.appendChild(actions);
    el.detailBody.appendChild(body);
  }

  // ── EVENTS ────────────────────────────────────────────────

  function setRegion(v) { setState({ region: v }); el.regionSelect.value = v; }
  function setDateFilter(v) {
    state.dateFilter = v;
    el.segs.forEach(function (b) {
      var on = b.dataset.date === v;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.classList.toggle('is-on', on);
    });
    setState({});
  }
  function toggleFree(v) {
    state.freeOnly = v;
    el.chipFree.setAttribute('aria-pressed', v ? 'true' : 'false');
    setState({});
  }
  function clearCategories() {
    state.categories = [];
    el.catChips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
    setState({});
  }
  function setFavoritesOnly(v) {
    state.favoritesOnly = v;
    el.favToggle.setAttribute('aria-pressed', v ? 'true' : 'false');
    setState({});
  }
  function resetAll() {
    state.categories = [];
    el.catChips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
    el.chipFree.setAttribute('aria-pressed', 'false');
    el.favToggle.setAttribute('aria-pressed', 'false');
    el.regionSelect.value = 'all';
    state.freeOnly = false;
    state.favoritesOnly = false;
    state.region = 'all';
    setDateFilter('all');
  }

  function bind() {
    REGIONS.forEach(function (r) {
      var o = document.createElement('option');
      o.value = r; o.textContent = r;
      el.regionSelect.appendChild(o);
    });

    el.regionSelect.addEventListener('change', function () { setState({ region: this.value }); });

    el.segs.forEach(function (b) {
      b.addEventListener('click', function () { setDateFilter(b.dataset.date); });
    });

    el.catChips.forEach(function (c) {
      c.addEventListener('click', function () {
        var cat = c.dataset.cat;
        var i = state.categories.indexOf(cat);
        if (i === -1) state.categories.push(cat);
        else state.categories.splice(i, 1);
        c.setAttribute('aria-pressed', i === -1 ? 'true' : 'false');
        setState({});
      });
    });

    el.chipFree.addEventListener('click', function () { toggleFree(!state.freeOnly); });
    el.favToggle.addEventListener('click', function () { setFavoritesOnly(!state.favoritesOnly); });
    el.resetBtn.addEventListener('click', resetAll);

    el.detailClose.addEventListener('click', closeDetail);
    // backdrop 클릭으로 닫기
    el.dialog.addEventListener('click', function (ev) {
      if (ev.target === el.dialog) closeDetail();
    });
    el.dialog.addEventListener('close', function () {
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    });
  }

  // ── INIT ──────────────────────────────────────────────────

  function init() {
    el.grid = document.getElementById('grid');
    el.stateArea = document.getElementById('state-area');
    el.resultCount = document.getElementById('result-count');
    el.resultsTitle = document.getElementById('results-title');
    el.weekendLine = document.getElementById('weekend-line');
    el.regionSelect = document.getElementById('region-select');
    el.popular = document.getElementById('popular');
    el.popularRail = document.getElementById('popular-rail');
    el.cardTpl = document.getElementById('card-tpl');
    el.chipFree = document.getElementById('chip-free');
    el.favToggle = document.getElementById('fav-toggle');
    el.favBadge = document.getElementById('fav-badge');
    el.resetBtn = document.getElementById('reset-all');
    el.dialog = document.getElementById('detail-dialog');
    el.detailBody = document.getElementById('detail-body');
    el.detailClose = document.getElementById('detail-close');
    el.segs = Array.prototype.slice.call(document.querySelectorAll('.seg'));
    el.catChips = Array.prototype.slice.call(document.querySelectorAll('.chip[data-cat]'));

    state.favorites = loadFavorites();
    updateFavBadge();
    bind();
    fetchFestivals();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
