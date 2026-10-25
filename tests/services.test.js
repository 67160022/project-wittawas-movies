// ทดสอบ service ที่ติดต่อระบบอื่นผ่าน HTTP: review-client (Gateway → Review Service) และ external-api (iTunes)
jest.mock("axios", () => {
  const request = jest.fn();
  return { create: jest.fn(() => ({ request })), get: jest.fn(), __request: request };
});

const axios = require("axios");
const { callReviewService } = require("../src/services/review-client");
const { searchMovies } = require("../src/services/external-api");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("review-client", () => {
  test("ส่งต่อ status และ body เมื่อสำเร็จ", async () => {
    axios.__request.mockResolvedValue({ status: 200, data: { ok: true } });
    await expect(callReviewService("get", "/health")).resolves.toEqual({
      status: 200,
      body: { ok: true },
    });
  });

  test("ส่งต่อ status 4xx จาก Review Service", async () => {
    axios.__request.mockRejectedValue({ response: { status: 400, data: { error: {} } } });
    const result = await callReviewService("post", "/reviews", {});
    expect(result.status).toBe(400);
  });

  test("คืน 503 REVIEW_SERVICE_UNAVAILABLE เมื่อเชื่อมต่อไม่ได้", async () => {
    axios.__request.mockRejectedValue({ code: "ECONNREFUSED" });
    const result = await callReviewService("get", "/health");
    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe("REVIEW_SERVICE_UNAVAILABLE");
  });
});

describe("external-api (retry / timeout / fallback)", () => {
  test("สำเร็จครั้งแรก กรองเฉพาะ feature-movie สูงสุด 5 เรื่อง", async () => {
    const results = [
      { kind: "song", trackName: "x" },
      ...Array.from({ length: 7 }, (_, i) => ({
        kind: "feature-movie",
        trackName: `Movie ${i}`,
        artistName: "Director",
        releaseDate: "2020-01-01T00:00:00Z",
      })),
    ];
    axios.get.mockResolvedValue({ data: { results } });

    const result = await searchMovies("batman");
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.data).toHaveLength(5);
    expect(result.data[0]).toEqual({
      title: "Movie 0",
      director: "Director",
      releaseDate: "2020-01-01T00:00:00Z",
    });
  });

  test("retry เมื่อ 5xx แล้วสำเร็จในครั้งที่ 2", async () => {
    axios.get
      .mockRejectedValueOnce({ response: { status: 502 } })
      .mockResolvedValueOnce({ data: { results: [] } });
    const result = await searchMovies("batman");
    expect(result).toMatchObject({ success: true, attempts: 2 });
  });

  test("ไม่ retry เมื่อ 4xx และตอบ fallback ทันที", async () => {
    axios.get.mockRejectedValue({ response: { status: 404 } });
    const result = await searchMovies("batman");
    expect(result).toMatchObject({ success: false, attempts: 1, data: [] });
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test("ลองครบ 3 ครั้งเมื่อ network error แล้วตอบ fallback", async () => {
    axios.get.mockRejectedValue({ code: "ECONNREFUSED" });
    const result = await searchMovies("batman");
    expect(result).toMatchObject({ success: false, attempts: 3 });
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  test("รูปแบบ response ผิด ถือเป็นความล้มเหลวและ retry", async () => {
    axios.get.mockResolvedValue({ data: {} });
    const result = await searchMovies("batman");
    expect(result.success).toBe(false);
    expect(axios.get).toHaveBeenCalledTimes(3);
  });
});
