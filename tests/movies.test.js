// ทดสอบ Movies API (Gateway) — mock ฐานข้อมูลและ service ภายนอก จึงรันได้โดยไม่ต้องเปิด MySQL
jest.mock("../src/db", () => ({ query: jest.fn() }));
jest.mock("../src/services/review-client", () => ({
  callReviewService: jest.fn(),
}));
jest.mock("../src/services/external-api", () => ({ searchMovies: jest.fn() }));

const request = require("supertest");
const pool = require("../src/db");
const { callReviewService } = require("../src/services/review-client");
const { searchMovies } = require("../src/services/external-api");
const app = require("../src/index");

const movie = {
  movie_id: 1,
  title: "Inception",
  director_id: 1,
  release_year: 2010,
  movie_code: "INCE2010",
};
const validBody = { title: "Inception", director_id: 1, releaseYear: 2010 };
const dbError = (code) => Object.assign(new Error(code), { code });

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("Health & Frontend", () => {
  test("GET / เสิร์ฟหน้า Frontend", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Movies Hub");
  });

  test("GET /api/v1/health ตอบสถานะ review-service = ok", async () => {
    callReviewService.mockResolvedValue({ status: 200, body: {} });
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.services["review-service"]).toBe("ok");
  });

  test("GET /api/v1/health ตอบ unavailable เมื่อ review-service ล่ม", async () => {
    callReviewService.mockResolvedValue({ status: 503, body: {} });
    const res = await request(app).get("/api/v1/health");
    expect(res.body.services["review-service"]).toBe("unavailable");
  });
});

describe("GET /api/v1/directors", () => {
  test("200 คืนรายชื่อผู้กำกับ", async () => {
    pool.query.mockResolvedValue([
      [{ director_id: 1, name: "Christopher Nolan" }],
    ]);
    const res = await request(app).get("/api/v1/directors");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test("500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app).get("/api/v1/directors");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("POST /api/v1/directors", () => {
  test("201 สร้างผู้กำกับ ตัดช่องว่าง และเก็บสัญชาติว่างเป็น null", async () => {
    pool.query
      .mockResolvedValueOnce([[]]) // เช็กชื่อซ้ำ: ไม่พบ
      .mockResolvedValueOnce([{ insertId: 6 }]); // INSERT
    const res = await request(app)
      .post("/api/v1/directors")
      .send({ name: "  Denis Villeneuve ", nationality: "  " });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      director_id: 6,
      name: "Denis Villeneuve",
      nationality: null,
    });
    expect(pool.query).toHaveBeenLastCalledWith(
      "INSERT INTO directors (name, nationality) VALUES (?, ?)",
      ["Denis Villeneuve", null],
    );
  });

  test("201 ไม่ส่ง nationality มาก็ได้", async () => {
    pool.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 7 }]);
    const res = await request(app)
      .post("/api/v1/directors")
      .send({ name: "Bong Joon-ho" });
    expect(res.status).toBe(201);
    expect(res.body.data.nationality).toBeNull();
  });

  test.each([
    [{}, "ชื่อผู้กำกับ"],
    [{ name: "   " }, "ชื่อผู้กำกับ"],
    [{ name: 123 }, "ชื่อผู้กำกับ"],
    [{ name: "a".repeat(151) }, "ชื่อผู้กำกับ"],
    [{ name: "Nolan", nationality: 1 }, "สัญชาติ"],
    [{ name: "Nolan", nationality: "a".repeat(101) }, "สัญชาติ"],
  ])("400 VALIDATION_ERROR: %j", async (body, message) => {
    const res = await request(app).post("/api/v1/directors").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain(message);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("409 CONFLICT_ERROR เมื่อมีชื่อผู้กำกับนี้แล้ว", async () => {
    pool.query.mockResolvedValueOnce([
      [{ director_id: 1, name: "Christopher Nolan" }],
    ]);
    const res = await request(app)
      .post("/api/v1/directors")
      .send({ name: "christopher nolan" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT_ERROR");
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app)
      .post("/api/v1/directors")
      .send({ name: "Nolan" });
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
  });
});

describe("GET /api/v1/movies", () => {
  test("200 คืนรายการหนัง", async () => {
    pool.query.mockResolvedValue([[movie]]);
    const res = await request(app).get("/api/v1/movies");
    expect(res.status).toBe(200);
    expect(res.body.data[0].title).toBe("Inception");
  });

  test("500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app).get("/api/v1/movies");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/v1/movies/:id", () => {
  test("200 เมื่อพบหนัง", async () => {
    pool.query.mockResolvedValue([[movie]]);
    const res = await request(app).get("/api/v1/movies/1");
    expect(res.status).toBe(200);
    expect(res.body.data.movie_id).toBe(1);
  });

  test("404 เมื่อไม่พบหนัง", async () => {
    pool.query.mockResolvedValue([[]]);
    const res = await request(app).get("/api/v1/movies/999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  test("500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app).get("/api/v1/movies/1");
    expect(res.status).toBe(500);
  });
});

describe("POST /api/v1/movies", () => {
  test("201 สร้างหนังและ gen movieCode", async () => {
    pool.query.mockResolvedValue([{ insertId: 7 }]);
    const res = await request(app)
      .post("/api/v1/movies")
      .send({ title: "  The Prestige ", director_id: 1, releaseYear: 2006 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      movie_id: 7,
      title: "The Prestige",
      movieCode: "THEP2006",
    });
  });

  test.each([
    [{}, "กรุณากรอกข้อมูลหนังให้ครบถ้วน"],
    [{ ...validBody, title: "   " }, "ชื่อหนังต้องเป็นข้อความ 1-200 ตัวอักษร"],
    [{ ...validBody, title: 123 }, "ชื่อหนังต้องเป็นข้อความ 1-200 ตัวอักษร"],
    [
      { ...validBody, title: "a".repeat(201) },
      "ชื่อหนังต้องเป็นข้อความ 1-200 ตัวอักษร",
    ],
    [{ ...validBody, director_id: -1 }, "director_id ต้องเป็นจำนวนเต็มบวก"],
    [{ ...validBody, director_id: "1" }, "director_id ต้องเป็นจำนวนเต็มบวก"],
    [{ ...validBody, releaseYear: 1500 }, "ปีที่ฉาย"],
    [{ ...validBody, releaseYear: 2010.5 }, "ปีที่ฉาย"],
  ])("400 VALIDATION_ERROR: %j", async (body, message) => {
    const res = await request(app).post("/api/v1/movies").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain(message);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("400 INVALID_JSON เมื่อ body ไม่ใช่ JSON ที่ถูกต้อง", async () => {
    const res = await request(app)
      .post("/api/v1/movies")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  test("404 เมื่อไม่พบผู้กำกับ (FK)", async () => {
    pool.query.mockRejectedValue(dbError("ER_NO_REFERENCED_ROW_2"));
    const res = await request(app).post("/api/v1/movies").send(validBody);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("DIRECTOR_NOT_FOUND");
  });

  test("409 เมื่อชื่อหนังซ้ำ", async () => {
    pool.query.mockRejectedValue(dbError("ER_DUP_ENTRY"));
    const res = await request(app).post("/api/v1/movies").send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT_ERROR");
  });

  test("500 เมื่อฐานข้อมูลผิดพลาดแบบอื่น", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app).post("/api/v1/movies").send(validBody);
    expect(res.status).toBe(500);
  });
});

describe("PUT /api/v1/movies/:id", () => {
  test("200 แก้ไขสำเร็จ", async () => {
    pool.query
      .mockResolvedValueOnce([[movie]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ ...movie, title: "Inception 2" }]]);
    const res = await request(app)
      .put("/api/v1/movies/1")
      .send({ ...validBody, title: "Inception 2" });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Inception 2");
  });

  test("400 เมื่อข้อมูลไม่ครบ", async () => {
    const res = await request(app).put("/api/v1/movies/1").send({ title: "x" });
    expect(res.status).toBe(400);
  });

  test("404 เมื่อไม่พบหนัง", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const res = await request(app).put("/api/v1/movies/999").send(validBody);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  test.each([
    ["ER_NO_REFERENCED_ROW_2", 404, "DIRECTOR_NOT_FOUND"],
    ["ER_DUP_ENTRY", 409, "CONFLICT_ERROR"],
    ["OTHER", 500, "INTERNAL_SERVER_ERROR"],
  ])("จัดการ %s เป็น %i", async (code, status, errorCode) => {
    pool.query
      .mockResolvedValueOnce([[movie]])
      .mockRejectedValueOnce(dbError(code));
    const res = await request(app).put("/api/v1/movies/1").send(validBody);
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(errorCode);
  });
});

describe("PATCH /api/v1/movies/:id", () => {
  test("200 แก้เฉพาะ title และใช้ค่าเดิมกับฟิลด์อื่น", async () => {
    pool.query
      .mockResolvedValueOnce([[movie]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[{ ...movie, title: "Tenet" }]]);
    const res = await request(app)
      .patch("/api/v1/movies/1")
      .send({ title: "Tenet" });
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][1]).toEqual([
      "Tenet",
      1,
      2010,
      "TENE2010",
      "1",
    ]);
  });

  test("200 แก้เฉพาะ director_id และ releaseYear", async () => {
    pool.query
      .mockResolvedValueOnce([[movie]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([[movie]]);
    const res = await request(app)
      .patch("/api/v1/movies/1")
      .send({ director_id: 2, releaseYear: 2011 });
    expect(res.status).toBe(200);
    expect(pool.query.mock.calls[1][1]).toEqual([
      "Inception",
      2,
      2011,
      "INCE2011",
      "1",
    ]);
  });

  test("400 เมื่อส่งปีไม่ถูกต้อง", async () => {
    const res = await request(app)
      .patch("/api/v1/movies/1")
      .send({ releaseYear: "abc" });
    expect(res.status).toBe(400);
  });

  test("404 เมื่อไม่พบหนัง", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const res = await request(app)
      .patch("/api/v1/movies/999")
      .send({ title: "x" });
    expect(res.status).toBe(404);
  });

  test.each([
    ["ER_NO_REFERENCED_ROW_2", 404],
    ["ER_DUP_ENTRY", 409],
    ["OTHER", 500],
  ])("จัดการ %s เป็น %i", async (code, status) => {
    pool.query
      .mockResolvedValueOnce([[movie]])
      .mockRejectedValueOnce(dbError(code));
    const res = await request(app)
      .patch("/api/v1/movies/1")
      .send({ title: "x" });
    expect(res.status).toBe(status);
  });
});

describe("DELETE /api/v1/movies/:id", () => {
  test("200 ลบสำเร็จ", async () => {
    pool.query.mockResolvedValueOnce([[movie]]).mockResolvedValueOnce([{}]);
    const res = await request(app).delete("/api/v1/movies/1");
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("ลบข้อมูลหนังสำเร็จ");
  });

  test("404 เมื่อไม่พบหนัง", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const res = await request(app).delete("/api/v1/movies/999");
    expect(res.status).toBe(404);
  });

  test("500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app).delete("/api/v1/movies/1");
    expect(res.status).toBe(500);
  });
});

describe("Reviews ผ่าน Gateway → Review Service", () => {
  test("GET reviews ส่งต่อไปยัง Review Service", async () => {
    pool.query.mockResolvedValue([[movie]]);
    callReviewService.mockResolvedValue({
      status: 200,
      body: { summary: { count: 0, average: null }, data: [] },
    });
    const res = await request(app).get("/api/v1/movies/1/reviews");
    expect(res.status).toBe(200);
    expect(callReviewService).toHaveBeenCalledWith(
      "get",
      "/reviews?movie_id=1",
    );
  });

  test("GET reviews 404 เมื่อไม่พบหนัง (ไม่เรียก Review Service)", async () => {
    pool.query.mockResolvedValue([[]]);
    const res = await request(app).get("/api/v1/movies/999/reviews");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MOVIE_NOT_FOUND");
    expect(callReviewService).not.toHaveBeenCalled();
  });

  test("GET reviews 503 เมื่อ Review Service ล่ม", async () => {
    pool.query.mockResolvedValue([[movie]]);
    callReviewService.mockResolvedValue({
      status: 503,
      body: { error: { code: "REVIEW_SERVICE_UNAVAILABLE", message: "x" } },
    });
    const res = await request(app).get("/api/v1/movies/1/reviews");
    expect(res.status).toBe(503);
  });

  test("GET reviews 500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app).get("/api/v1/movies/1/reviews");
    expect(res.status).toBe(500);
  });

  test("POST review ส่ง movie_id/rating/comment ไปยัง Review Service", async () => {
    pool.query.mockResolvedValue([[movie]]);
    callReviewService.mockResolvedValue({
      status: 201,
      body: { data: { review_id: 9 } },
    });
    const res = await request(app)
      .post("/api/v1/movies/1/reviews")
      .send({ rating: 5, comment: "ดีมาก" });
    expect(res.status).toBe(201);
    expect(callReviewService).toHaveBeenCalledWith("post", "/reviews", {
      movie_id: 1,
      rating: 5,
      comment: "ดีมาก",
    });
  });

  test("POST review 404 เมื่อไม่พบหนัง", async () => {
    pool.query.mockResolvedValue([[]]);
    const res = await request(app)
      .post("/api/v1/movies/999/reviews")
      .send({ rating: 5 });
    expect(res.status).toBe(404);
  });

  test("POST review 500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app)
      .post("/api/v1/movies/1/reviews")
      .send({ rating: 5 });
    expect(res.status).toBe(500);
  });

  test("DELETE review ส่งต่อ status จาก Review Service", async () => {
    callReviewService.mockResolvedValue({
      status: 404,
      body: { error: { code: "REVIEW_NOT_FOUND" } },
    });
    const res = await request(app).delete("/api/v1/reviews/99");
    expect(res.status).toBe(404);
    expect(callReviewService).toHaveBeenCalledWith("delete", "/reviews/99");
  });
});

describe("GET /api/v1/external/movies", () => {
  test("400 เมื่อไม่ส่ง term", async () => {
    const res = await request(app).get("/api/v1/external/movies?term=%20");
    expect(res.status).toBe(400);
  });

  test("200 เมื่อบริการภายนอกตอบสำเร็จ", async () => {
    searchMovies.mockResolvedValue({ success: true, attempts: 1, data: [] });
    const res = await request(app).get("/api/v1/external/movies?term=batman");
    expect(res.status).toBe(200);
    expect(searchMovies).toHaveBeenCalledWith("batman");
  });

  test("503 เมื่อบริการภายนอกล้มเหลว (fallback)", async () => {
    searchMovies.mockResolvedValue({ success: false, attempts: 3, data: [] });
    const res = await request(app).get("/api/v1/external/movies?term=batman");
    expect(res.status).toBe(503);
  });

  test("500 เมื่อ service โยน error", async () => {
    searchMovies.mockRejectedValue(new Error("boom"));
    const res = await request(app).get("/api/v1/external/movies?term=batman");
    expect(res.status).toBe(500);
  });
});
