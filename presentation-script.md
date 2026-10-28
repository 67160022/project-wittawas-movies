# บทพูดนำเสนอ Project Defense — Movies API

> เวลารวม 5-7 นาที: **Demo สด 3-4 นาที** + **ตอบคำถาม 2-3 นาที**
> หลัก: **ทำให้ดูจริง ไม่ใช้สไลด์อธิบายแทน** พูดไปพร้อมกับกดหน้าจอ

---

## 0. เตรียมก่อนถึงคิว (ทำก่อนเข้าห้อง)

เปิด **3 terminal** ไว้ล่วงหน้า:

```bashฟ
# Terminal 1 — Review Service (ตัวที่จะปิดโชว์ตอน demo)
npm run start:reviews

# Terminal 2 — Movies API / Gateway
npm run start:movies

# Terminal 3 — สำรองไว้รัน npm test ถ้าผู้สอนขอดู
```

เช็กลิสต์:

- [ ] MySQL ใน Docker เปิดอยู่ (`docker ps` เห็น `mysql-student-api`)
- [ ] เปิด http://localhost:3000/ แล้ว มุมขวาบนเป็น **จุดเขียว "ระบบพร้อมใช้งาน"**
- [ ] ยังไม่มีหนังชื่อ **Tenet** ในระบบ (ถ้ามีจากการซ้อม ให้ลบก่อน)
- [ ] เปิด VS Code ค้างไว้ที่ไฟล์ `src/services/review-client.js` (ใช้ตอนอธิบายโค้ด)
- [ ] ลองค้น iTunes 1 ครั้งให้แน่ใจว่าอินเทอร์เน็ตใช้ได้
- [ ] ขยายฟอนต์เบราว์เซอร์ (Cmd +) ให้คนดูด้านหลังอ่านออก

---

## 1. Demo สด (3-4 นาที)

**Use case หลัก:** _ผู้ดูแลระบบเพิ่มหนังใหม่ → แก้ไข → ผู้ใช้รีวิวหนัง → ลบ_ โดยมีจุดเด่นคือ **ถ้า Review Service ล่ม ระบบส่วนอื่นยังใช้งานได้**

### ① เปิดตัว (~20 วินาที)

**ทำ:** อยู่ที่หน้า http://localhost:3000/

**พูด:**

> "สวัสดีครับ โปรเจกต์ผมคือ **Movies API** ระบบจัดการข้อมูลหนังกับรีวิวครับ
> ระบบแบ่งเป็น 2 service ครับ ตัวแรกคือ **Movies API ที่ port 3000** ทำหน้าที่เป็น Gateway ดูแลข้อมูลหนังและเสิร์ฟหน้าเว็บนี้
> ตัวที่สองคือ **Review Service ที่ port 3001** เป็น microservice ที่แยกออกมาดูแลรีวิวโดยเฉพาะ
> หน้าเว็บนี้เป็น HTML, CSS, JavaScript ล้วน ที่เรียก API จริงทั้งหมดครับ
> มุมขวาบนเป็นตัวบอกสถานะ ตอนนี้เขียวแปลว่าทั้ง 2 service ทำงานปกติ"

### ② Validation ฝั่ง Frontend (~30 วินาที)

**ทำ:**

1. กด **"เพิ่มหนัง"** โดยไม่กรอกอะไร → error ขึ้นใต้ทุกช่อง
2. กรอกชื่อ `Tenet`, เลือก `Christopher Nolan`, ใส่ปี `1500` → กดเพิ่ม → error เรื่องปี

**พูด:**

> "ก่อนส่งข้อมูลไป API หน้าเว็บจะตรวจเบื้องต้นก่อนครับ ถ้าไม่กรอกจะแจ้งใต้ช่องทันที
> ปีต้องอยู่ระหว่าง 1888 ซึ่งเป็นปีที่มีหนังเรื่องแรกของโลก ถึงปีปัจจุบันบวก 5
> แต่ backend ก็ตรวจซ้ำอีกชั้นนะครับ เพราะคนอาจยิง API ตรงจาก Postman โดยไม่ผ่านหน้าเว็บ"

### ③ POST — เพิ่มหนัง (~20 วินาที)

**ทำ:** แก้ปีเป็น `2020` → กดเพิ่ม → ข้อความสีเขียว "เพิ่ม Tenet สำเร็จ (รหัส TENE2020)" และการ์ดใหม่โผล่

**พูด:**

> "เพิ่มสำเร็จครับ เป็นการเรียก **POST /api/v1/movies**
> ระบบ gen รหัสหนังให้อัตโนมัติจาก 4 ตัวอักษรแรกของชื่อบวกปี ได้ `TENE2020`
> ระหว่างรอ ปุ่มจะถูก disable และขึ้น 'กำลังบันทึก...' ผู้ใช้จะรู้ว่าระบบกำลังทำงานอยู่"

### ④ 409 Conflict — error จาก backend (~15 วินาที)

**ทำ:** กรอก `Tenet` / Nolan / 2020 ซ้ำอีกรอบ → กดเพิ่ม → ข้อความแดง "หนังนี้มีอยู่แล้วในระบบ"

**พูด:**

> "ถ้าเพิ่มชื่อซ้ำ backend จะตอบ **409 Conflict** หน้าเว็บก็ดึงข้อความ error จาก backend มาแสดงให้ผู้ใช้อ่านเข้าใจ ไม่ได้ค้างเงียบ ๆ ครับ"

### ⑤ PUT — แก้ไข (~20 วินาที)

**ทำ:** พิมพ์ `Tenet` ในช่องกรอง → กด **"แก้ไข"** ที่การ์ด → เปลี่ยนปีเป็น `2021` → บันทึก → รหัสเปลี่ยนเป็น `TENE2021`

**พูด:**

> "แก้ไขใช้ **PUT /api/v1/movies/:id** ครับ เปลี่ยนปีแล้วรหัสหนังก็คำนวณใหม่ให้อัตโนมัติ"

### ⑥ Microservice — รีวิว (~40 วินาที)

**ทำ:**

1. ล้างช่องกรอง → กด **"รีวิว"** ที่ **Inception** → เห็นคะแนนเฉลี่ยและรายการรีวิว
2. กดดาว 5 ดวง พิมพ์ "ดูรอบที่สามก็ยังสนุก" → **ส่งรีวิว** → คะแนนเฉลี่ยอัปเดต
3. กด **"ลบ"** ที่รีวิวที่เพิ่งเพิ่ม

**พูด:**

> "ส่วนนี้คือ **microservice** ครับ หน้าเว็บเรียก `/api/v1/movies/1/reviews` ที่ Gateway
> Gateway จะเช็กก่อนว่ามีหนังเรื่องนี้จริงไหม ถ้ามีจึงส่งต่อผ่าน HTTP ไปให้ Review Service ที่ port 3001
> Review Service ตรวจว่าคะแนนเป็นจำนวนเต็ม 1-5 บันทึกลงฐานข้อมูล แล้วคำนวณคะแนนเฉลี่ยส่งกลับมา
> หน้าเว็บไม่ต้องรู้เลยว่าข้างหลังมีกี่ service คุยกับ Gateway ที่เดียวครับ"

### ⑦ ⭐ จุดเด่น — ปิด Review Service (~40 วินาที)

**ทำ:**

1. ไปที่ **Terminal 1** → กด **Ctrl + C** (ปิด Review Service)
2. กลับมาเบราว์เซอร์ → **รีเฟรช** → มุมขวาบนเป็น **สีเหลือง "Review Service ไม่พร้อมใช้งาน"**
3. ชี้ให้ดูว่า **รายการหนังยังโหลดได้ปกติ**
4. กด "รีวิว" ที่หนังเรื่องใดก็ได้ → ข้อความแดง "บริการรีวิวไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง"
5. กลับ Terminal 1 → `npm run start:reviews` → รีเฟรช → กลับมา **เขียว**

**พูด:**

> "จุดสำคัญของการแยก service คือถ้าตัวหนึ่งล่ม ระบบทั้งหมดต้องไม่ล่มตามครับ ผมจะปิด Review Service ให้ดูนะครับ
> (รีเฟรช) ตัวบอกสถานะเปลี่ยนเป็นสีเหลือง แต่รายการหนังยังใช้งานได้ปกติ
> ส่วนรีวิว Gateway ตอบกลับเป็น **503 Service Unavailable** พร้อมข้อความที่ผู้ใช้อ่านเข้าใจ ไม่ใช่หน้าจอค้าง
> (เปิดกลับ) พอเปิด service กลับมา ระบบก็ใช้ได้ตามเดิมทันทีโดยไม่ต้อง restart Gateway ครับ"

### ⑧ External API + DELETE + เอกสาร (~30 วินาที)

**ทำ:**

1. ช่อง "ค้นหาจาก iTunes" พิมพ์ `batman` → ค้นหา → ได้รายการหนัง
2. กรองหา `Tenet` → กด **"ลบ"** → confirm → การ์ดหายไป
3. กดปุ่ม **📘 API Docs** มุมขวาบน → Swagger เปิดในแท็บใหม่

**พูด:**

> "ส่วนนี้มาจาก Phase 2 ครับ เรียก iTunes API ภายนอก มี retry 3 ครั้งและ timeout 5 วินาที
> ลบหนังใช้ **DELETE** มี confirm กันกดพลาด และรีวิวของหนังจะถูกลบตามด้วย foreign key แบบ CASCADE
> สุดท้ายคือเอกสาร API ครับ ทุก endpoint ที่โชว์ไปอยู่ใน Swagger ครบ
> ผมเขียน test ที่เทียบ route ในโค้ดกับเอกสารให้อัตโนมัติ ถ้าเพิ่ม endpoint แล้วลืมเขียนเอกสาร test จะ fail ทันที
> ทั้งระบบมี test 86 ตัว coverage 97 เปอร์เซ็นต์ครับ ขอบคุณครับ"

> ⏱️ **ถ้าเวลาเหลือน้อย** ข้ามข้อ ② และ ④ ได้ แต่ **ห้ามข้ามข้อ ⑥ และ ⑦** เพราะเป็นส่วน microservice ที่เป็นหัวใจของ Phase 3

---

## 2. อธิบายโค้ด (ใช้ตอนผู้สอนขอดูโค้ด หรือตอนตอบคำถาม)

เลือกเปิดตามคำถาม ไม่ต้องเปิดทุกไฟล์

### 2.1 ภาพรวมสถาปัตยกรรม

```
Browser (frontend/)
   │  fetch /api/v1/...
   ▼
Movies API / Gateway :3000  (src/index.js)
   ├── /movies, /directors ──────────────▶ MySQL
   ├── /movies/:id/reviews, /reviews/:id ─▶ Review Service :3001 ──▶ MySQL (ตาราง reviews)
   └── /external/movies ─────────────────▶ iTunes Search API
```

| ไฟล์                            | หน้าที่                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `src/index.js`                  | Gateway + Movies API: CRUD หนัง, ส่งต่อรีวิว, เสิร์ฟหน้าเว็บ + Swagger |
| `src/review-service/index.js`   | Microservice รีวิว แยก process                                         |
| `src/services/review-client.js` | ตัวกลางที่ Gateway ใช้คุยกับ Review Service                            |
| `src/services/external-api.js`  | เรียก iTunes แบบมี retry / timeout / fallback                          |
| `scripts/start-all.js`          | `npm start` เปิด 2 service พร้อมกันเป็น 2 process                      |
| `frontend/app.js`               | logic หน้าเว็บทั้งหมด                                                  |

### 2.2 Gateway ส่งต่อไปยัง Review Service — `src/index.js:344-401`

```js
async function findMovie(movieId) {
  // ① เช็กว่ามีหนังจริงก่อน
  const [rows] = await pool.query("SELECT * FROM movies WHERE movie_id = ?", [
    movieId,
  ]);
  return rows[0];
}

app.post("/api/v1/movies/:id/reviews", async (req, res, next) => {
  const movie = await findMovie(req.params.id);
  if (!movie) return movieNotFound(res); // ② ไม่มีหนัง → 404 เลย ไม่ต้องไปถึง Review Service

  const result = await callReviewService("post", "/reviews", {
    // ③ ส่งต่อผ่าน HTTP
    movie_id: movie.movie_id,
    rating,
    comment,
  });
  res.status(result.status).json(result.body); // ④ ส่ง status และ body ที่ได้กลับไปตรง ๆ
});
```

**พูด:** "Gateway ไม่ได้ INSERT รีวิวเองนะครับ แค่ตรวจว่ามีหนัง แล้วส่งต่อให้ Review Service ซึ่งเป็นเจ้าของข้อมูลรีวิวตัวจริง"

### 2.3 กันระบบล่มตาม — `src/services/review-client.js`

```js
const client = axios.create({
  baseURL: process.env.REVIEW_SERVICE_URL || "http://localhost:3001",
  timeout: 3000, // รอไม่เกิน 3 วินาที
});

async function callReviewService(method, url, data) {
  try {
    const response = await client.request({ method, url, data });
    return { status: response.status, body: response.data };
  } catch (error) {
    if (error.response) {
      // Review Service ตอบมาแต่เป็น 4xx/5xx → ส่งต่อตามนั้น
      return { status: error.response.status, body: error.response.data };
    }
    return {
      status: 503,
      body: {
        error: {
          // ต่อไม่ติด / timeout → 503
          code: "REVIEW_SERVICE_UNAVAILABLE",
          message: "บริการรีวิวไม่พร้อมใช้งาน ...",
        },
      },
    };
  }
}
```

**พูด:** "ฟังก์ชันนี้ไม่ throw error ออกไปเลยครับ คืน `{ status, body }` เสมอ แยก 2 กรณี
กรณีแรก service ตอบกลับมาแต่เป็น error เช่น 400 คะแนนผิด ผมส่งต่อไปตามนั้น
กรณีที่สอง service ไม่ตอบเลย เช่นปิดอยู่หรือค้าง ผมแปลงเป็น 503
มี timeout 3 วินาที Gateway เลยไม่ค้างรอไปเรื่อย ๆ"

### 2.4 Review Service ตรวจข้อมูล + คะแนนเฉลี่ย — `src/review-service/index.js`

```js
// บรรทัด 64 — คะแนนต้องเป็นจำนวนเต็ม 1-5 (กัน "5", 4.5, 0, 6)
if (!Number.isInteger(rating) || rating < 1 || rating > 5) { ... 400 }

// บรรทัด 39 — คะแนนเฉลี่ยทศนิยม 2 ตำแหน่ง ยังไม่มีรีวิวให้เป็น null
const average = rows.length ? Number((total / rows.length).toFixed(2)) : null;

// บรรทัด 101 — movie_id ไม่มีจริง → MySQL โยน FK error → แปลงเป็น 404
if (err.code === "ER_NO_REFERENCED_ROW_2") { ... 404 MOVIE_NOT_FOUND }
```

### 2.5 Validation ฝั่ง backend — `src/index.js:50` `validateMovie()`

```js
function validateMovie({ title, director_id, releaseYear }, partial = false) {
  if (!partial && (!title || !director_id || !releaseYear)) return "กรุณากรอกข้อมูลหนังให้ครบถ้วน";
  if (title != null && (typeof title !== "string" || !title.trim() || title.length > 200)) ...
  if (director_id != null && !(Number.isInteger(director_id) && director_id > 0)) ...
  if (releaseYear != null && !(... >= 1888 && <= MAX_RELEASE_YEAR)) ...
}
```

**พูด:** "ใช้ฟังก์ชันเดียวกันทั้ง POST, PUT และ PATCH ครับ PATCH ส่ง `partial = true` จะตรวจเฉพาะฟิลด์ที่ส่งมา ไม่บังคับให้ส่งครบ"

### 2.6 Retry กับ iTunes — `src/services/external-api.js:42-50`

```js
const retryable = !error.response || status >= 500;   // network error / timeout / 5xx เท่านั้นที่ลองใหม่
if (retryable && attempt < maxAttempts) {
  await wait(500 * 2 ** (attempt - 1));                // รอ 0.5 วิ แล้ว 1 วิ (exponential backoff)
  continue;
}
```

**พูด:** "ไม่ retry 4xx ครับ เพราะ 4xx แปลว่าคำขอเราผิดเอง ลองซ้ำกี่รอบก็ผิดเหมือนเดิม"

### 2.7 Frontend เรียก API — `frontend/app.js:21-40` `api()`

```js
async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers: ... });
  } catch {
    throw new Error("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (backend อาจปิดอยู่)");  // network error
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : null;          // ไม่ parse ถ้าไม่ใช่ JSON
  if (!res.ok) throw new Error(body?.error?.message || `... (${res.status})`); // fetch ไม่ throw 4xx/5xx เอง
  return body;
}
```

**พูด:** "ทุกการเรียก API ผ่านฟังก์ชันนี้ตัวเดียวครับ จัดการ error ครบ 3 แบบ
แบบแรกต่อ server ไม่ได้ แบบที่สอง server ตอบ error ซึ่ง `fetch` ไม่ throw ให้เอง ผมจึงเช็ก `res.ok` เอง แบบที่สาม response ไม่ใช่ JSON
ส่วนการแสดงผล ผมสร้าง element ด้วย `textContent` ไม่ใช้ `innerHTML` เพื่อกัน XSS"

---

## 3. คำถามที่น่าจะถูกถาม + คำตอบ (2-3 นาที)

> ตอบสั้น ตรงประเด็น 2-4 ประโยค ถ้าผู้สอนสนใจต่อค่อยเปิดโค้ดตามหัวข้อ 2

### 🏗️ สถาปัตยกรรม

**Q: ทำไมแยกรีวิวออกเป็น microservice ไม่แยก movies?**

> "รีวิวเป็นส่วนที่ผู้ใช้เขียนบ่อยและข้อมูลโตเร็วที่สุดครับ ส่วนข้อมูลหนังเปลี่ยนไม่บ่อย ถ้าแยกรีวิวออกมาก็ scale เฉพาะส่วนนี้ได้ และถ้ามันล่ม คนยังดูข้อมูลหนังได้ ซึ่งเป็นฟีเจอร์หลักของระบบ"

**Q: ทำไมหน้าเว็บไม่เรียก Review Service ตรง ๆ?**

> "ถ้าเรียกตรง หน้าเว็บต้องรู้ที่อยู่ของทุก service และต้องเปิด CORS ทุกตัวครับ ใช้ Gateway เป็นทางเข้าทางเดียว หน้าเว็บรู้จักแค่ `/api/v1` ถ้าวันหลังย้ายหรือเพิ่ม service ก็ไม่ต้องแก้หน้าเว็บ และ Gateway ตรวจว่ามีหนังให้ก่อนได้ด้วย"

**Q: 2 service ใช้ฐานข้อมูลเดียวกัน แบบนี้เป็น microservice จริงไหม?**

> "ยอมรับว่าตามหลักที่ดีควรเป็น database-per-service ครับ แต่ผมเลือกใช้ MySQL ตัวเดียวเพื่อให้ติดตั้งและรันง่ายในขอบเขตงานนี้ และได้ foreign key กับ CASCADE ด้วย
> ผมตั้งกติกาไว้ว่า **เฉพาะ Review Service เท่านั้นที่อ่าน/เขียนตาราง reviews** Gateway ไม่แตะตารางนี้เลย
> ถ้าจะแยกฐานข้อมูลจริง ต้องเปลี่ยน CASCADE เป็นให้ Gateway ส่ง event ไปบอก Review Service ว่าหนังถูกลบแล้ว ให้มันลบรีวิวเอง"

**Q: 2 service คุยกันยังไง?**

> "คุยกันผ่าน HTTP/REST ด้วย axios ครับ อยู่ในไฟล์ `review-client.js` ตั้ง timeout 3 วินาที ถ้าไม่ตอบจะคืน 503 แทนที่จะค้าง"

### ⚙️ การตัดสินใจทางเทคนิค

**Q: ทำไม Review Service ไม่มี retry เหมือน iTunes?**

> "iTunes เป็นบริการภายนอกบนอินเทอร์เน็ต มีโอกาสผิดพลาดชั่วคราว retry จึงคุ้มครับ แต่ Review Service อยู่ในระบบเราเอง ถ้าต่อไม่ติดแปลว่าล่มจริง retry มีแต่จะทำให้ผู้ใช้รอนานขึ้น ผมเลยให้ตอบ 503 ทันทีดีกว่า"

**Q: ทำไมต้องตรวจข้อมูล 2 ที่ ทั้ง frontend และ backend?**

> "frontend ตรวจเพื่อ UX ครับ ผู้ใช้รู้ทันทีว่ากรอกผิดตรงไหน แต่ frontend ข้ามได้ เช่นยิงจาก Postman ตรง ๆ backend จึงต้องตรวจเสมอเพื่อความถูกต้องของข้อมูล"

**Q: movieCode สร้างยังไง ถ้าชื่อขึ้นต้นเหมือนกันจะชนไหม?**

> "เอา 4 ตัวอักษรแรกของชื่อ ตัดช่องว่าง ทำเป็นตัวพิมพ์ใหญ่ แล้วต่อด้วยปีครับ เช่น Tenet 2020 ได้ `TENE2020`
> ชนได้จริงครับ เช่นหนัง 2 เรื่องที่ขึ้นต้นด้วย 'Star' ในปีเดียวกัน คอลัมน์นี้เป็น UNIQUE ระบบจะตอบ 409
> ถ้าพัฒนาต่อจะเติมเลขลำดับต่อท้ายเมื่อชนครับ"

**Q: PUT กับ PATCH ต่างกันยังไง?**

> "PUT แทนที่ทั้งรายการ ต้องส่งครบทุกฟิลด์ ส่วน PATCH ส่งเฉพาะฟิลด์ที่จะแก้ ฟิลด์ที่ไม่ส่งจะใช้ค่าเดิมจากฐานข้อมูลครับ"

**Q: test ทำยังไง ทำไม mock ฐานข้อมูล?**

> "ใช้ Jest กับ Supertest ครับ mock ตัว `db.js` กับ axios ไว้ test เลยรันได้ทุกเครื่อง ไม่ต้องเปิด MySQL ใช้เวลาประมาณ 4 วินาที และจำลองกรณียาก ๆ ได้ เช่น database error หรือ service ล่ม
> ส่วนการทดสอบกับฐานข้อมูลจริง ผมใช้ Postman collection จาก Phase 2 รันด้วย newman ผ่านครบ 18 assertions"

**Q: Swagger ตรงกับโค้ดจริงแน่ใจได้ยังไง?**

> "ผมเขียน test `openapi-sync.test.js` ครับ มันอ่าน route ทั้งหมดที่ลงทะเบียนใน Express แล้วเทียบกับ path ใน `openapi.yaml` ทั้งสองทาง ถ้ามี endpoint ในโค้ดแต่ไม่มีในเอกสาร หรือกลับกัน test จะ fail"

### 🐛 ปัญหาที่พบระหว่างพัฒนา

**Q: เจอปัญหาอะไรบ้าง?** (เล่า 1-2 ข้อพอ)

> **1. iTunes ค้นหนังไม่เจอเลย:** "ตอนแรกใช้ `media=movie` ของ iTunes แต่ช่วงหลังมันคืนผลว่างทุกคำค้น ผมไล่เช็กด้วย curl ตรง ๆ จนรู้ว่าเป็นที่ฝั่ง iTunes ไม่ใช่โค้ดผม เลยเปลี่ยนเป็นค้นแบบทั่วไป แล้วกรองเฉพาะ `kind === "feature-movie"` เองในโค้ด"

> **2. หน้าเว็บได้ 404 ตอนเปิดด้วย Live Server:** "เปิดผ่าน Live Server ซึ่งเป็น port 5500 แต่โค้ดเรียก `/api/v1` แบบ path สัมพัทธ์ request เลยไปที่ 5500 แทน 3000 แก้โดยให้เช็ก port ถ้าไม่ใช่ 3000 ให้ใช้ URL เต็มของ backend และเปิด CORS ไว้"

> **3. ส่ง JSON ผิดรูปแบบแล้วได้ 500:** "ปัญหานี้บันทึกไว้ในเอกสาร Phase 2 ครับ ผมแก้ใน error handler ให้แยกกรณี `entity.parse.failed` ออกมาตอบ 400 `INVALID_JSON` ซึ่งถูกต้องกว่า เพราะเป็นความผิดของ client"

> **4. Gateway ค้างตอน Review Service ล่ม:** "ช่วงแรกถ้า Review Service ปิด request จะ error เป็น 500 ผมเลยเขียน `review-client.js` ให้มี timeout และแปลง connection error เป็น 503"

### 🔮 คำถามต่อยอด

**Q: ถ้าจะพัฒนาต่อจะทำอะไร?**

> "มี 3 อย่างครับ อย่างแรกเพิ่ม JWT ให้เฉพาะ admin เพิ่ม แก้ หรือลบหนังได้ อย่างที่สองแยกฐานข้อมูลของ Review Service แล้วใช้ event แทน CASCADE อย่างที่สามทำ docker-compose ให้รันทั้งระบบได้ด้วยคำสั่งเดียว"

**Q: ทำไมไม่มี login?**

> "ใน requirement ตั้งแต่ Phase 1 ไม่ได้กำหนดเรื่องการยืนยันตัวตนไว้ครับ ผมเลยโฟกัสที่การแยก service กับการจัดการความล้มเหลวก่อน JWT เป็นสิ่งแรกที่จะเพิ่มถ้าพัฒนาต่อครับ"

**Q: ถ้าไม่รู้คำตอบ?**

> "ข้อนี้ผมยังไม่ได้ลองครับ แต่คิดว่าน่าจะ ... (เดาอย่างมีเหตุผล)" — **ตอบตรง ๆ ดีกว่าเดามั่ว**

---

## 4. แผนสำรองถ้า Demo มีปัญหา

| อาการ                                   | ทำอะไร                                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| หน้าเว็บขึ้น "เชื่อมต่อ API ไม่ได้"     | ดู Terminal 2 ว่า Movies API ยังรันอยู่ไหม → `npm run start:movies`                                                |
| รายการหนังโหลดไม่ขึ้น / error ฐานข้อมูล | MySQL ไม่ได้เปิด → `docker start mysql-student-api` แล้ว `npm run db:init`                                         |
| เพิ่ม Tenet แล้วได้ 409 ตั้งแต่ครั้งแรก | มี Tenet ค้างจากตอนซ้อม → ใช้ชื่ออื่นแทน เช่น `Inception 2` หรือลบ Tenet ก่อน (และถือโอกาสโชว์ 409 ไปเลย)          |
| iTunes ค้นไม่เจอ / ช้า                  | อินเทอร์เน็ตมีปัญหา → **ใช้เป็นจังหวะโชว์ fallback** ได้เลย: "รอครบ 3 ครั้งแล้วระบบตอบ 503 พร้อมข้อความ ไม่ crash" |
| port 3000 ถูกใช้อยู่                    | `lsof -ti:3000 \| xargs kill` แล้วรันใหม่                                                                          |

> 💡 ปัญหาที่เกิดสด ๆ ถ้าอธิบายได้ว่าเกิดจากอะไรและระบบรับมือยังไง **จะได้คะแนนเรื่องความเข้าใจระบบมากกว่า demo ที่ราบรื่นแต่อธิบายไม่ได้**
