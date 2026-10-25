// Review Service (Microservice) — ดูแลข้อมูลรีวิวหนังแยกจาก Movies API
// Movies API (Gateway, port 3000) จะเรียก service นี้ผ่าน HTTP เท่านั้น
require("dotenv").config({ quiet: true });
const express = require("express");
const pool = require("../db");

const app = express();
const PORT = process.env.REVIEW_SERVICE_PORT || 3001;

app.use(express.json());

const isPositiveInt = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

// GET : ตรวจสอบสถานะ service
app.get("/health", (req, res) => {
  res.status(200).json({ service: "review-service", status: "ok" });
});

// GET : ดึงรีวิวทั้งหมดของหนัง พร้อมคะแนนเฉลี่ย
app.get("/reviews", async (req, res, next) => {
  const movieId = req.query.movie_id;

  if (!isPositiveInt(movieId)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ movie_id เป็นจำนวนเต็มบวก",
      },
    });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM reviews WHERE movie_id = ? ORDER BY created_at DESC, review_id DESC",
      [movieId],
    );

    const total = rows.reduce((sum, review) => sum + review.rating, 0);
    const average = rows.length ? Number((total / rows.length).toFixed(2)) : null;

    res.status(200).json({
      message: "ดึงข้อมูลรีวิวสำเร็จ",
      summary: { count: rows.length, average },
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// POST : เพิ่มรีวิว
app.post("/reviews", async (req, res, next) => {
  const { movie_id, rating, comment } = req.body;

  if (!isPositiveInt(movie_id)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ movie_id เป็นจำนวนเต็มบวก",
      },
    });
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "คะแนนรีวิวต้องเป็นจำนวนเต็ม 1-5",
      },
    });
  }

  if (comment != null && (typeof comment !== "string" || comment.length > 500)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "ความคิดเห็นต้องเป็นข้อความไม่เกิน 500 ตัวอักษร",
      },
    });
  }

  const cleanComment = comment?.trim() || null;

  try {
    const [result] = await pool.query(
      "INSERT INTO reviews (movie_id, rating, comment) VALUES (?, ?, ?)",
      [movie_id, rating, cleanComment],
    );

    res.status(201).json({
      message: "เพิ่มรีวิวสำเร็จ",
      data: {
        review_id: result.insertId,
        movie_id: Number(movie_id),
        rating,
        comment: cleanComment,
      },
    });
  } catch (err) {
    // movie_id ไม่มีอยู่ในตาราง movies
    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(404).json({
        error: {
          code: "MOVIE_NOT_FOUND",
          message: "ไม่พบข้อมูลหนัง",
        },
      });
    }

    next(err);
  }
});

// DELETE : ลบรีวิวตาม id
app.delete("/reviews/:id", async (req, res, next) => {
  const reviewId = req.params.id;

  try {
    const [existingRows] = await pool.query(
      "SELECT * FROM reviews WHERE review_id = ?",
      [reviewId],
    );

    if (existingRows.length === 0) {
      return res.status(404).json({
        error: {
          code: "REVIEW_NOT_FOUND",
          message: "ไม่พบข้อมูลรีวิว",
        },
      });
    }

    await pool.query("DELETE FROM reviews WHERE review_id = ?", [reviewId]);

    res.status(200).json({
      message: "ลบรีวิวสำเร็จ",
      data: existingRows[0],
    });
  } catch (err) {
    next(err);
  }
});

// Error Handler
app.use((err, req, res, next) => {
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
      message: "เกิดข้อผิดพลาดภายใน Review Service",
    },
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Review Service running on http://localhost:${PORT}`);
  });
}

module.exports = app;
