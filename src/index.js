export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. API 데이터 요청 처리
    if (url.pathname === "/api/festivals") {
      const serviceKey = 'a927afc2f6eca450e11c1db2f30c6011600f238f313eb0a7c36294708698a890';
      const baseUrl = 'http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api';
      
      let allItems = [];
      const today = new Date();

      const fetchPromises = [];
      for (let i = 0; i < 7; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        const dateStr = targetDate.toISOString().split('T')[0];
        
        const apiUrl = `${baseUrl}?serviceKey=${serviceKey}&pageNo=1&numOfRows=100&type=JSON&fstvlStartDate=${dateStr}`;
        
        fetchPromises.push(
          fetch(apiUrl)
            .then(async (res) => {
              const text = await res.text();
              try {
                if (text.includes('SERVICE_KEY_IS_NOT_REGISTERED_ERROR')) return null;
                const data = JSON.parse(text);
                const items = data?.response?.body?.items;
                if (!items) return null;
                return Array.isArray(items) ? items : [items];
              } catch (e) {
                return null;
              }
            })
            .catch(() => null)
        );
      }

      const results = await Promise.all(fetchPromises);
      results.forEach(items => {
        if (items) allItems = allItems.concat(items);
      });

      const uniqueFestivals = Array.from(new Map(allItems.map(item => [item.fstvlNm, item])).values());
      uniqueFestivals.sort((a, b) => a.fstvlNm.localeCompare(b.fstvlNm));
      
      return new Response(JSON.stringify(uniqueFestivals), {
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-cache"
        }
      });
    }

    // 2. 루트(/) 접속 시 index.html 서빙
    if (url.pathname === "/" || url.pathname === "") {
      return env.ASSETS.fetch(new Request(url.origin + "/index.html", request));
    }

    // 3. /list.html 등 기타 정적 파일 요청 처리
    return env.ASSETS.fetch(request);
  }
}
