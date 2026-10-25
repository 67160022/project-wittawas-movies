const axios = require("axios");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function searchMovies(term) {
  const url = process.env.EXTERNAL_API_URL || "https://itunes.apple.com/search";

  const maxAttempts = 3; // ครั้งแรก + retry 2 ครั้ง

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[External API] attempt ${attempt}/${maxAttempts}`);

      const response = await axios.get(url, {
        // ตัวกรอง media=movie ของ iTunes คืนผลว่างในปัจจุบัน จึงค้นแบบทั่วไปแล้วกรอง kind เอง
        params: {
          term,
          limit: 50,
        },
        timeout: 5000,
        signal: AbortSignal.timeout(5000),
      });

      if (!Array.isArray(response.data.results)) {
        throw new Error("Invalid external API response");
      }

      return {
        success: true,
        attempts: attempt,
        data: response.data.results
          .filter((item) => item.kind === "feature-movie")
          .slice(0, 5)
          .map((movie) => ({
            title: movie.trackName,
            director: movie.artistName,
            releaseDate: movie.releaseDate,
          })),
      };
    } catch (error) {
      const status = error.response?.status;
      const retryable = !error.response || status >= 500;

      console.log(
        `[External API] failed: ${error.code || error.message}` +
          (status ? `, status=${status}` : ""),
      );

      if (retryable && attempt < maxAttempts) {
        await wait(500 * 2 ** (attempt - 1));
        continue;
      }

      // Fallback: แจ้งผู้ใช้ชัดเจน ไม่ปล่อยให้ระบบ crash
      return {
        success: false,
        attempts: attempt,
        message: "บริการค้นหาหนังภายนอกไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง",
        data: [],
      };
    }
  }
}

module.exports = { searchMovies };
