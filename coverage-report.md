# รายงาน Test Coverage Baseline — Movies API (Phase 3)

## 1. วิธีรัน

```bash
npm install
npm test               # รัน test ทั้งหมด
npm run test:coverage  # รัน test พร้อมรายงาน coverage (HTML อยู่ที่ coverage/index.html)
```

- เครื่องมือ: **Jest 30** + **Supertest 7** (`testEnvironment: node`)
- ขอบเขตที่วัด: `collectCoverageFrom: ["src/**/*.js"]` — โค้ด backend ทั้งหมด รวม Review Service (Microservice)
- Test ทั้งหมด **mock ฐานข้อมูล (`src/db.js`) และ HTTP (`axios`)** จึงรันได้โดยไม่ต้องเปิด MySQL / Review Service / อินเทอร์เน็ต และให้ผลเหมือนเดิมทุกครั้ง

## 2. ผลการรัน (รันจริงเมื่อ 25 ต.ค. 2569)

```
Test Suites: 4 passed, 4 total
Tests:       86 passed, 86 total
```

| Test Suite | จำนวน Test | ทดสอบอะไร |
| --- | ---: | --- |
| `tests/movies.test.js` | 51 | Movies API / Gateway ทุก endpoint: CRUD หนัง, directors, health, รีวิวผ่าน Gateway, external search, error handler |
| `tests/review-service.test.js` | 24 | Review Service (Microservice) แยกอิสระ: GET/POST/DELETE รีวิว, validation, FK error, JSON ผิดรูปแบบ |
| `tests/services.test.js` | 8 | `review-client` (Gateway → Review Service ล่ม → 503) และ `external-api` (retry / ไม่ retry 4xx / fallback) |
| `tests/openapi-sync.test.js` | 3 | ตรวจ Swagger/Code Match อัตโนมัติ — route ใน Express ต้องตรงกับ `openapi.yaml` ทั้งสองทาง และ `$ref` ทุกตัวต้องมีจริง |
| **รวม** | **86** | |

## 3. Coverage

```
--------------------|---------|----------|---------|---------|-------------------
File                | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------------|---------|----------|---------|---------|-------------------
All files           |   97.15 |    95.45 |   93.54 |   97.07 |
 src                |   96.83 |    95.12 |   94.11 |   96.79 |
  db.js             |       0 |      100 |     100 |       0 | 1-13
  index.js          |    98.7 |    95.12 |   94.11 |   98.69 | 469-470
 src/review-service |   96.29 |    96.66 |    87.5 |   96.15 |
  index.js          |   96.29 |    96.66 |    87.5 |   96.15 | 166-167
 src/services       |     100 |       95 |     100 |     100 |
  external-api.js   |     100 |      100 |     100 |     100 |
  review-client.js  |     100 |    83.33 |     100 |     100 | 19
--------------------|---------|----------|---------|---------|-------------------
```

| ตัวชี้วัด | ผล | ครอบคลุม / ทั้งหมด |
| --- | ---: | ---: |
| Statements | **97.15%** | 239 / 246 |
| Branches | **95.45%** | 126 / 132 |
| Functions | **93.54%** | 29 / 31 |
| Lines | **97.07%** | 232 / 239 |

## 4. จุดที่ยังไม่มี test ครอบคลุม

| ไฟล์ / บรรทัด | สิ่งที่ไม่ถูกทดสอบ | เหตุผล / ความเสี่ยง |
| --- | --- | --- |
| `src/db.js` 1-13 | การสร้าง connection pool ของ MySQL | ทุก test mock โมดูลนี้ จึงไม่ถูกรันเลย (0%) — เป็นโค้ด config ล้วน ไม่มี logic ตรวจสอบได้ผ่านการรันระบบจริง (`npm start`) และ Postman collection แทน |
| `src/index.js` 469-470 | `app.listen()` ใน `if (require.main === module)` | test import `app` ไปใช้กับ supertest โดยไม่เปิด port จริง — ความเสี่ยงต่ำ |
| `src/review-service/index.js` 166-167 | `app.listen()` ของ Review Service | เหตุผลเดียวกับด้านบน |
| `src/index.js` 255-256 (PATCH) | กรณี `req.body` เป็น `undefined` (ไม่ส่ง body / ไม่มี `Content-Type: application/json`) | ฝั่ง `?? {}` ยังไม่มี test — ผลลัพธ์คือใช้ค่าเดิมทั้งหมด ไม่ error |
| `src/index.js` 374 (POST review) | กรณี `req.body` เป็น `undefined` | Review Service จะตอบ 400 เพราะไม่มี rating — ยังไม่มี test ยืนยัน |
| `src/services/review-client.js` 19 | log กรณี error ไม่มี `code` (ใช้ `error.message` แทน) | test จำลองเฉพาะ `ECONNREFUSED` ที่มี `code` |

**สิ่งที่ Jest ไม่ได้ครอบคลุม (อยู่นอก `src/`):**

- **Frontend** (`frontend/app.js`) — ไม่มี unit test; ทดสอบด้วยการเปิดเบราว์เซอร์จริงตาม flow: โหลดรายการ → validation ฟอร์ม → เพิ่ม → ชื่อซ้ำ (409) → แก้ไข → รีวิว (เพิ่ม/ลบ) → ค้นหา iTunes → ลบหนัง และกรณี Review Service ปิด / Backend ปิด
- **Integration กับ MySQL จริง** — test ใน Jest ใช้ mock; ใช้ Postman collection จาก Phase 2 ยืนยันกับฐานข้อมูลจริงแทน:
  `npx newman run postman_collection.json -e environment.json --env-var baseUrl=http://localhost:3000/api/v1`
  → **9 requests, 18 assertions, failed 0**
- `scripts/` (start-all, init-db) — สคริปต์ช่วยรัน ไม่มี logic ธุรกิจ

## 5. สรุป

- Coverage ของโค้ด backend อยู่ที่ **97% (lines) / 95% (branches)** ทุก endpoint มี test ทั้งกรณีสำเร็จและกรณี error (400 / 404 / 409 / 500 / 503)
- บรรทัดที่ไม่ครอบคลุมส่วนใหญ่เป็น `app.listen()` และ config ฐานข้อมูล ซึ่งถูกตรวจผ่านการรันระบบจริงแทน
- **สิ่งที่ควรทำต่อ:** เพิ่ม test กรณีไม่ส่ง body ให้ PATCH / POST review, และเพิ่ม integration test กับฐานข้อมูลทดสอบจริง (เช่น MySQL ใน Docker แยก) เพื่อลดการพึ่ง mock
