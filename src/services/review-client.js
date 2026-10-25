// HTTP client ที่ Movies API (Gateway) ใช้เรียก Review Service
const axios = require("axios");

const client = axios.create({
  baseURL: process.env.REVIEW_SERVICE_URL || "http://localhost:3001",
  timeout: 3000,
});

// คืนค่า { status, body } เสมอ — ถ้า Review Service ล่ม/ไม่ตอบ จะได้ 503 แทนการ crash
async function callReviewService(method, url, data) {
  try {
    const response = await client.request({ method, url, data });
    return { status: response.status, body: response.data };
  } catch (error) {
    if (error.response) {
      return { status: error.response.status, body: error.response.data };
    }

    console.log(`[Review Service] unavailable: ${error.code || error.message}`);

    return {
      status: 503,
      body: {
        error: {
          code: "REVIEW_SERVICE_UNAVAILABLE",
          message: "บริการรีวิวไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง",
        },
      },
    };
  }
}

module.exports = { callReviewService };
