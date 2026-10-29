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
// [ API Docs] (มุมขวาบน)  → เป็นลิงก์ ไม่ใช่ fetch → เปิด Swagger UI ที่ /api-docs
//   ตั้ง href ด้านล่างนี้ / Swagger อ่านสเปกจาก openapi.yaml (src/index.js ส่วน swaggerUi)
//
// [เพิ่มหนัง] (ฟอร์มซ้าย)    → listener ของ #add-movie-form → POST /api/v1/movies
//   ตรวจฟอร์ม: validateMovieForm()  |  Backend: src/index.js app.post("/api/v1/movies") + validateMovie()
//
// [+ เพิ่มผู้กำกับใหม่...] (ตัวเลือกสุดท้ายใน dropdown ผู้กำกับ — มีทั้งฟอร์มเพิ่มหนังและ dialog แก้ไข)
//   เลือกแล้ว → toggleNewDirector() แสดงช่องกรอกชื่อ/สัญชาติ (ยังไม่เรียก API)
//   กด [เพิ่มหนัง] หรือ [บันทึก] → resolveDirectorId() → createDirector() → POST /api/v1/directors
//                                  → loadDirectors() โหลด dropdown ใหม่ แล้วค่อยบันทึกหนังด้วย director_id ที่ได้
//   Backend: src/index.js app.post("/api/v1/directors") + validateDirector()
//
// [ค้นหา] (ค้นหาจาก iTunes)  → listener ของ #external-form → GET /api/v1/external/movies?term=...
//   Backend: src/index.js app.get("/api/v1/external/movies")
//   → src/services/external-api.js searchMovies() (เรียก iTunes + retry/timeout/fallback)
//
// [ช่องกรองตามชื่อหนัง]      → renderMovies() — กรองใน browser เท่านั้น ไม่เรียก API
// [โหลดใหม่]                 → loadMovies()   → GET /api/v1/movies
//
// ปุ่มบนการ์ดหนังแต่ละใบ (สร้างใน createMovieCard() ที่ renderMovies() เรียก):
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

// =====================================================================

// ---------- ค่าตั้งต้น ----------

// เปิดผ่าน http://localhost:3000/ (express.static) ใช้ path สัมพัทธ์ได้
// ถ้าเปิดจากที่อื่น (file://, Live Server :5500) ให้เรียก backend ด้วย URL เต็ม (backend เปิด cors() ไว้แล้ว)
let API_BASE = "http://localhost:3000/api/v1";
let DOCS_URL = "http://localhost:3000/api-docs";
if (location.port === "3000") {
  API_BASE = "/api/v1";
  DOCS_URL = "/api-docs";
}

// ลิงก์ Swagger UI ที่มุมขวาบน ชี้ไปยัง backend เดียวกับ API_BASE
document.getElementById("api-docs-link").href = DOCS_URL;

// ปีที่ฉายสูงสุดที่ยอมรับ = ปีปัจจุบัน + 5
const MAX_YEAR = new Date().getFullYear() + 5;

// ค่า value ของตัวเลือก "+ เพิ่มผู้กำกับใหม่..." ใน dropdown (ไม่ใช่ id จริง จึงต้องไม่ใช่ตัวเลข)
const NEW_DIRECTOR = "__new__";

// ข้อมูลที่โหลดมาจาก API เก็บไว้ในตัวแปรเหล่านี้
let movies = []; // รายการหนังทั้งหมด
let directors = []; // รายชื่อผู้กำกับทั้งหมด
let currentReviewMovie = null; // หนังที่กำลังเปิด dialog รีวิวอยู่

// ---------- Helpers ----------

// เรียก API แล้วคืน body (JSON) — โยน Error ที่มีข้อความอ่านเข้าใจได้เมื่อไม่สำเร็จ
// ตัวอย่าง: await api("/movies", { method: "POST", body: JSON.stringify(movie) })
async function api(path, options) {
  if (!options) {
    options = {};
  }

  // เตรียมค่าที่จะส่งให้ fetch
  const fetchOptions = {};
  if (options.method) {
    fetchOptions.method = options.method;
  }
  // ถ้ามี body (ข้อมูลที่ส่งไป) ต้องบอก server ว่าเป็น JSON
  if (options.body) {
    fetchOptions.body = options.body;
    fetchOptions.headers = { "Content-Type": "application/json" };
  }

  // 1) ส่ง request — ถ้า fetch พังแปลว่าต่อ server ไม่ได้เลย
  let res;
  try {
    res = await fetch(API_BASE + path, fetchOptions);
  } catch (err) {
    throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (backend อาจปิดอยู่)");
  }

  // 2) อ่าน body เฉพาะเมื่อ server ตอบกลับเป็น JSON
  let body = null;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    try {
      body = await res.json();
    } catch (err) {
      body = null;
    }
  }

  // 3) ถ้า status ไม่ใช่ 2xx → หาข้อความ error จาก body แล้วโยน Error ออกไป
  if (!res.ok) {
    let message = `เซิร์ฟเวอร์ตอบกลับผิดพลาด (${res.status})`;
    if (body && body.error && body.error.message) {
      message = body.error.message;
    } else if (body && body.message) {
      message = body.message;
    }
    throw new Error(message);
  }

  return body;
}

// แสดงข้อความสถานะในกล่อง target
// type: "loading" | "error" | "success" | "info"  — ถ้าไม่ส่ง message มา = ล้างกล่องให้ว่าง
function setStatus(target, type, message) {
  // ล้างสถานะเดิมออกก่อน
  target.classList.remove("loading", "error", "success", "info");
  target.textContent = "";

  if (!message) {
    return;
  }

  target.classList.add(type);

  // ตอนกำลังโหลด ให้มีวงกลมหมุนๆ อยู่หน้าข้อความ
  if (type === "loading") {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    target.appendChild(spinner);
  }

  // ใช้ createTextNode (ไม่ใช้ innerHTML) เพื่อกันข้อความจากผู้ใช้ถูกตีความเป็น HTML
  target.appendChild(document.createTextNode(message));
}

// แสดงข้อความเด้งมุมจอ 3 วินาที (type: "success" หรือ "error")
let toastTimer;
function toast(message, type) {
  if (!type) {
    type = "success";
  }
  const box = document.getElementById("toast");
  box.textContent = message;
  box.className = "toast show " + type;

  // ยกเลิกตัวจับเวลาเก่า (ถ้ามี) แล้วตั้งใหม่
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    box.classList.remove("show");
  }, 3000);
}

// ปิด/เปิดทุกช่องในฟอร์ม (กันกดซ้ำระหว่างรอ API)
function setBusy(form, busy) {
  const fields = form.querySelectorAll("button, input, select, textarea");
  for (const field of fields) {
    field.disabled = busy;
  }
}

// แสดงข้อความ error ใต้แต่ละช่อง
// errors เป็น object เช่น { title: "กรุณากรอกชื่อหนัง" } — ส่ง {} มา = ล้าง error ทั้งหมด
function showFieldErrors(form, errors) {
  // ข้อความ error ใต้ช่อง (<small class="field-error" data-for="ชื่อช่อง">)
  const errorBoxes = form.querySelectorAll(".field-error");
  for (const small of errorBoxes) {
    const fieldName = small.dataset.for;
    if (errors[fieldName]) {
      small.textContent = errors[fieldName];
    } else {
      small.textContent = "";
    }
  }

  // กรอบสีแดงของช่องที่ผิด
  const fields = form.querySelectorAll("[name]");
  for (const field of fields) {
    if (errors[field.name]) {
      field.classList.add("invalid");
    } else {
      field.classList.remove("invalid");
    }
  }
}

// หาชื่อผู้กำกับจาก id — ถ้าไม่เจอให้แสดงเป็น "ผู้กำกับ #id"
function directorName(id) {
  for (const director of directors) {
    if (director.director_id === id) {
      return director.name;
    }
  }
  return "ผู้กำกับ #" + id;
}

// ---------- Validation (ฝั่ง Frontend) ----------

// ตรวจฟอร์มหนัง (ใช้ทั้งฟอร์มเพิ่มหนังและ dialog แก้ไข)
// ถูกต้อง → คืน { movie, newDirector } / ผิด → แสดง error ใต้ช่องแล้วคืน null
function validateMovieForm(form) {
  const title = form.title.value.trim();
  const directorValue = form.director_id.value;
  const yearText = form.releaseYear.value;
  const year = Number(yearText);
  const errors = {};

  // ชื่อหนัง: ห้ามว่าง และไม่เกิน 200 ตัวอักษร
  if (title === "") {
    errors.title = "กรุณากรอกชื่อหนัง";
  } else if (title.length > 200) {
    errors.title = "ชื่อหนังต้องไม่เกิน 200 ตัวอักษร";
  }

  // ผู้กำกับ: ต้องเลือก
  if (directorValue === "") {
    errors.director_id = "กรุณาเลือกผู้กำกับ";
  }

  // เลือก "+ เพิ่มผู้กำกับใหม่..." → ตรวจช่องชื่อ/สัญชาติแทน (ยังไม่มี director_id จนกว่าจะสร้างเสร็จ)
  const isNewDirector = directorValue === NEW_DIRECTOR;
  let newDirector = null;
  if (isNewDirector) {
    newDirector = validateNewDirector(form, errors);
  }

  // ปีที่ฉาย: ห้ามว่าง และต้องเป็นจำนวนเต็มระหว่าง 1888 ถึง MAX_YEAR
  if (yearText === "") {
    errors.releaseYear = "กรุณากรอกปีที่ฉาย";
  } else if (!Number.isInteger(year) || year < 1888 || year > MAX_YEAR) {
    errors.releaseYear = `ปีที่ฉายต้องเป็นจำนวนเต็มระหว่าง 1888-${MAX_YEAR}`;
  }

  showFieldErrors(form, errors);

  // มี error อย่างน้อย 1 ช่อง → ไม่ผ่าน
  if (Object.keys(errors).length > 0) {
    return null;
  }

  // director_id เป็น null เมื่อเป็นผู้กำกับใหม่ — resolveDirectorId() จะเติมให้หลังสร้างผู้กำกับแล้ว
  let directorId = null;
  if (!isNewDirector) {
    directorId = Number(directorValue);
  }

  const movie = {
    title: title,
    director_id: directorId,
    releaseYear: year,
  };

  return { movie: movie, newDirector: newDirector };
}

// ตรวจช่องผู้กำกับใหม่ (กฎเดียวกับ validateDirector() ใน src/index.js) — เขียน error ลงใน errors ที่ส่งมา
// คืน { name, nationality } สำหรับส่งให้ POST /directors
function validateNewDirector(form, errors) {
  const name = form.new_director_name.value.trim();
  const nationality = form.new_director_nationality.value.trim();

  // เช็กว่าชื่อซ้ำกับผู้กำกับที่มีอยู่แล้วไหม (ไม่สนตัวพิมพ์เล็ก/ใหญ่)
  let isDuplicate = false;
  for (const director of directors) {
    if (director.name.toLowerCase() === name.toLowerCase()) {
      isDuplicate = true;
    }
  }

  if (name === "") {
    errors.new_director_name = "กรุณากรอกชื่อผู้กำกับ";
  } else if (name.length > 150) {
    errors.new_director_name = "ชื่อผู้กำกับต้องไม่เกิน 150 ตัวอักษร";
  } else if (isDuplicate) {
    // ชื่อซ้ำ → ให้เลือกจาก dropdown แทน (Backend ก็ตอบ 409 ให้เหมือนกัน)
    errors.new_director_name = `มีผู้กำกับ "${name}" อยู่แล้ว เลือกจากรายการได้เลย`;
  }

  if (nationality.length > 100) {
    errors.new_director_nationality = "สัญชาติต้องไม่เกิน 100 ตัวอักษร";
  }

  // สัญชาติไม่บังคับ — ถ้าเว้นว่างให้ส่ง null
  let nationalityValue = null;
  if (nationality !== "") {
    nationalityValue = nationality;
  }

  return { name: name, nationality: nationalityValue };
}

// ---------- Health ----------

// เช็กสถานะระบบ แล้วเปลี่ยนสี/ข้อความของป้ายมุมขวาบน
async function checkHealth() {
  const box = document.getElementById("health");
  const text = document.getElementById("health-text");

  try {
    const body = await api("/health");

    if (body.services["review-service"] === "ok") {
      box.className = "health ok"; // จุดสีเขียว
      text.textContent = "ระบบพร้อมใช้งาน";
    } else {
      box.className = "health partial"; // จุดสีเหลือง
      text.textContent = "Review Service ไม่พร้อมใช้งาน";
    }
  } catch (err) {
    box.className = "health down"; // จุดสีแดง
    text.textContent = "เชื่อมต่อ API ไม่ได้";
  }
}

// ---------- Directors (GET /directors) ----------

// สร้าง <option> หนึ่งอันสำหรับ dropdown
function createOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

// เติม dropdown ผู้กำกับทุกอัน (ฟอร์มเพิ่มหนัง + dialog แก้ไข) และต่อท้ายด้วยตัวเลือก "+ เพิ่มผู้กำกับใหม่..."
// ถูกเรียกตอนโหลดหน้า และหลังสร้างผู้กำกับใหม่สำเร็จ (resolveDirectorId()) — ค่าที่เลือกไว้เดิมจะถูกคงไว้
async function loadDirectors() {
  const selects = document.querySelectorAll("select[name=director_id]");

  try {
    const body = await api("/directors");
    directors = body.data;

    for (const select of selects) {
      // จำค่าที่เลือกไว้ก่อน เพราะกำลังจะล้างตัวเลือกทิ้ง
      const selected = select.value;

      // ล้างตัวเลือกเดิม แล้วเติมใหม่
      select.innerHTML = "";
      select.appendChild(createOption("", "-- เลือกผู้กำกับ --"));
      for (const director of directors) {
        select.appendChild(createOption(director.director_id, director.name));
      }
      select.appendChild(createOption(NEW_DIRECTOR, "+ เพิ่มผู้กำกับใหม่..."));

      // เลือกค่าเดิมกลับคืน
      select.value = selected;
      // ค่าเดิมไม่มีในรายการใหม่แล้ว → value กลายเป็น "" ให้เลือกตัวแรก (-- เลือกผู้กำกับ --)
      if (select.value === "") {
        select.selectedIndex = 0;
      }
    }
  } catch (err) {
    for (const select of selects) {
      select.innerHTML = "";
      select.appendChild(createOption("", "โหลดรายชื่อไม่สำเร็จ"));
    }
    toast("โหลดรายชื่อผู้กำกับไม่สำเร็จ: " + err.message, "error");
  }
}

// ---------- New director (POST /directors) ----------
// ตัวเลือก [+ เพิ่มผู้กำกับใหม่...] ใน dropdown — Backend: src/index.js app.post("/api/v1/directors")

// แสดง/ซ่อนกล่องกรอกผู้กำกับใหม่ของฟอร์มนั้นๆ ตามค่าที่เลือกใน dropdown (ยังไม่เรียก API)
// ถูกเรียกเมื่อ dropdown เปลี่ยน (ส่วน Init), หลัง form.reset(), ใน openEdit() และหลังสร้างผู้กำกับสำเร็จ
function toggleNewDirector(form) {
  const box = form.querySelector(".new-director");

  if (form.director_id.value === NEW_DIRECTOR) {
    // แสดงกล่อง แล้วเลื่อนเคอร์เซอร์ไปที่ช่องชื่อ
    box.hidden = false;
    form.new_director_name.focus();
  } else {
    box.hidden = true;

    // ซ่อนแล้วล้างค่าและ error ที่ค้างอยู่ ไม่ให้ติดไปตอนเปิดใหม่
    form.new_director_name.value = "";
    form.new_director_nationality.value = "";

    form.new_director_name.classList.remove("invalid");
    form.new_director_nationality.classList.remove("invalid");

    form.querySelector(".field-error[data-for=new_director_name]").textContent = "";
    form.querySelector(".field-error[data-for=new_director_nationality]").textContent = "";
  }
}

// POST /directors → คืนข้อมูลผู้กำกับที่สร้างแล้ว { director_id, name, nationality }
async function createDirector(newDirector) {
  const body = await api("/directors", {
    method: "POST",
    body: JSON.stringify({
      name: newDirector.name,
      nationality: newDirector.nationality,
    }),
  });
  return body.data;
}

// หา director_id ที่จะใช้บันทึกหนัง:
//   - เลือกผู้กำกับที่มีอยู่แล้ว → ใช้ id นั้นเลย
//   - เลือก "+ เพิ่มผู้กำกับใหม่..." → สร้างผู้กำกับก่อน (POST /directors) แล้วโหลด dropdown ใหม่
//     และเลือกผู้กำกับคนใหม่ไว้ใน dropdown ให้เลย — ถ้าบันทึกหนังต่อไม่สำเร็จ กดซ้ำได้โดยไม่สร้างผู้กำกับซ้ำ
async function resolveDirectorId(form, newDirector, status) {
  // กรณีเลือกผู้กำกับที่มีอยู่แล้ว
  if (newDirector === null) {
    return Number(form.director_id.value);
  }

  // กรณีผู้กำกับใหม่
  setStatus(status, "loading", `กำลังเพิ่มผู้กำกับ "${newDirector.name}"...`);
  const created = await createDirector(newDirector);

  await loadDirectors(); // โหลด dropdown ใหม่ให้มีชื่อผู้กำกับคนใหม่
  form.director_id.value = created.director_id; // เลือกคนใหม่ไว้ให้
  toggleNewDirector(form); // ซ่อนกล่องกรอกผู้กำกับใหม่

  toast(`เพิ่มผู้กำกับ "${created.name}" สำเร็จ`);
  return created.director_id;
}

// ---------- Movies (GET /movies) ----------

async function loadMovies() {
  // หา element จาก id
  const status = document.getElementById("list-status");
  const reloadBtn = document.getElementById("reload");

  // แสดงข้อความ "กำลังโหลด"
  setStatus(status, "loading", "กำลังโหลดรายการหนัง...");

  // ปิดปุ่มโหลดใหม่ระหว่างรอ
  reloadBtn.disabled = true;

  try {
    const body = await api("/movies");
    movies = body.data;
    setStatus(status); // โหลดสำเร็จ → ล้างข้อความสถานะ
    renderMovies();
  } catch (err) {
    movies = [];
    renderMovies();
    document.getElementById("movie-grid").innerHTML = "";
    setStatus(status, "error", "โหลดรายการหนังไม่สำเร็จ: " + err.message);
  } finally {
    // ไม่ว่าสำเร็จหรือไม่ ให้เปิดปุ่มกลับมา
    reloadBtn.disabled = false;
  }
}

// สร้างปุ่มเล็กบนการ์ด (onClick คือฟังก์ชันที่จะทำงานเมื่อกด)
function createButton(text, className, onClick) {
  const button = document.createElement("button");
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

// สร้างการ์ดหนัง 1 ใบ: รหัสหนัง / ชื่อ / ผู้กำกับ · ปี / ปุ่ม [รีวิว] [แก้ไข] [ลบ]
function createMovieCard(movie) {
  const card = document.createElement("article");
  card.className = "card";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = movie.movie_code;
  card.appendChild(badge);

  const title = document.createElement("h3");
  title.textContent = movie.title;
  card.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = directorName(movie.director_id) + " · " + movie.release_year;
  card.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "actions";

  // ปุ่ม [รีวิว] → openReviews() เปิด dialog รีวิว + GET /movies/:id/reviews
  actions.appendChild(
    createButton("รีวิว", "btn small", function () {
      openReviews(movie);
    }),
  );
  // ปุ่ม [แก้ไข] → openEdit() เติมค่าเดิมลงฟอร์มแล้วเปิด dialog (กดบันทึกถึงจะ PUT)
  actions.appendChild(
    createButton("แก้ไข", "btn small", function () {
      openEdit(movie);
    }),
  );
  // ปุ่ม [ลบ] → deleteMovie() → DELETE /movies/:id
  actions.appendChild(
    createButton("ลบ", "btn small danger", function () {
      deleteMovie(movie);
    }),
  );

  card.appendChild(actions);
  return card;
}

// วาดการ์ดหนังทั้งหมดลงในหน้าเว็บ (กรองตามคำในช่อง #filter ด้วย)
function renderMovies() {
  const keyword = document.getElementById("filter").value.trim().toLowerCase();
  const grid = document.getElementById("movie-grid");
  const countText = document.getElementById("movie-count");

  // คัดเฉพาะหนังที่ชื่อมีคำค้นอยู่
  const shown = [];
  for (const movie of movies) {
    if (movie.title.toLowerCase().includes(keyword)) {
      shown.push(movie);
    }
  }

  // แสดงจำนวน เช่น (3/10) — ถ้ายังไม่มีหนังเลยไม่ต้องแสดง
  if (movies.length > 0) {
    countText.textContent = `(${shown.length}/${movies.length})`;
  } else {
    countText.textContent = "";
  }

  // ล้างการ์ดเดิมออกก่อน
  grid.innerHTML = "";

  // ไม่มีหนังให้แสดง → แสดงข้อความแทน
  if (shown.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    if (movies.length > 0) {
      empty.textContent = "ไม่พบหนังที่ตรงกับคำค้น";
    } else {
      empty.textContent = "ยังไม่มีข้อมูลหนัง";
    }
    grid.appendChild(empty);
    return;
  }

  for (const movie of shown) {
    grid.appendChild(createMovieCard(movie));
  }
}

// ---------- Add movie (POST /movies) ----------
// ปุ่ม [เพิ่มหนัง] — Backend: src/index.js app.post("/api/v1/movies")
// ถ้าเลือกผู้กำกับใหม่ จะเรียก POST /api/v1/directors ก่อน (resolveDirectorId())

const addMovieForm = document.getElementById("add-movie-form");

addMovieForm.addEventListener("submit", async function (event) {
  event.preventDefault(); // กันไม่ให้ browser รีโหลดหน้าเอง

  const form = addMovieForm;
  const status = document.getElementById("add-status");

  // 1) ตรวจข้อมูลในฟอร์มก่อน
  const data = validateMovieForm(form);
  if (data === null) {
    setStatus(status, "error", "กรุณาแก้ไขข้อมูลที่ไม่ถูกต้อง");
    return;
  }

  setBusy(form, true);

  try {
    // 2) หา director_id (ถ้าเป็นผู้กำกับใหม่จะสร้างให้ก่อน)
    data.movie.director_id = await resolveDirectorId(form, data.newDirector, status);

    // 3) ส่งข้อมูลหนังไปบันทึก
    setStatus(status, "loading", "กำลังบันทึก...");
    const body = await api("/movies", {
      method: "POST",
      body: JSON.stringify(data.movie),
    });

    // 4) สำเร็จ → แจ้งผล ล้างฟอร์ม แล้วโหลดรายการหนังใหม่
    setStatus(
      status,
      "success",
      `เพิ่ม "${body.data.title}" สำเร็จ (รหัส ${body.data.movieCode})`,
    );
    form.reset();
    toggleNewDirector(form);
    loadMovies();
  } catch (err) {
    setStatus(status, "error", "บันทึกไม่สำเร็จ: " + err.message);
  } finally {
    setBusy(form, false);
  }
});

// ---------- Edit movie (PUT /movies/:id) ----------
// ปุ่ม [แก้ไข] บนการ์ด → openEdit() / ปุ่ม [บันทึก] ใน dialog → submit listener ด้านล่าง
// Backend: src/index.js app.put("/api/v1/movies/:id")

const editMovieForm = document.getElementById("edit-movie-form");

// เติมข้อมูลเดิมของหนังลงในฟอร์ม แล้วเปิด dialog
function openEdit(movie) {
  const form = editMovieForm;
  form.movie_id.value = movie.movie_id;
  form.title.value = movie.title;
  form.director_id.value = movie.director_id;
  form.releaseYear.value = movie.release_year;

  // ซ่อนกล่องผู้กำกับใหม่ที่อาจค้างจากการเปิด dialog ครั้งก่อน
  toggleNewDirector(form);
  // ล้าง error และข้อความสถานะเก่า
  showFieldErrors(form, {});
  setStatus(document.getElementById("edit-status"));

  document.getElementById("edit-dialog").showModal();
}

// ถ้าเลือกผู้กำกับใหม่ใน dialog จะเรียก POST /api/v1/directors ก่อน แล้วค่อย PUT (resolveDirectorId())
editMovieForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const form = editMovieForm;
  const status = document.getElementById("edit-status");

  // 1) ตรวจข้อมูลในฟอร์มก่อน
  const data = validateMovieForm(form);
  if (data === null) {
    return;
  }

  setBusy(form, true);

  try {
    // 2) หา director_id (ถ้าเป็นผู้กำกับใหม่จะสร้างให้ก่อน)
    data.movie.director_id = await resolveDirectorId(form, data.newDirector, status);

    // 3) ส่งข้อมูลที่แก้ไขไปบันทึก
    setStatus(status, "loading", "กำลังบันทึก...");
    await api("/movies/" + form.movie_id.value, {
      method: "PUT",
      body: JSON.stringify(data.movie),
    });

    // 4) สำเร็จ → ปิด dialog แล้วโหลดรายการหนังใหม่
    document.getElementById("edit-dialog").close();
    toast("แก้ไขข้อมูลหนังสำเร็จ");
    loadMovies();
  } catch (err) {
    setStatus(status, "error", "แก้ไขไม่สำเร็จ: " + err.message);
  } finally {
    setBusy(form, false);
  }
});

// ---------- Delete movie (DELETE /movies/:id) ----------
// ปุ่ม [ลบ] บนการ์ด — Backend: src/index.js app.delete("/api/v1/movies/:id")
// (รีวิวของหนังถูกลบตามด้วย ON DELETE CASCADE ใน schema.sql)

async function deleteMovie(movie) {
  // ถามยืนยันก่อน — ถ้ากดยกเลิกก็จบเลย
  const ok = confirm(`ยืนยันการลบ "${movie.title}"?\nรีวิวของหนังเรื่องนี้จะถูกลบไปด้วย`);
  if (!ok) {
    return;
  }

  const status = document.getElementById("list-status");
  setStatus(status, "loading", `กำลังลบ "${movie.title}"...`);

  try {
    await api("/movies/" + movie.movie_id, { method: "DELETE" });
    toast(`ลบ "${movie.title}" สำเร็จ`);
    loadMovies();
  } catch (err) {
    setStatus(status, "error", "ลบไม่สำเร็จ: " + err.message);
  }
}

// ---------- Reviews (Review Service ผ่าน Gateway) ----------
// ปุ่ม [รีวิว] บนการ์ด → openReviews() → loadReviews()
// GET: src/index.js app.get("/api/v1/movies/:id/reviews") → src/review-service/index.js app.get("/reviews")

const reviewForm = document.getElementById("review-form");

// เปิด dialog รีวิวของหนังเรื่องนี้ แล้วโหลดรีวิว
function openReviews(movie) {
  currentReviewMovie = movie; // จำไว้ว่ากำลังดูรีวิวของหนังเรื่องไหน

  document.getElementById("review-title").textContent = "รีวิว: " + movie.title;
  document.getElementById("review-summary").textContent = "";

  // ล้างฟอร์มรีวิวที่อาจค้างจากครั้งก่อน
  reviewForm.reset();
  showFieldErrors(reviewForm, {});
  setStatus(document.getElementById("review-form-status"));

  document.getElementById("review-dialog").showModal();
  loadReviews();
}

// สร้างรายการรีวิว 1 อัน (<li>): ดาว / ความคิดเห็น / เวลา / ปุ่ม [ลบ]
function createReviewItem(review) {
  const item = document.createElement("li");
  const content = document.createElement("div");

  // ดาว เช่น rating 3 → ★★★☆☆
  const rating = document.createElement("span");
  rating.className = "rating";
  rating.textContent = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  content.appendChild(rating);

  // ความคิดเห็น (ไม่บังคับ — แสดงเฉพาะเมื่อมี)
  if (review.comment) {
    const comment = document.createElement("p");
    comment.textContent = review.comment;
    content.appendChild(comment);
  }

  // เวลาที่รีวิว แสดงแบบไทย
  const time = document.createElement("time");
  time.textContent = new Date(review.created_at).toLocaleString("th-TH");
  content.appendChild(time);

  item.appendChild(content);

  // ปุ่ม [ลบ] ของรีวิวแต่ละอัน → deleteReview() → DELETE /reviews/:reviewId
  item.appendChild(
    createButton("ลบ", "btn small danger", function () {
      deleteReview(review);
    }),
  );

  return item;
}

// โหลดรีวิวของหนังที่เปิดอยู่ (currentReviewMovie) แล้วแสดงในรายการ
async function loadReviews() {
  const movie = currentReviewMovie;
  const status = document.getElementById("review-status");
  const list = document.getElementById("review-list");
  const summary = document.getElementById("review-summary");

  setStatus(status, "loading", "กำลังโหลดรีวิว...");
  list.innerHTML = "";

  try {
    const body = await api("/movies/" + movie.movie_id + "/reviews");
    setStatus(status);

    // สรุปคะแนน (count = จำนวนรีวิว, average = คะแนนเฉลี่ย)
    const count = body.summary.count;
    const average = body.summary.average;
    if (count > 0) {
      summary.textContent = `คะแนนเฉลี่ย ${average} / 5 จาก ${count} รีวิว`;
    } else {
      summary.textContent = "ยังไม่มีรีวิว เป็นคนแรกที่รีวิวเรื่องนี้";
    }

    for (const review of body.data) {
      list.appendChild(createReviewItem(review));
    }
  } catch (err) {
    summary.textContent = "";
    setStatus(status, "error", "โหลดรีวิวไม่สำเร็จ: " + err.message);
  }
}

// ปุ่ม [ส่งรีวิว] → POST /movies/:id/reviews
// Gateway: src/index.js app.post("/api/v1/movies/:id/reviews") → Service: src/review-service/index.js app.post("/reviews")
reviewForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const form = reviewForm;
  const status = document.getElementById("review-form-status");
  const rating = Number(form.rating.value);
  const comment = form.comment.value.trim();
  const errors = {};

  // 1) ตรวจข้อมูล: ต้องเลือกดาว และความคิดเห็นไม่เกิน 500 ตัวอักษร
  if (!rating) {
    errors.rating = "กรุณาเลือกคะแนน 1-5 ดาว";
  }
  if (comment.length > 500) {
    errors.comment = "ความคิดเห็นต้องไม่เกิน 500 ตัวอักษร";
  }
  showFieldErrors(form, errors);
  if (Object.keys(errors).length > 0) {
    return;
  }

  setStatus(status, "loading", "กำลังส่งรีวิว...");
  setBusy(form, true);

  // ความคิดเห็นไม่บังคับ — ถ้าเว้นว่างให้ส่ง null
  let commentValue = null;
  if (comment !== "") {
    commentValue = comment;
  }

  try {
    // 2) ส่งรีวิวไปบันทึก
    await api("/movies/" + currentReviewMovie.movie_id + "/reviews", {
      method: "POST",
      body: JSON.stringify({ rating: rating, comment: commentValue }),
    });

    // 3) สำเร็จ → ล้างฟอร์ม แล้วโหลดรีวิวใหม่
    setStatus(status, "success", "ส่งรีวิวสำเร็จ ขอบคุณสำหรับความคิดเห็น");
    form.reset();
    loadReviews();
  } catch (err) {
    setStatus(status, "error", "ส่งรีวิวไม่สำเร็จ: " + err.message);
  } finally {
    setBusy(form, false);
  }
});

// Gateway: src/index.js app.delete("/api/v1/reviews/:reviewId") → Service: src/review-service/index.js app.delete("/reviews/:id")
async function deleteReview(review) {
  if (!confirm("ยืนยันการลบรีวิวนี้?")) {
    return;
  }

  try {
    await api("/reviews/" + review.review_id, { method: "DELETE" });
    toast("ลบรีวิวสำเร็จ");
    loadReviews();
  } catch (err) {
    toast("ลบรีวิวไม่สำเร็จ: " + err.message, "error");
  }
}

// ---------- External search (GET /external/movies) ----------
// ปุ่ม [ค้นหา] — Backend: src/index.js app.get("/api/v1/external/movies") → src/services/external-api.js

const externalForm = document.getElementById("external-form");

externalForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const form = externalForm;
  const term = form.term.value.trim();
  const status = document.getElementById("external-status");
  const list = document.getElementById("external-list");
  const errorText = document.getElementById("external-error");

  // 1) ตรวจว่าพิมพ์คำค้นแล้วหรือยัง
  if (term === "") {
    errorText.textContent = "กรุณาพิมพ์คำค้น";
    form.term.classList.add("invalid");
    return;
  }
  errorText.textContent = "";
  form.term.classList.remove("invalid");

  list.innerHTML = "";
  setStatus(status, "loading", "กำลังค้นหาจาก iTunes (อาจใช้เวลาหลายวินาทีถ้าบริการช้า)...");
  setBusy(form, true);

  try {
    // 2) ค้นหา — encodeURIComponent แปลงช่องว่าง/อักขระพิเศษให้ใส่ใน URL ได้
    const body = await api("/external/movies?term=" + encodeURIComponent(term));

    if (body.data.length === 0) {
      setStatus(status, "info", `ไม่พบหนังที่ตรงกับ "${term}"`);
      return;
    }
    setStatus(status);

    // 3) แสดงผลลัพธ์: ชื่อหนัง / ผู้กำกับ · ปี
    for (const result of body.data) {
      const item = document.createElement("li");

      const title = document.createElement("strong");
      title.textContent = result.title;
      item.appendChild(title);

      let director = "-";
      if (result.director) {
        director = result.director;
      }
      let year = "-";
      if (result.releaseDate) {
        year = new Date(result.releaseDate).getFullYear();
      }

      const detail = document.createElement("span");
      detail.textContent = director + " · " + year;
      item.appendChild(detail);

      list.appendChild(item);
    }
  } catch (err) {
    setStatus(status, "error", err.message);
  } finally {
    setBusy(form, false);
  }
});

// ---------- Init ----------

// ปุ่ม [ยกเลิก] (dialog แก้ไข) และ [✕] (dialog รีวิว) — ปิด dialog เฉยๆ ไม่เรียก API
const closeButtons = document.querySelectorAll("dialog [data-close]");
for (const button of closeButtons) {
  button.addEventListener("click", function () {
    button.closest("dialog").close();
  });
}

// dropdown ผู้กำกับ (ทั้งฟอร์มเพิ่มหนังและ dialog แก้ไข) → เลือก "+ เพิ่มผู้กำกับใหม่..." แล้วแสดงช่องกรอก (ไม่เรียก API)
const directorSelects = document.querySelectorAll("select[name=director_id]");
for (const select of directorSelects) {
  select.addEventListener("change", function () {
    toggleNewDirector(select.form);
  });
}

// ช่องกรองชื่อหนัง → กรองข้อมูลที่โหลดมาแล้วใน browser (ไม่เรียก API)
document.getElementById("filter").addEventListener("input", renderMovies);

// ปุ่ม [โหลดใหม่] → GET /movies อีกรอบ
document.getElementById("reload").addEventListener("click", loadMovies);

// เริ่มทำงานตอนเปิดหน้าเว็บ: เช็กระบบ → โหลดผู้กำกับ → แล้วค่อยโหลดหนัง
// (ต้องโหลดผู้กำกับก่อน เพราะการ์ดหนังต้องใช้ชื่อผู้กำกับ)
async function init() {
  checkHealth();
  await loadDirectors();
  await loadMovies();
}

init();
