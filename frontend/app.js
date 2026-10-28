// =====================================================================
// แผนผัง: ปุ่มบนหน้าเว็บ → ฟังก์ชันในไฟล์นี้ → Endpoint → โค้ดฝั่ง Backend
// =====================================================================
//
// [โหลดหน้าเว็บครั้งแรก] (ส่วน Init ท้ายไฟล์)
//   checkHealth()   → GET /api/v1/health     → src/index.js  app.get("/api/v1/health")
//                       └ Gateway เรียกต่อ   → src/review-service/index.js  app.get("/health")
//   loadDirectors() → GET /api/v1/directors  → src/index.js  app.get("/api/v1/directors")
//   loadMovies()    → GET /api/v1/movies     → src/index.js  app.get("/api/v1/movies")
//
// [📘 API Docs] (มุมขวาบน)  → เป็นลิงก์ ไม่ใช่ fetch → เปิด Swagger UI ที่ /api-docs
//   ตั้ง href ด้านล่างนี้ / Swagger อ่านสเปกจาก openapi.yaml (src/index.js ส่วน swaggerUi)
//
// [เพิ่มหนัง] (ฟอร์มซ้าย)    → listener ของ #add-movie-form → POST /api/v1/movies
//   ตรวจฟอร์ม: validateMovieForm()  |  Backend: src/index.js app.post("/api/v1/movies") + validateMovie()
//
// [ค้นหา] (ค้นหาจาก iTunes)  → listener ของ #external-form → GET /api/v1/external/movies?term=...
//   Backend: src/index.js app.get("/api/v1/external/movies")
//   → src/services/external-api.js searchMovies() (เรียก iTunes + retry/timeout/fallback)
//
// [ช่องกรองตามชื่อหนัง]      → renderMovies() — กรองใน browser เท่านั้น ไม่เรียก API
// [โหลดใหม่]                 → loadMovies()   → GET /api/v1/movies
//
// ปุ่มบนการ์ดหนังแต่ละใบ (สร้างใน renderMovies()):
//   [รีวิว] → openReviews() → loadReviews() → GET /api/v1/movies/:id/reviews
//   [แก้ไข] → openEdit() เปิด dialog (ยังไม่เรียก API)
//   [ลบ]   → deleteMovie() → DELETE /api/v1/movies/:id
//            Backend: src/index.js app.delete("/api/v1/movies/:id")
//
// ใน Dialog แก้ไขหนัง:
//   [บันทึก] → listener ของ #edit-movie-form → PUT /api/v1/movies/:id
//              Backend: src/index.js app.put("/api/v1/movies/:id")
//   [ยกเลิก] → ปิด dialog (ปุ่มที่มี data-close, ส่วน Init) ไม่เรียก API
//
// ใน Dialog รีวิว (ทุก endpoint รีวิวผ่าน Gateway → Review Service port 3001
//                  ผ่าน src/services/review-client.js callReviewService()):
//   [★ 1-5 ดาว] → แค่เลือกค่า rating ในฟอร์ม ไม่เรียก API
//   [ส่งรีวิว]  → listener ของ #review-form → POST /api/v1/movies/:id/reviews
//                Gateway: src/index.js app.post("/api/v1/movies/:id/reviews")
//                Service: src/review-service/index.js app.post("/reviews")
//   [ลบ] (รีวิว) → deleteReview() → DELETE /api/v1/reviews/:reviewId
//                Gateway: src/index.js app.delete("/api/v1/reviews/:reviewId")
//                Service: src/review-service/index.js app.delete("/reviews/:id")
//   [✕]        → ปิด dialog (data-close) ไม่เรียก API
//
// อยากแก้อะไร แก้ตรงไหน:
//   - หน้าตา/ข้อความของปุ่มและฟอร์ม   → frontend/index.html, frontend/style.css
//   - การ์ดหนังและปุ่มบนการ์ด          → renderMovies() ในไฟล์นี้
//   - ข้อความ error / การเรียก fetch    → api() ในไฟล์นี้
//   - กฎตรวจข้อมูลหนัง                → validateMovieForm() (Frontend) และ validateMovie() ใน src/index.js (Backend)
//     ต้องแก้ทั้งสองที่ให้ตรงกัน
//   - กฎตรวจรีวิว                     → listener ของ #review-form (Frontend) และ src/review-service/index.js (Backend)
//   - เปลี่ยน/เพิ่ม endpoint            → แก้ route ใน src/index.js และอัปเดต openapi.yaml ด้วย
//     (tests/openapi-sync.test.js เช็กว่า route กับ openapi.yaml ตรงกัน)
// =====================================================================

// เปิดผ่าน http://localhost:3000/ (express.static) ใช้ path สัมพัทธ์ได้
// ถ้าเปิดจากที่อื่น (file://, Live Server :5500) ให้เรียก backend ด้วย URL เต็ม (backend เปิด cors() ไว้แล้ว)
const API_BASE =
  location.port === "3000" ? "/api/v1" : "http://localhost:3000/api/v1";

// ลิงก์ Swagger UI ที่มุมขวาบน ชี้ไปยัง backend เดียวกับ API_BASE
document.getElementById("api-docs-link").href =
  location.port === "3000" ? "/api-docs" : "http://localhost:3000/api-docs";

const MAX_YEAR =new Date().getFullYear() + 5;

const $ = (selector, root = document) => root.querySelector(selector);

let movies = [];
let directors = [];
let currentReviewMovie = null;

// ---------- Helpers ----------

// เรียก API แล้วคืน body (JSON) — โยน Error ที่มีข้อความอ่านเข้าใจได้เมื่อไม่สำเร็จ
async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (backend อาจปิดอยู่)");
  }

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = body?.error?.message || body?.message || `เซิร์ฟเวอร์ตอบกลับผิดพลาด (${res.status})`;
    throw new Error(message);
  }
  return body;
}

// สร้าง element แบบปลอดภัย (ใช้ textContent ไม่ใช้ innerHTML กับข้อมูลจากผู้ใช้)
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  children.flat().forEach((child) => {
    if (child != null) node.append(child);
  });
  return node;
}

function setStatus(target, type, message) {
  target.className = target.className.replace(/\b(loading|error|success|info)\b/g, "").trim();
  target.replaceChildren();
  if (!message) return;
  target.classList.add(type);
  if (type === "loading") target.append(el("span", { className: "spinner" }));
  target.append(message);
}

let toastTimer;
function toast(message, type = "success") {
  const box = $("#toast");
  box.textContent = message;
  box.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("show"), 3000);
}

function setBusy(form, busy) {
  form.querySelectorAll("button, input, select, textarea").forEach((field) => {
    field.disabled = busy;
  });
}

function showFieldErrors(form, errors) {
  form.querySelectorAll(".field-error").forEach((small) => {
    small.textContent = errors[small.dataset.for] || "";
  });
  form.querySelectorAll("[name]").forEach((field) => {
    field.classList.toggle("invalid", Boolean(errors[field.name]));
  });
}

const directorName = (id) =>
  directors.find((d) => d.director_id === id)?.name ?? `ผู้กำกับ #${id}`;

// ---------- Validation (ฝั่ง Frontend) ----------

function validateMovieForm(form) {
  const title = form.title.value.trim();
  const directorId = Number(form.director_id.value);
  const year = Number(form.releaseYear.value);
  const errors = {};

  if (!title) errors.title = "กรุณากรอกชื่อหนัง";
  else if (title.length > 200) errors.title = "ชื่อหนังต้องไม่เกิน 200 ตัวอักษร";

  if (!form.director_id.value) errors.director_id = "กรุณาเลือกผู้กำกับ";

  if (!form.releaseYear.value) errors.releaseYear = "กรุณากรอกปีที่ฉาย";
  else if (!Number.isInteger(year) || year < 1888 || year > MAX_YEAR)
    errors.releaseYear = `ปีที่ฉายต้องเป็นจำนวนเต็มระหว่าง 1888-${MAX_YEAR}`;

  showFieldErrors(form, errors);
  const valid = Object.keys(errors).length === 0;
  return valid ? { title, director_id: directorId, releaseYear: year } : null;
}

// ---------- Health ----------

async function checkHealth() {
  const box = $("#health");
  try {
    const body = await api("/health");
    const reviewOk = body.services["review-service"] === "ok";
    box.className = `health ${reviewOk ? "ok" : "partial"}`;
    $("#health-text").textContent = reviewOk
      ? "ระบบพร้อมใช้งาน"
      : "Review Service ไม่พร้อมใช้งาน";
  } catch {
    box.className = "health down";
    $("#health-text").textContent = "เชื่อมต่อ API ไม่ได้";
  }
}

// ---------- Directors (GET /directors) ----------

async function loadDirectors() {
  const selects = document.querySelectorAll("select[name=director_id]");
  try {
    const body = await api("/directors");
    directors = body.data;
    selects.forEach((select) => {
      select.replaceChildren(
        el("option", { value: "", textContent: "-- เลือกผู้กำกับ --" }),
        ...directors.map((d) =>
          el("option", { value: d.director_id, textContent: d.name }),
        ),
      );
    });
  } catch (err) {
    selects.forEach((select) => {
      select.replaceChildren(el("option", { value: "", textContent: "โหลดรายชื่อไม่สำเร็จ" }));
    });
    toast(`โหลดรายชื่อผู้กำกับไม่สำเร็จ: ${err.message}`, "error");
  }
}

// ---------- Movies (GET /movies) ----------

async function loadMovies() {
  const status = $("#list-status");
  const reloadBtn = $("#reload");
  setStatus(status, "loading", "กำลังโหลดรายการหนัง...");
  reloadBtn.disabled = true;

  try {
    const body = await api("/movies");
    movies = body.data;
    setStatus(status);
    renderMovies();
  } catch (err) {
    movies = [];
    renderMovies();
    $("#movie-grid").replaceChildren();
    setStatus(status, "error", `โหลดรายการหนังไม่สำเร็จ: ${err.message}`);
  } finally {
    reloadBtn.disabled = false;
  }
}

function renderMovies() {
  const keyword = $("#filter").value.trim().toLowerCase();
  const shown = movies.filter((m) => m.title.toLowerCase().includes(keyword));
  const grid = $("#movie-grid");

  $("#movie-count").textContent = movies.length ? `(${shown.length}/${movies.length})` : "";

  if (shown.length === 0) {
    grid.replaceChildren(
      el("p", {
        className: "empty",
        textContent: movies.length ? "ไม่พบหนังที่ตรงกับคำค้น" : "ยังไม่มีข้อมูลหนัง",
      }),
    );
    return;
  }

  grid.replaceChildren(
    ...shown.map((movie) =>
      el(
        "article",
        { className: "card" },
        el("span", { className: "badge", textContent: movie.movie_code }),
        el("h3", { textContent: movie.title }),
        el("div", {
          className: "meta",
          textContent: `${directorName(movie.director_id)} · ${movie.release_year}`,
        }),
        el(
          "div",
          { className: "actions" },
          // ปุ่ม [รีวิว] → openReviews() เปิด dialog รีวิว + GET /movies/:id/reviews
          el("button", { className: "btn small", textContent: "รีวิว", onclick: () => openReviews(movie) }),
          // ปุ่ม [แก้ไข] → openEdit() เติมค่าเดิมลงฟอร์มแล้วเปิด dialog (กดบันทึกถึงจะ PUT)
          el("button", { className: "btn small", textContent: "แก้ไข", onclick: () => openEdit(movie) }),
          // ปุ่ม [ลบ] → deleteMovie() → DELETE /movies/:id
          el("button", { className: "btn small danger", textContent: "ลบ", onclick: () => deleteMovie(movie) }),
        ),
      ),
    ),
  );
}

// ---------- Add movie (POST /movies) ----------
// ปุ่ม [เพิ่มหนัง] — Backend: src/index.js app.post("/api/v1/movies")

$("#add-movie-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = $("#add-status");
  const data = validateMovieForm(form);

  if (!data) {
    setStatus(status, "error", "กรุณาแก้ไขข้อมูลที่ไม่ถูกต้อง");
    return;
  }

  setStatus(status, "loading", "กำลังบันทึก...");
  setBusy(form, true);

  try {
    const body = await api("/movies", { method: "POST", body: JSON.stringify(data) });
    setStatus(status, "success", `เพิ่ม "${body.data.title}" สำเร็จ (รหัส ${body.data.movieCode})`);
    form.reset();
    loadMovies();
  } catch (err) {
    setStatus(status, "error", `บันทึกไม่สำเร็จ: ${err.message}`);
  } finally {
    setBusy(form, false);
  }
});

// ---------- Edit movie (PUT /movies/:id) ----------
// ปุ่ม [แก้ไข] บนการ์ด → openEdit() / ปุ่ม [บันทึก] ใน dialog → submit listener ด้านล่าง
// Backend: src/index.js app.put("/api/v1/movies/:id")

function openEdit(movie) {
  const form = $("#edit-movie-form");
  form.movie_id.value = movie.movie_id;
  form.title.value = movie.title;
  form.director_id.value = movie.director_id;
  form.releaseYear.value = movie.release_year;
  showFieldErrors(form, {});
  setStatus($("#edit-status"));
  $("#edit-dialog").showModal();
}

$("#edit-movie-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = $("#edit-status");
  const data = validateMovieForm(form);
  if (!data) return;

  setStatus(status, "loading", "กำลังบันทึก...");
  setBusy(form, true);

  try {
    await api(`/movies/${form.movie_id.value}`, { method: "PUT", body: JSON.stringify(data) });
    $("#edit-dialog").close();
    toast("แก้ไขข้อมูลหนังสำเร็จ");
    loadMovies();
  } catch (err) {
    setStatus(status, "error", `แก้ไขไม่สำเร็จ: ${err.message}`);
  } finally {
    setBusy(form, false);
  }
});

// ---------- Delete movie (DELETE /movies/:id) ----------
// ปุ่ม [ลบ] บนการ์ด — Backend: src/index.js app.delete("/api/v1/movies/:id")
// (รีวิวของหนังถูกลบตามด้วย ON DELETE CASCADE ใน schema.sql)

async function deleteMovie(movie) {
  if (!confirm(`ยืนยันการลบ "${movie.title}"?\nรีวิวของหนังเรื่องนี้จะถูกลบไปด้วย`)) return;

  setStatus($("#list-status"), "loading", `กำลังลบ "${movie.title}"...`);
  try {
    await api(`/movies/${movie.movie_id}`, { method: "DELETE" });
    toast(`ลบ "${movie.title}" สำเร็จ`);
    loadMovies();
  } catch (err) {
    setStatus($("#list-status"), "error", `ลบไม่สำเร็จ: ${err.message}`);
  }
}

// ---------- Reviews (Review Service ผ่าน Gateway) ----------
// ปุ่ม [รีวิว] บนการ์ด → openReviews() → loadReviews()
// GET: src/index.js app.get("/api/v1/movies/:id/reviews") → src/review-service/index.js app.get("/reviews")

function openReviews(movie) {
  currentReviewMovie = movie;
  $("#review-title").textContent = `รีวิว: ${movie.title}`;
  $("#review-summary").textContent = "";
  const form = $("#review-form");
  form.reset();
  showFieldErrors(form, {});
  setStatus($("#review-form-status"));
  $("#review-dialog").showModal();
  loadReviews();
}

async function loadReviews() {
  const movie = currentReviewMovie;
  const status = $("#review-status");
  const list = $("#review-list");
  setStatus(status, "loading", "กำลังโหลดรีวิว...");
  list.replaceChildren();

  try {
    const body = await api(`/movies/${movie.movie_id}/reviews`);
    setStatus(status);

    const { count, average } = body.summary;
    $("#review-summary").textContent = count
      ? `คะแนนเฉลี่ย ${average} / 5 จาก ${count} รีวิว`
      : "ยังไม่มีรีวิว เป็นคนแรกที่รีวิวเรื่องนี้";

    list.replaceChildren(
      ...body.data.map((review) =>
        el(
          "li",
          {},
          el(
            "div",
            {},
            el("span", {
              className: "rating",
              textContent: "★".repeat(review.rating) + "☆".repeat(5 - review.rating),
            }),
            review.comment ? el("p", { textContent: review.comment }) : null,
            el("time", { textContent: new Date(review.created_at).toLocaleString("th-TH") }),
          ),
          // ปุ่ม [ลบ] ของรีวิวแต่ละอัน → deleteReview() → DELETE /reviews/:reviewId
          el("button", {
            className: "btn small danger",
            textContent: "ลบ",
            onclick: () => deleteReview(review),
          }),
        ),
      ),
    );
  } catch (err) {
    $("#review-summary").textContent = "";
    setStatus(status, "error", `โหลดรีวิวไม่สำเร็จ: ${err.message}`);
  }
}

// ปุ่ม [ส่งรีวิว] → POST /movies/:id/reviews
// Gateway: src/index.js app.post("/api/v1/movies/:id/reviews") → Service: src/review-service/index.js app.post("/reviews")
$("#review-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = $("#review-form-status");
  const rating = Number(form.rating.value);
  const comment = form.comment.value.trim();
  const errors = {};

  if (!rating) errors.rating = "กรุณาเลือกคะแนน 1-5 ดาว";
  if (comment.length > 500) errors.comment = "ความคิดเห็นต้องไม่เกิน 500 ตัวอักษร";
  showFieldErrors(form, errors);
  if (Object.keys(errors).length) return;

  setStatus(status, "loading", "กำลังส่งรีวิว...");
  setBusy(form, true);

  try {
    await api(`/movies/${currentReviewMovie.movie_id}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating, comment: comment || null }),
    });
    setStatus(status, "success", "ส่งรีวิวสำเร็จ ขอบคุณสำหรับความคิดเห็น");
    form.reset();
    loadReviews();
  } catch (err) {
    setStatus(status, "error", `ส่งรีวิวไม่สำเร็จ: ${err.message}`);
  } finally {
    setBusy(form, false);
  }
});

// Gateway: src/index.js app.delete("/api/v1/reviews/:reviewId") → Service: src/review-service/index.js app.delete("/reviews/:id")
async function deleteReview(review) {
  if (!confirm("ยืนยันการลบรีวิวนี้?")) return;
  try {
    await api(`/reviews/${review.review_id}`, { method: "DELETE" });
    toast("ลบรีวิวสำเร็จ");
    loadReviews();
  } catch (err) {
    toast(`ลบรีวิวไม่สำเร็จ: ${err.message}`, "error");
  }
}

// ---------- External search (GET /external/movies) ----------
// ปุ่ม [ค้นหา] — Backend: src/index.js app.get("/api/v1/external/movies") → src/services/external-api.js

$("#external-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const term = form.term.value.trim();
  const status = $("#external-status");
  const list = $("#external-list");

  $("#external-error").textContent = term ? "" : "กรุณาพิมพ์คำค้น";
  form.term.classList.toggle("invalid", !term);
  if (!term) return;

  list.replaceChildren();
  setStatus(status, "loading", "กำลังค้นหาจาก iTunes (อาจใช้เวลาหลายวินาทีถ้าบริการช้า)...");
  setBusy(form, true);

  try {
    const body = await api(`/external/movies?term=${encodeURIComponent(term)}`);
    if (body.data.length === 0) {
      setStatus(status, "info", `ไม่พบหนังที่ตรงกับ "${term}"`);
      return;
    }
    setStatus(status);
    list.replaceChildren(
      ...body.data.map((m) =>
        el(
          "li",
          {},
          el("strong", { textContent: m.title }),
          el("span", {
            textContent: `${m.director || "-"} · ${m.releaseDate ? new Date(m.releaseDate).getFullYear() : "-"}`,
          }),
        ),
      ),
    );
  } catch (err) {
    setStatus(status, "error", err.message);
  } finally {
    setBusy(form, false);
  }
});

// ---------- Init ----------

// ปุ่ม [ยกเลิก] (dialog แก้ไข) และ [✕] (dialog รีวิว) — ปิด dialog เฉยๆ ไม่เรียก API
document.querySelectorAll("dialog [data-close]").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest("dialog").close());
});
// ช่องกรองชื่อหนัง → กรองข้อมูลที่โหลดมาแล้วใน browser (ไม่เรียก API)
$("#filter").addEventListener("input", renderMovies);
// ปุ่ม [โหลดใหม่] → GET /movies อีกรอบ
$("#reload").addEventListener("click", loadMovies);

checkHealth();
loadDirectors().then(loadMovies);
