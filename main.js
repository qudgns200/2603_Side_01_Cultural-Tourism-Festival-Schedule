/**
 * 공공데이터포털 API 설정
 */
const API_CONFIG = {
    endpoint: 'https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api',
    serviceKey: 'a927afc2f6eca450e11c1db2f30c6011600f238f313eb0a7c36294708698a890',
    numOfRows: 100,
    type: 'json'
};

/**
 * 페이지 로드 시 실행
 */
document.addEventListener('DOMContentLoaded', () => {
    fetchAndDisplayFestivals();
});

/**
 * 메인 로직: 데이터 패치 -> 필터링 -> 렌더링
 */
async function fetchAndDisplayFestivals() {
    const grid = document.getElementById('festival-grid');

    // API 호출을 시도하는 내부 함수 (프록시 사용 여부 선택 가능)
    const fetchData = async (useProxy = false) => {
        let url = `${API_CONFIG.endpoint}?serviceKey=${API_CONFIG.serviceKey}&type=${API_CONFIG.type}&numOfRows=${API_CONFIG.numOfRows}`;
        
        if (useProxy) {
            // CORS 문제를 우회하기 위한 프록시 서버 사용 (allorigins)
            url = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        if (useProxy) {
            const proxyData = await response.json();
            return JSON.parse(proxyData.contents);
        }
        return await response.json();
    };

    try {
        let data;
        try {
            // 1차 시도: 직접 호출
            data = await fetchData(false);
        } catch (e) {
            console.warn('Direct fetch failed, retrying with proxy...', e);
            // 2차 시도: 프록시 서버를 통한 호출
            data = await fetchData(true);
        }
        
        // API 응답 구조 확인
        const items = data.response?.body?.items || [];

        if (items.length === 0) {
            displayMessage('현재 제공되는 축제 데이터가 없습니다.', false);
            return;
        }

        // 2. 날짜 기준 필터링 (0~14일 이내 시작)
        const filteredFestivals = filterFestivalsByDate(items);

        // 3. 화면 렌더링
        renderFestivals(filteredFestivals);

    } catch (error) {
        console.error('Fetch Error:', error);
        displayMessage(`데이터를 가져오는데 실패했습니다: ${error.message}`, true);
    }
}

/**
 * 오늘 날짜 기준으로 0일 ~ 14일 사이에 시작하는 행사 필터링
 * @param {Array} items - API에서 받아온 전체 축제 목록
 * @returns {Array} 필터링된 축제 목록
 */
function filterFestivalsByDate(items) {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // 시간 정보를 0으로 초기화하여 날짜만 비교

    const twoWeeksLater = new Date(now);
    twoWeeksLater.setDate(now.getDate() + 14);

    return items.filter(item => {
        if (!item.fstvlStartDate) return false;

        const startDate = new Date(item.fstvlStartDate);
        
        // 날짜 객체 유효성 검사
        if (isNaN(startDate.getTime())) return false;

        // 시작일이 오늘 이후이고 2주 이내인 것만 선택
        return startDate >= now && startDate <= twoWeeksLater;
    }).sort((a, b) => new Date(a.fstvlStartDate) - new Date(b.fstvlStartDate)); // 날짜순 정렬
}

/**
 * 필터링된 데이터를 HTML 카드로 생성하여 화면에 표시
 * @param {Array} festivals - 필터링된 축제 목록
 */
function renderFestivals(festivals) {
    const grid = document.getElementById('festival-grid');
    grid.innerHTML = ''; // 초기 로딩 메시지 제거

    if (festivals.length === 0) {
        displayMessage('해당 기간 내 시작하는 축제가 없습니다. 📅', false);
        return;
    }

    festivals.forEach(fest => {
        const card = document.createElement('div');
        card.className = 'festival-card';
        
        // 시작일과 종료일 포맷팅
        const dateRange = `${fest.fstvlStartDate} ~ ${fest.fstvlEndDate || '미정'}`;

        card.innerHTML = `
            <div>
                <h2 class="festival-name">${fest.fstvlNm}</h2>
                <div class="info-item">
                    <span class="info-label">📍 장소</span>
                    <span class="info-content">${fest.opar || '정보 없음'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">📅 일정</span>
                    <span class="info-content">${dateRange}</span>
                </div>
            </div>
            <div class="date-badge">
                ${getDDay(fest.fstvlStartDate)}
            </div>
        `;
        grid.appendChild(card);
    });
}

/**
 * D-Day 계산 유틸리티
 */
function getDDay(startDateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(startDateStr);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) return '오늘 시작!';
    return `D-${diff}`;
}

/**
 * 상태 또는 에러 메시지 표시
 */
function displayMessage(message, isError) {
    const grid = document.getElementById('festival-grid');
    grid.innerHTML = `
        <div class="status-message ${isError ? 'error' : ''}">
            ${message}
        </div>
    `;
}
