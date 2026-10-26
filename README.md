# Movies API — Phase 3 (Final Integration)

ระบบจัดการหนัง ผู้กำกับ และรีวิว ประกอบด้วย Movies API (Gateway), Review Service (Microservice) และหน้าเว็บ Frontend ที่เรียก API จริง

## วิธีรัน

ต้องมี Node.js 20+ และ MySQL 8 (ตั้งค่าใน `.env`)

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=...
DB_NAME=movies_api
EXTERNAL_API_URL=https://itunes.apple.com/search
REVIEW_SERVICE_URL=http://localhost:3001
```

```bash
npm install
npm run db:init        # สร้างฐานข้อมูล + ข้อมูลตัวอย่าง 17 เรื่อง (รันซ้ำได้ ไม่ลบข้อมูลเดิม)
npm start              # เปิดทั้ง 2 service พร้อมกัน
```

| สิ่งที่เปิด | URL |
| --- | --- |
| Frontend | http://localhost:3000/ |
| Swagger UI (API Docs) | http://localhost:3000/api-docs — หรือกดปุ่ม "📘 API Docs" มุมขวาบนของหน้าเว็บ |
| Movies API (Gateway) | http://localhost:3000/api/v1 |
| Review Service | http://localhost:3001 |

เปิดแยกทีละ service: `npm run start:movies` และ `npm run start:reviews` (ใช้ตอน demo ปิด Review Service)

ทดสอบ: `npm test` · `npm run test:coverage` (ดู `coverage-report.md`)

## สถาปัตยกรรม

```
                 ┌──────────────────────────────────────────┐
  Browser        │  Movies API / Gateway  (:3000)           │
 ┌──────────┐    │  - express.static → frontend/            │
 │ frontend │───▶│  - /api/v1/movies, /directors  ──────────┼──┐
 │ (fetch)  │    │  - /api/v1/movies/:id/reviews ─┐         │  │
 └──────────┘    │  - /api/v1/reviews/:id ────────┤         │  │
                 │  - /api/v1/external/movies ──┐ │         │  │
                 └──────────────────────────────┼─┼─────────┘  │
                                                │ │ HTTP (axios, timeout 3s)
                         iTunes Search API ◀────┘ ▼            ▼
                         (retry 3, timeout 5s)  ┌─────────────────┐   ┌────────────┐
                                                │ Review Service  │──▶│  MySQL     │
                                                │ (:3001)         │   │ movies_api │
                                                │ /reviews        │   └────────────┘
                                                └─────────────────┘
```

| โฟลเดอร์ / ไฟล์ | หน้าที่ |
| --- | --- |
| `src/index.js` | Movies API + Gateway: CRUD หนัง, ผู้กำกับ, health, ส่งต่อรีวิว, ค้นหา iTunes, เสิร์ฟ Frontend และ Swagger |
| `src/review-service/index.js` | Microservice รีวิว: GET / POST / DELETE รีวิว, คำนวณคะแนนเฉลี่ย |
| `src/services/review-client.js` | HTTP client ที่ Gateway ใช้เรียก Review Service (ล่ม → 503) |
| `src/services/external-api.js` | เรียก iTunes พร้อม retry / timeout / fallback (จาก Phase 2) |
| `frontend/` | หน้าเว็บ HTML/CSS/JavaScript ล้วน |
| `tests/` | Jest + Supertest (86 tests) |
| `openapi.yaml` | เอกสาร API ฉบับล่าสุด (ตรวจตรงกับโค้ดอัตโนมัติด้วย `tests/openapi-sync.test.js`) |

## การตัดสินใจทางเทคนิค

1. **แยกรีวิวเป็น Microservice** — รีวิวเป็นส่วนที่ถูกเขียนบ่อยและอาจโตเร็วกว่าข้อมูลหนัง แยกออกมาทำให้ scale / deploy / ล่มแยกกันได้ ถ้า Review Service ล่ม ผู้ใช้ยังดูและจัดการหนังได้ตามปกติ
2. **Frontend เรียกผ่าน Gateway ที่เดียว** — Frontend รู้จักแค่ `/api/v1` ไม่ต้องรู้ว่ามีกี่ service อยู่ที่ไหน ไม่มีปัญหา CORS และ Gateway ตรวจว่ามีหนังอยู่จริงก่อนส่งต่อ (ได้ 404 ที่ชัดเจนเร็วขึ้น)
3. **Timeout 3 วินาที + ตอบ 503 แทนการรอ** — ถ้า Review Service ค้าง Gateway จะไม่ค้างตาม (ต่างจาก iTunes ที่ใช้ retry เพราะเป็นบริการภายนอกที่ผิดพลาดชั่วคราวได้บ่อยกว่า)
4. **ใช้ฐานข้อมูลร่วมกัน (ข้อแลกเปลี่ยน)** — หลักการ microservices ที่ดีคือ database-per-service แต่ในขอบเขตงานนี้ใช้ MySQL ตัวเดียวเพื่อให้รันง่าย และยังได้ FK + `ON DELETE CASCADE` (ลบหนัง → รีวิวหายด้วย) โดยกำหนดให้ **เฉพาะ Review Service เท่านั้นที่อ่าน/เขียนตาราง `reviews`** ถ้าจะแยกฐานข้อมูลจริงต้องเปลี่ยนการลบแบบ cascade เป็นการส่ง event ระหว่าง service
5. **Validation สองชั้น** — Frontend ตรวจเพื่อช่วยผู้ใช้ (บอกทันทีใต้ช่อง) แต่ Backend ตรวจซ้ำเสมอเพราะ client ข้ามได้ (เช่น ยิงจาก Postman)
6. **Test ใช้ mock DB** — รันได้ทุกเครื่องภายใน ~4 วินาทีโดยไม่ต้องมี MySQL ส่วนการทดสอบกับฐานข้อมูลจริงใช้ Postman collection (newman) แทน

## Demo Script (3-4 นาที)

1. `npm start` → เปิด http://localhost:3000/ ชี้ตัวบอกสถานะ "ระบบพร้อมใช้งาน" (มาจาก `/api/v1/health` ที่เช็ค Review Service)
2. **Validation:** กด "เพิ่มหนัง" โดยไม่กรอก → error ใต้ทุกช่อง · ใส่ปี 1500 → แจ้งช่วงปีที่ถูกต้อง
3. **POST:** เพิ่ม "Tenet" / Christopher Nolan / 2020 → สำเร็จ ได้รหัส `TENE2020` การ์ดใหม่โผล่ทันที
4. **409:** เพิ่มชื่อเดิมซ้ำ → "หนังนี้มีอยู่แล้วในระบบ" (error จาก backend)
5. **PUT:** กด "แก้ไข" → เปลี่ยนชื่อ → บันทึก
6. **Microservice:** กด "รีวิว" ที่ Inception → เห็นคะแนนเฉลี่ย → ให้ 5 ดาว + ความคิดเห็น → คะแนนเฉลี่ยอัปเดต → ลบรีวิว
7. **ระบบทนต่อความล้มเหลว:** ปิด Review Service → รีเฟรช → ตัวบอกสถานะเป็นสีเหลือง, หนังยังโหลดได้, เปิดรีวิวได้ข้อความ "บริการรีวิวไม่พร้อมใช้งาน" → เปิดกลับ → ใช้ได้ตามเดิม
8. **External API:** ค้นหา "batman" จาก iTunes
9. **DELETE:** ลบ Tenet (มี confirm)
10. กดปุ่ม **📘 API Docs** มุมขวาบน → Swagger UI เปิดแท็บใหม่ ให้ดูว่าเอกสารตรงกับที่ demo (ลอง Try it out ได้) และ (ถ้ามีเวลา) รัน `npm test`

> สำหรับข้อ 7 ให้เปิดแบบแยก terminal: `npm run start:movies` กับ `npm run start:reviews` แล้ว Ctrl+C เฉพาะตัว reviews

## ปัญหาที่พบและวิธีแก้

| ปัญหา | วิธีแก้ |
| --- | --- |
| iTunes `media=movie&entity=movie` คืนผลลัพธ์ว่างทุกคำค้น (เปลี่ยนพฤติกรรมฝั่งผู้ให้บริการ) | ค้นแบบทั่วไปแล้วกรอง `kind === "feature-movie"` เอง (`src/services/external-api.js`) |
| ส่ง JSON ผิดรูปแบบได้ 500 (ระบุไว้ในเอกสาร Phase 2) | Error handler แยกกรณี `entity.parse.failed` → 400 `INVALID_JSON` |
| เอกสาร Phase 2 บอกว่า "ยังไม่ได้ตรวจช่วงคะแนน" | Review Service ตรวจ rating เป็นจำนวนเต็ม 1-5 และ comment ≤ 500 |
| เอกสารกับโค้ดไม่ตรงกันได้ง่ายเมื่อเพิ่ม endpoint | เขียน `tests/openapi-sync.test.js` เทียบ route ใน Express กับ `openapi.yaml` อัตโนมัติ |
| Review Service ล่มแล้ว Gateway ค้าง / 500 | `review-client.js` ตั้ง timeout และแปลงเป็น 503 ที่อ่านเข้าใจได้ |

## คำถามที่อาจถูกถาม

- **ทำไมไม่ให้ Frontend เรียก Review Service ตรง ๆ?** — จะต้องเปิด CORS ทุก service, Frontend ต้องรู้ที่อยู่ทุก service และตรวจหนังซ้ำไม่ได้ Gateway รวมจุดเข้าไว้ที่เดียว
- **ถ้า Review Service ล่ม จะเกิดอะไร?** — Gateway ได้ connection error หรือ timeout ภายใน 3 วินาที → ตอบ 503 `REVIEW_SERVICE_UNAVAILABLE` ส่วนอื่นยังทำงาน
- **movieCode สร้างอย่างไร?** — 4 ตัวอักษรแรกของชื่อ (ตัดช่องว่าง, ตัวพิมพ์ใหญ่) + ปี เช่น Interstellar 2014 → `INTE2014` และเป็น UNIQUE ในฐานข้อมูล
- **ทำไม PUT กับ PATCH ต่างกัน?** — PUT ต้องส่งครบทุกฟิลด์ (แทนทั้งรายการ), PATCH ส่งเฉพาะฟิลด์ที่ต้องการแก้
- **กัน XSS ฝั่ง Frontend อย่างไร?** — สร้าง element ด้วย `textContent` ไม่เอาข้อมูลจาก API ใส่ `innerHTML`

---

## คำตอบ Phase 1

**ข้อ 1:** เลือก `title` เป็นฟิลด์ Unique เพื่อป้องกันการเพิ่มหนังเรื่องเดิมซ้ำ เมื่อ `POST` แล้ว `title` ซ้ำควรตอบ **409 Conflict** เพราะคำขอรูปแบบถูกต้องแต่ขัดแย้งกับข้อมูลที่มีอยู่ ส่วน **400 Bad Request** ใช้เมื่อข้อมูลที่ส่งมาไม่ครบหรือรูปแบบไม่ถูกต้อง

**ข้อ 2:** การแก้ไขบางฟิลด์ใช้ `PATCH /api/v1/movies/:id` โดย `PUT` ยังใช้แก้ทั้งรายการ (ต้องส่งครบทุกฟิลด์) ส่วน `PATCH` อัปเดตเฉพาะฟิลด์ที่ส่งมา
