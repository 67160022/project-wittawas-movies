require("dotenv").config();
const express = require("express");
const pool = require("./db");
const { searchMovies } = require("./services/external-api");

const app = express();
const PORT = 3000;

app.use(express.json());
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const fs = require("node:fs");
const path = require("node:path");

const specification = YAML.parse(
  fs.readFileSync(path.join(process.cwd(), "openapi.yaml"), "utf8"),
);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specification));

app.get("/", (req, res) => {
  res.status(200).json({ message: "Movies API พร้อมใช้งาน" });
});

// GET : รับข้อมูลหนังทั้งหมด
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
app.post("/api/v1/movies", async (req, res, next) => {
  const { title, director_id, releaseYear } = req.body;

  if (!title || !director_id || !releaseYear) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณากรอกข้อมูลหนังให้ครบถ้วน",
      },
    });
  }

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
app.put("/api/v1/movies/:id", async (req, res, next) => {
  const movieId = req.params.id;
  const { title, director_id, releaseYear } = req.body;

  if (!title || !director_id || !releaseYear) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณากรอกข้อมูลให้ครบถ้วน",
      },
    });
  }

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
app.patch("/api/v1/movies/:id", async (req, res, next) => {
  const movieId = req.params.id;
  const { title, director_id, releaseYear } = req.body;

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

    const newTitle = title ?? current.title;
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

// POST : เพิ่มรีวิวให้หนัง
app.post("/api/v1/movies/:id/reviews", async (req, res, next) => {
  const movieId = req.params.id;
  const { rating, comment } = req.body;

  if (!rating) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณากรอกคะแนนรีวิว",
      },
    });
  }

  try {
    // ตรวจสอบว่ามีหนังหรือไม่
    const [movieRows] = await pool.query(
      "SELECT * FROM movies WHERE movie_id = ?",
      [movieId],
    );

    if (movieRows.length === 0) {
      return res.status(404).json({
        error: {
          code: "MOVIE_NOT_FOUND",
          message: "ไม่พบข้อมูลหนัง",
        },
      });
    }

    // เพิ่มรีวิว
    const [result] = await pool.query(
      `INSERT INTO reviews
      (movie_id, rating, comment)
      VALUES (?, ?, ?)`,
      [movieId, rating, comment || null],
    );

    res.status(201).json({
      message: "เพิ่มรีวิวสำเร็จ",
      data: {
        review_id: result.insertId,
        movie_id: movieId,
        rating,
        comment: comment || null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE : ลบข้อมูลหนังตาม id
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
