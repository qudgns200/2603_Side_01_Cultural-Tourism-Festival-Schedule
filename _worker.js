export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. API 데이터 요청 처리 (/api/festivals)
    if (url.pathname === "/api/festivals") {
      const serviceKey = 'a927afc2f6eca450e11c1db2f30c6011600f238f313eb0a7c36294708698a890';
      const baseUrl = 'https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api';
      
      let allItems = [];
      const today = new Date();

      // 향후 7일간의 데이터를 순회하며 가져옴
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        const dateStr = targetDate.toISOString().split('T')[0];

        const apiUrl = `${baseUrl}?serviceKey=${serviceKey}&pageNo=1&numOfRows=100&type=JSON&fstvlStartDate=${dateStr}`;
        
        try {
          const res = await fetch(apiUrl);
          const data = await res.json();
          if (data.response && data.response.body && data.response.body.items) {
            allItems = allItems.concat(data.response.body.items);
          }
        } catch (e) {
          console.error(`Error fetching data for ${dateStr}:`, e);
        }
      }

      // 축제명 기준 중복 제거
      const uniqueFestivals = Array.from(new Map(allItems.map(item => [item.fstvlNm, item])).values());
      
      return new Response(JSON.stringify(uniqueFestivals), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*" 
        }
      });
    }

    // 2. /list 접속 시 list.html로 라우팅
    if (url.pathname === "/list") {
      return env.ASSETS.fetch(new Request(url.origin + "/list.html", request));
    }

    // 3. 기타 정적 파일 (index.html 등) 처리
    return env.ASSETS.fetch(request);
  }
}
