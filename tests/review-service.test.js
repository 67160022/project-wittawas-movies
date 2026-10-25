// ทดสอบ Review Service (Microservice) แยกจาก Movies API
jest.mock("../src/db", () => ({ query: jest.fn() }));

const request = require("supertest");
const pool = require("../src/db");
const app = require("../src/review-service");

const review = { review_id: 1, movie_id: 1, rating: 4, comment: "ดี" };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

test("GET /health", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
  expect(res.body.service).toBe("review-service");
});

describe("GET /reviews", () => {
  test("200 คืนรีวิวพร้อมคะแนนเฉลี่ย", async () => {
    pool.query.mockResolvedValue([[review, { ...review, review_id: 2, rating: 5 }]]);
    const res = await request(app).get("/reviews?movie_id=1");
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ count: 2, average: 4.5 });
  });

  test("200 average = null เมื่อยังไม่มีรีวิว", async () => {
    pool.query.mockResolvedValue([[]]);
    const res = await request(app).get("/reviews?movie_id=1");
    expect(res.body.summary).toEqual({ count: 0, average: null });
  });

  test.each(["", "abc", "0", "-1"])("400 เมื่อ movie_id = %p", async (id) => {
    const res = await request(app).get(`/reviews?movie_id=${id}`);
    expect(res.status).toBe(400);
  });

  test("500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app).get("/reviews?movie_id=1");
    expect(res.status).toBe(500);
  });
});

describe("POST /reviews", () => {
  test("201 สร้างรีวิวและตัดช่องว่างใน comment", async () => {
    pool.query.mockResolvedValue([{ insertId: 10 }]);
    const res = await request(app)
      .post("/reviews")
      .send({ movie_id: 1, rating: 5, comment: "  สนุก  " });
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ review_id: 10, movie_id: 1, rating: 5, comment: "สนุก" });
  });

  test("201 comment ว่างถูกเก็บเป็น null", async () => {
    pool.query.mockResolvedValue([{ insertId: 11 }]);
    const res = await request(app).post("/reviews").send({ movie_id: 1, rating: 3 });
    expect(res.status).toBe(201);
    expect(res.body.data.comment).toBeNull();
  });

  test.each([
    [{ rating: 5 }, "movie_id"],
    [{ movie_id: 1 }, "1-5"],
    [{ movie_id: 1, rating: 0 }, "1-5"],
    [{ movie_id: 1, rating: 6 }, "1-5"],
    [{ movie_id: 1, rating: 4.5 }, "1-5"],
    [{ movie_id: 1, rating: "5" }, "1-5"],
    [{ movie_id: 1, rating: 5, comment: 123 }, "500"],
    [{ movie_id: 1, rating: 5, comment: "a".repeat(501) }, "500"],
  ])("400 VALIDATION_ERROR: %j", async (body, message) => {
    const res = await request(app).post("/reviews").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(message);
  });

  test("404 เมื่อ movie_id ไม่มีอยู่จริง (FK)", async () => {
    pool.query.mockRejectedValue(Object.assign(new Error(), { code: "ER_NO_REFERENCED_ROW_2" }));
    const res = await request(app).post("/reviews").send({ movie_id: 99, rating: 5 });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MOVIE_NOT_FOUND");
  });

  test("500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app).post("/reviews").send({ movie_id: 1, rating: 5 });
    expect(res.status).toBe(500);
  });

  test("400 INVALID_JSON", async () => {
    const res = await request(app)
      .post("/reviews")
      .set("Content-Type", "application/json")
      .send("{oops");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });
});

describe("DELETE /reviews/:id", () => {
  test("200 ลบสำเร็จ", async () => {
    pool.query.mockResolvedValueOnce([[review]]).mockResolvedValueOnce([{}]);
    const res = await request(app).delete("/reviews/1");
    expect(res.status).toBe(200);
    expect(res.body.data.review_id).toBe(1);
  });

  test("404 เมื่อไม่พบรีวิว", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    const res = await request(app).delete("/reviews/99");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("REVIEW_NOT_FOUND");
  });

  test("500 เมื่อฐานข้อมูลผิดพลาด", async () => {
    pool.query.mockRejectedValue(new Error("db down"));
    const res = await request(app).delete("/reviews/1");
    expect(res.status).toBe(500);
  });
});
