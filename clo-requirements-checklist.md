# CLO Requirements Checklist — Movies API (Phase 3)

ตารางตรวจสอบว่าระบบครอบคลุมข้อกำหนดของ CLO6, CLO7, CLO8 ครบถ้วน พร้อมหลักฐานอ้างอิง (ไฟล์ / บรรทัด / คำสั่งที่รันซ้ำได้)

**วิธีเปิดระบบเพื่อตรวจ:**

```bash
npm install
npm run db:init   # สร้างฐานข้อมูล movies_api + ข้อมูลตัวอย่าง (ถ้ายังไม่มี)
npm start         # เปิด Movies API (:3000) + Review Service (:3001)
# Frontend:  http://localhost:3000/
# Swagger:   http://localhost:3000/api-docs
```

สถานะ: ✅ ครบ · ⚠️ ครบแต่มีข้อจำกัด

---

## CLO8 — Final Integration (Full Stack Sync)

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | :---: | --- |
| 8.1 | รวมโมดูลจาก Phase 1 (DB/Requirement) | ✅ | `schema.sql`, `seed.sql` (3 ตาราง directors / movies / reviews + FK), `requirement.md`, `URI-SCHEMA.md`, `src/db.js` |
| 8.2 | รวมโมดูลจาก Phase 2 (Docs/DX & Integration กับ API ภายนอก) | ✅ | `src/services/external-api.js` (retry 3 ครั้ง, timeout 5s, fallback 503), `src/index.js:426` route `/api/v1/external/movies`, Swagger UI `src/index.js:22` |
| 8.3 | รวมโมดูล Microservices (สัปดาห์ที่ 13) | ✅ | **Review Service** แยก process ที่ port 3001: `src/review-service/index.js` (GET `/reviews` บรรทัด 20, POST บรรทัด 52, DELETE บรรทัด 115) · Gateway เรียกผ่าน HTTP: `src/services/review-client.js` · route ฝั่ง Gateway `src/index.js:353`, `:369`, `:387` |
| 8.4 | Service ล่มแล้วระบบไม่ล่มตาม (fault isolation) | ✅ | `src/services/review-client.js:14-29` คืน 503 `REVIEW_SERVICE_UNAVAILABLE` (timeout 3s) · `/api/v1/health` รายงานสถานะ `src/index.js:28` · test `tests/services.test.js:31` |
| 8.5 | รันได้จริงด้วยคำสั่งเดียว ไม่มี conflict / error | ✅ | `scripts/start-all.js` (`npm start`) เปิด 2 service แยก process · `git grep -n "<<<<<<<\|>>>>>>>"` ไม่พบ merge conflict marker · test 86/86 ผ่าน |
| 8.6 | ไม่ทำให้ของเดิมพัง (regression) | ✅ | Postman collection Phase 2: `npx newman run postman_collection.json -e environment.json --env-var baseUrl=http://localhost:3000/api/v1` → 9 requests / 18 assertions / **0 failed** |
| 8.7 | OpenAPI ตรงกับโค้ดจริงทั้งหมด (Swagger/Code Match) | ✅ | `openapi.yaml` v3.0.0 — 12 operations ของ Gateway + 4 operations ของ Review Service · **ตรวจอัตโนมัติ** `tests/openapi-sync.test.js:32-38` เทียบ route ที่ลงทะเบียนใน Express กับ path ในเอกสารทั้งสองทาง และ `:40` ตรวจ `$ref` ทุกตัว |
| 8.8 | เอกสารรวม endpoint ใหม่จาก Microservices | ✅ | `openapi.yaml` path `/api/v1/movies/{id}/reviews` (GET/POST), `/api/v1/reviews/{reviewId}` (DELETE), `/health`, `/reviews`, `/reviews/{id}` (กำหนด `servers: localhost:3001`), response `ReviewServiceUnavailable` (503) |
| 8.9 | Test Coverage Baseline | ✅ | `coverage-report.md` — Lines 97.07%, Branches 95.45%, 86 tests · รันซ้ำ: `npm run test:coverage` |
| 8.10 | ระบุจุดที่ยังไม่มี test ครอบคลุม | ✅ | `coverage-report.md` หัวข้อ 4 (ระบุไฟล์ / บรรทัด / เหตุผล) |
| 8.11 | Validation ฝั่ง Backend | ✅ | `src/index.js:43` `validateMovie()` (title 1-200, director_id จำนวนเต็มบวก, ปี 1888-ปีปัจจุบัน+5) · `src/review-service/index.js:55-80` (rating 1-5, comment ≤ 500) · JSON ผิดรูปแบบ → 400 `INVALID_JSON` `src/index.js:449` |
| 8.12 | Error response รูปแบบเดียวกันทั้งระบบ | ✅ | `{ error: { code, message } }` ทุก endpoint · schema `Error` ใน `openapi.yaml` · Error handler `src/index.js:447`, `src/review-service/index.js:145` |

## CLO6 — Client-Facing Frontend

| # | ข้อกำหนด | สถานะ | หลักฐาน |
| --- | --- | :---: | --- |
| 6.1 | เรียก API จริงของระบบตนเอง ≥ 3 endpoint | ✅ | `frontend/app.js` เรียกจริง **9 endpoint**: GET `/health` (:111), GET `/directors` (:128), GET `/movies` (:155), POST `/movies` (:226), PUT `/movies/:id` (:261), DELETE `/movies/:id` (:279), GET `/movies/:id/reviews` (:309), POST `/movies/:id/reviews` (:363), DELETE `/reviews/:id` (:380), GET `/external/movies` (:406) |
| 6.2 | มีทั้ง GET และการเปลี่ยนแปลงข้อมูล (POST/PUT/DELETE) | ✅ | POST หนัง / PUT หนัง / DELETE หนัง / POST รีวิว / DELETE รีวิว (ดู 6.1) |
| 6.3 | แก้ปัญหา CORS / origin | ✅ | `src/index.js:25` `express.static("frontend")` (เปิด `http://localhost:3000/` origin เดียวกัน) และ `src/index.js:11` `cors()` สำรองกรณีเปิดไฟล์ตรง ๆ · `frontend/app.js:3` เลือก `API_BASE` อัตโนมัติ |
| 6.4 | แสดงสถานะ loading ทุกครั้งที่เรียก API | ✅ | `setStatus(..., "loading", ...)` พร้อม spinner `frontend/app.js:48` ใช้ที่ :151, :222, :257, :277, :305, :359, :402 · ปุ่มถูก disable ระหว่างรอ `setBusy()` :66 |
| 6.5 | แสดง error ที่ผู้ใช้อ่านเข้าใจ ไม่ค้างเงียบ | ✅ | `api()` `frontend/app.js:17-36` — ตรวจ `res.ok` เอง, ดึง `error.message` จาก backend, จับ network error เป็น "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (backend อาจปิดอยู่)" · แสดงที่ :163, :231, :266, :283, :342, :371, :425 · ตัวบอกสถานะระบบมุมขวาบน :108 |
| 6.6 | DELETE ไม่เรียก `.json()` กับ response ว่าง | ✅ | `frontend/app.js:28-29` parse เฉพาะเมื่อ `content-type` เป็น JSON |
| 6.7 | ออกแบบหน้าจอเหมาะกับผู้ใช้จริง | ✅ | การ์ดหนังแสดงชื่อ / ผู้กำกับ (ชื่อจริง ไม่ใช่ id) / ปี / รหัส · dropdown ผู้กำกับ · ช่องกรองชื่อ · dialog แก้ไข / รีวิว · ดาวให้คะแนน · คะแนนเฉลี่ย · toast · confirm ก่อนลบ · responsive `frontend/style.css:85` · dark mode `:17` |
| 6.8 | แบบฟอร์มรับข้อมูลพร้อมตรวจความถูกต้องก่อนส่ง | ✅ | ฟอร์มเพิ่ม/แก้ไขหนัง `validateMovieForm()` `frontend/app.js:86` (required, ≤200 ตัวอักษร, ปี 1888-ปีปัจจุบัน+5) · ฟอร์มรีวิว :354-355 (ต้องเลือกดาว, comment ≤ 500) · ฟอร์มค้นหา :397 · แสดง error ใต้แต่ละช่อง `showFieldErrors()` :72 |
| 6.9 | `e.preventDefault()` + `Content-Type: application/json` | ✅ | ทุก submit handler (:211, :250, :346, :390) · header ตั้งใน `api()` :22 |
| 6.10 | ป้องกัน XSS จากข้อมูลผู้ใช้ | ✅ | สร้าง DOM ด้วย `textContent` ผ่าน `el()` `frontend/app.js:39` ไม่ใช้ `innerHTML` กับข้อมูลจาก API |
| 6.11 | JWT / Authorization header | ⚠️ | ระบบ Movies API ไม่มี endpoint ที่ต้องยืนยันตัวตน (ตาม `requirement.md` ไม่ได้กำหนด) จึงไม่มีการแนบ token — เป็นข้อเสนอพัฒนาต่อ |

## CLO7 — Project Defense

| # | ข้อกำหนด | สถานะ | หลักฐาน / สิ่งที่เตรียม |
| --- | --- | :---: | --- |
| 7.1 | Demo ระบบสดอย่างน้อย 1 use case หลัก | ✅ | Use case หลัก "จัดการหนังและรีวิว" — ลำดับ demo อยู่ใน `README.md` หัวข้อ "Demo Script" |
| 7.2 | Demo สถานการณ์ล้มเหลวจริง | ✅ | ปิด Review Service (Ctrl+C ที่ `npm run start:reviews`) → หน้าเว็บยังใช้งานส่วนหนังได้ ตัวบอกสถานะเป็นสีเหลือง รีวิวแสดง "บริการรีวิวไม่พร้อมใช้งาน" |
| 7.3 | อธิบายสถาปัตยกรรม | ✅ | แผนภาพและเหตุผลใน `README.md` หัวข้อ "สถาปัตยกรรม" และ "การตัดสินใจทางเทคนิค" |
| 7.4 | อธิบายเหตุผลการตัดสินใจทางเทคนิค | ✅ | `README.md` — เหตุผลที่แยก Review Service, ทำไมใช้ Gateway, ทำไม timeout 3s, ข้อแลกเปลี่ยนของการใช้ฐานข้อมูลร่วม, ทำไม mock DB ใน test |
| 7.5 | เตรียมตอบคำถาม / ปัญหาที่พบระหว่างพัฒนา | ✅ | `README.md` หัวข้อ "ปัญหาที่พบและวิธีแก้" และ "คำถามที่อาจถูกถาม" |
