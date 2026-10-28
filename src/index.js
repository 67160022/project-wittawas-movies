require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const { searchMovies } = require("./services/external-api");
const { callReviewService } = require("./services/review-client");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const fs = require("node:fs");
const path = require("node:path");

const specification = YAML.parse(
  fs.readFileSync(path.join(__dirname, "..", "openapi.yaml"), "utf8"),
);

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(specification, {
    customSiteTitle: "Movies API Docs",
    swaggerOptions: {
      docExpansion: "list",
      filter: true,
      tryItOutEnabled: true,
    },
  }),
);

// Frontend: เปิด http://localhost:3000/ ได้เลย (origin เดียวกับ API)
app.use(express.static(path.join(__dirname, "..", "frontend")));

// GET : ตรวจสอบสถานะระบบ (Movies API + Review Service)
// หน้าเว็บ: ป้ายสถานะมุมขวาบน — checkHealth() ใน frontend/app.js
app.get("/api/v1/health", async (req, res) => {
  const reviewService = await callReviewService("get", "/health");

  res.status(200).json({
    message: "Movies API พร้อมใช้งาน",
    services: {
      "movies-api": "ok",
      "review-service": reviewService.status === 200 ? "ok" : "unavailable",
    },
  });
});

// ตรวจสอบข้อมูลหนัง — partial = true สำหรับ PATCH (ตรวจเฉพาะฟิลด์ที่ส่งมา)
const MAX_RELEASE_YEAR = new Date().getFullYear() + 5;

function validateMovie({ title, director_id, releaseYear }, partial = false) {
  if (!partial && (!title || !director_id || !releaseYear)) {
    return "กรุณากรอกข้อมูลหนังให้ครบถ้วน";
  }
  if (
    title != null &&
    (typeof title !== "string" || !title.trim() || title.length > 200)
  ) {
    return "ชื่อหนังต้องเป็นข้อความ 1-200 ตัวอักษร";
  }
  if (
    director_id != null &&
    !(Number.isInteger(director_id) && director_id > 0)
  ) {
    return "director_id ต้องเป็นจำนวนเต็มบวก";
  }
  if (
    releaseYear != null &&
    !(
      Number.isInteger(releaseYear) &&
      releaseYear >= 1888 &&
      releaseYear <= MAX_RELEASE_YEAR
    )
  ) {
    return `ปีที่ฉายต้องเป็นจำนวนเต็มระหว่าง 1888-${MAX_RELEASE_YEAR}`;
  }
  return null;
}

// GET : ดึงรายชื่อผู้กำกับ (ใช้ทำ dropdown ใน Frontend)
// หน้าเว็บ: dropdown ผู้กำกับในฟอร์มเพิ่ม/แก้ไข — loadDirectors() ใน frontend/app.js
app.get("/api/v1/directors", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM directors ORDER BY name");

    res.status(200).json({
      message: "ดึงข้อมูลผู้กำกับสำเร็จ",
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET : รับข้อมูลหนังทั้งหมด
// หน้าเว็บ: โหลดตอนเปิดหน้า, ปุ่ม [โหลดใหม่], และหลังเพิ่ม/แก้ไข/ลบสำเร็จ — loadMovies() ใน frontend/app.js
app.get("/api/v1/movies", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM movies");

    res.status(200).json({
      message: "ดึงข้อมูลหนังสำเร็จ",
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET : ดึงข้อมูลหนังตาม id
// หน้าเว็บ: ไม่ได้ใช้ (ใช้ผ่าน Postman / Swagger)
app.get("/api/v1/movies/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM movies WHERE movie_id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลหนัง",
        },
      });
    }

    res.status(200).json({
      message: "ดึงข้อมูลหนังสำเร็จ",
      data: rows[0],
    });
  } catch (err) {
    next(err);
  }
});

// POST : เพิ่มข้อมูลหนังใหม่
// หน้าเว็บ: ปุ่ม [เพิ่มหนัง] — submit listener ของ #add-movie-form ใน frontend/app.js
app.post("/api/v1/movies", async (req, res, next) => {
  const { director_id, releaseYear } = req.body;
  const validationError = validateMovie(req.body);

  if (validationError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: validationError,
      },
    });
  }

  const title = req.body.title.trim();
  const movieCode =
    title.replace(/\s/g, "").substring(0, 4).toUpperCase() + releaseYear;

  try {
    const [result] = await pool.query(
      `INSERT INTO movies
      (title, director_id, release_year, movie_code)
      VALUES (?, ?, ?, ?)`,
      [title, director_id, releaseYear, movieCode],
    );

    res.status(201).json({
      message: "เพิ่มข้อมูลหนังสำเร็จ",
      data: {
        movie_id: result.insertId,
        title,
        director_id,
        releaseYear,
        movieCode,
      },
    });
  } catch (err) {
    // Foreign Key ของ director_id ไม่ถูกต้อง
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json({
        error: {
          code: "DIRECTOR_NOT_FOUND",
          message: "ไม่พบข้อมูลผู้กำกับ",
        },
      });
    }

    // title หรือ movie_code ซ้ำ
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "CONFLICT_ERROR",
          message: "หนังนี้มีอยู่แล้วในระบบ",
        },
      });
    }

    next(err);
  }
});

// PUT : แก้ไขข้อมูลหนังทั้งหมดตาม id
// หน้าเว็บ: ปุ่ม [บันทึก] ใน dialog แก้ไข — submit listener ของ #edit-movie-form ใน frontend/app.js
app.put("/api/v1/movies/:id", async (req, res, next) => {
  const movieId = req.params.id;
  const { director_id, releaseYear } = req.body;
  const validationError = validateMovie(req.body);

  if (validationError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: validationError,
      },
    });
  }

  const title = req.body.title.trim();
  const movieCode =
    title.replace(/\s/g, "").substring(0, 4).toUpperCase() + releaseYear;

  try {
    const [existingRows] = await pool.query(
      "SELECT * FROM movies WHERE movie_id = ?",
      [movieId],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลหนัง",
        },
      });
    }

    await pool.query(
      `UPDATE movies
       SET title = ?,
           director_id = ?,
           release_year = ?,
           movie_code = ?
       WHERE movie_id = ?`,
      [title, director_id, releaseYear, movieCode, movieId],
    );

    const [updatedRows] = await pool.query(
      "SELECT * FROM movies WHERE movie_id = ?",
      [movieId],
    );

    res.status(200).json({
      message: "แก้ไขข้อมูลหนังสำเร็จ",
      data: updatedRows[0],
    });
  } catch (err) {
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json({
        error: {
          code: "DIRECTOR_NOT_FOUND",
          message: "ไม่พบข้อมูลผู้กำกับ",
        },
      });
    }

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "CONFLICT_ERROR",
          message: "หนังนี้มีอยู่แล้วในระบบ",
        },
      });
    }

    next(err);
  }
});

// PATCH : แก้ไขข้อมูลหนังบางส่วนตาม id
// หน้าเว็บ: ไม่ได้ใช้ (หน้าเว็บใช้ PUT) — ใช้ผ่าน Postman / Swagger
app.patch("/api/v1/movies/:id", async (req, res, next) => {
  const movieId = req.params.id;
  const { title, director_id, releaseYear } = req.body ?? {};
  const validationError = validateMovie(req.body ?? {}, true);

  if (validationError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: validationError,
      },
    });
  }

  try {
    const [existingRows] = await pool.query(
      "SELECT * FROM movies WHERE movie_id = ?",
      [movieId],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลหนัง",
        },
      });
    }

    const current = existingRows[0];

    const newTitle = title?.trim() ?? current.title;
    const newDirectorId = director_id ?? current.director_id;
    const newReleaseYear = releaseYear ?? current.release_year;

    const movieCode =
      newTitle.replace(/\s/g, "").substring(0, 4).toUpperCase() +
      newReleaseYear;

    await pool.query(
      `UPDATE movies
       SET title = ?,
           director_id = ?,
           release_year = ?,
           movie_code = ?
       WHERE movie_id = ?`,
      [newTitle, newDirectorId, newReleaseYear, movieCode, movieId],
    );

    const [updatedRows] = await pool.query(
      "SELECT * FROM movies WHERE movie_id = ?",
      [movieId],
    );

    res.status(200).json({
      message: "แก้ไขข้อมูลหนังสำเร็จ",
      data: updatedRows[0],
    });
  } catch (err) {
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json({
        error: {
          code: "DIRECTOR_NOT_FOUND",
          message: "ไม่พบข้อมูลผู้กำกับ",
        },
      });
    }

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "CONFLICT_ERROR",
          message: "หนังนี้มีอยู่แล้วในระบบ",
        },
      });
    }

    next(err);
  }
});

// ---------- Reviews: Gateway ส่งต่อไปยัง Review Service (Microservice) ----------

// ตรวจว่ามีหนังอยู่จริงก่อนส่งต่อไปยัง Review Service
async function findMovie(movieId) {
  const [rows] = await pool.query("SELECT * FROM movies WHERE movie_id = ?", [
    movieId,
  ]);
  return rows[0];
}

const movieNotFound = (res) =>
  res.status(404).json({
    error: {
      code: "MOVIE_NOT_FOUND",
      message: "ไม่พบข้อมูลหนัง",
    },
  });

// GET : ดึงรีวิวทั้งหมดของหนัง
// หน้าเว็บ: ปุ่ม [รีวิว] บนการ์ดหนัง — loadReviews() ใน frontend/app.js
app.get("/api/v1/movies/:id/reviews", async (req, res, next) => {
  try {
    const movie = await findMovie(req.params.id);
    if (!movie) return movieNotFound(res);

    const result = await callReviewService(
      "get",
      `/reviews?movie_id=${movie.movie_id}`,
    );
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

// POST : เพิ่มรีวิวให้หนัง
// หน้าเว็บ: ปุ่ม [ส่งรีวิว] ใน dialog รีวิว — submit listener ของ #review-form ใน frontend/app.js
app.post("/api/v1/movies/:id/reviews", async (req, res, next) => {
  try {
    const movie = await findMovie(req.params.id);
    if (!movie) return movieNotFound(res);

    const { rating, comment } = req.body ?? {};
    const result = await callReviewService("post", "/reviews", {
      movie_id: movie.movie_id,
      rating,
      comment,
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

// DELETE : ลบรีวิวตาม id
// หน้าเว็บ: ปุ่ม [ลบ] ข้างรีวิวแต่ละอัน — deleteReview() ใน frontend/app.js
app.delete("/api/v1/reviews/:reviewId", async (req, res) => {
  const result = await callReviewService(
    "delete",
    `/reviews/${encodeURIComponent(req.params.reviewId)}`,
  );
  res.status(result.status).json(result.body);
});

// DELETE : ลบข้อมูลหนังตาม id
// หน้าเว็บ: ปุ่ม [ลบ] บนการ์ดหนัง — deleteMovie() ใน frontend/app.js
app.delete("/api/v1/movies/:id", async (req, res, next) => {
  const movieId = req.params.id;

  try {
    const [existingRows] = await pool.query(
      "SELECT * FROM movies WHERE movie_id = ?",
      [movieId],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "ไม่พบข้อมูลหนัง",
        },
      });
    }

    await pool.query("DELETE FROM movies WHERE movie_id = ?", [movieId]);

    res.status(200).json({
      message: "ลบข้อมูลหนังสำเร็จ",
      data: existingRows[0],
    });
  } catch (err) {
    next(err);
  }
});

// GET : ค้นหาหนังจาก API ภายนอก (retry/timeout/fallback อยู่ใน service)
// หน้าเว็บ: ปุ่ม [ค้นหา] ในส่วน "ค้นหาจาก iTunes" — submit listener ของ #external-form ใน frontend/app.js
app.get("/api/v1/external/movies", async (req, res, next) => {
  try {
    const term = req.query.term;

    if (typeof term !== "string" || !term.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "กรุณาระบุชื่อหนังใน query parameter term",
        },
      });
    }

    const result = await searchMovies(term.trim());
    return res.status(result.success ? 200 : 503).json(result);
  } catch (err) {
    next(err);
  }
});

// Error Handler
app.use((err, req, res, next) => {
  // body ไม่ใช่ JSON ที่ถูกต้อง
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "รูปแบบ JSON ไม่ถูกต้อง",
      },
    });
  }

  console.error(err);

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
    },
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
