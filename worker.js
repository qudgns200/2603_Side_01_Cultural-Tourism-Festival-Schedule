export default {
  async fetch(request, env, ctx) {
    const SERVICE_KEY = "a927afc2f6eca450e11c1db2f30c6011600f238f313eb0a7c36294708698a890";
    // serviceKey를 encodeURIComponent로 인코딩하여 쿼리 스트링 조립
    const encodedServiceKey = encodeURIComponent(SERVICE_KEY);
    const API_URL = `https://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api?serviceKey=${encodedServiceKey}&pageNo=1&numOfRows=100&type=json`;

    // CORS Preflight (OPTIONS) 처리
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, User-Agent, Accept",
        },
      });
    }

    try {
      console.log("Fetching from API URL:", API_URL);

      // fetch 요청 시 User-Agent와 Accept 헤더 추가
      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
        },
      });

      // response.text()로 응답을 받아서 로그 출력 및 반환
      const responseText = await response.text();
      
      console.log("API Response Status:", response.status);
      console.log("API Response Body:", responseText);

      if (!response.ok) {
        return new Response(JSON.stringify({
          error: "외부 API 응답 오류",
          status: response.status,
          message: responseText || "응답 내용이 없습니다."
        }), {
          status: response.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

      return new Response(responseText, {
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          "Access-Control-Allow-Origin": "*",
        },
      });

    } catch (error) {
      console.error("Worker Error:", error.message);
      
      return new Response(JSON.stringify({ 
        error: "Worker 내부 오류 또는 연결 실패", 
        message: error.message 
      }), {
        status: 502, // Bad Gateway
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  },
};
