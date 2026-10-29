# URI Schema (Phase 3)

## Movies API / Gateway — `http://localhost:3000`

| Method | URI                            | คำอธิบาย                                   | Status Code ที่ต้องจัดการ    |
| ------ | ------------------------------ | ------------------------------------------ | ---------------------------- |
| GET    | `/api/v1/health`               | สถานะ Movies API และ Review Service        | 200                          |
| GET    | `/api/v1/directors`            | ดึงรายชื่อผู้กำกับ                         | 200, 500                     |
| POST   | `/api/v1/directors`            | เพิ่มผู้กำกับใหม่ (ชื่อห้ามซ้ำ)            | 201, 400, 409, 500           |
| GET    | `/api/v1/movies`               | ดึงข้อมูลหนังทั้งหมด                       | 200, 500                     |
| GET    | `/api/v1/movies/{id}`          | ดึงข้อมูลหนังตามรหัส (id)                  | 200, 404, 500                |
| POST   | `/api/v1/movies`               | เพิ่มข้อมูลหนังใหม่                        | 201, 400, 404, 409, 500      |
| PUT    | `/api/v1/movies/{id}`          | แก้ไขข้อมูลหนังทั้งรายการ                  | 200, 400, 404, 409, 500      |
| PATCH  | `/api/v1/movies/{id}`          | แก้ไขข้อมูลหนังบางส่วน                     | 200, 400, 404, 409, 500      |
| DELETE | `/api/v1/movies/{id}`          | ลบข้อมูลหนัง (รีวิวถูกลบตาม)               | 200, 404, 500                |
| GET    | `/api/v1/movies/{id}/reviews`  | ดึงรีวิวของหนัง (ผ่าน Review Service)      | 200, 404, 500, 503           |
| POST   | `/api/v1/movies/{id}/reviews`  | เพิ่มรีวิว (ผ่าน Review Service)           | 201, 400, 404, 500, 503      |
| DELETE | `/api/v1/reviews/{reviewId}`   | ลบรีวิว (ผ่าน Review Service)              | 200, 404, 500, 503           |
| GET    | `/api/v1/external/movies?term` | ค้นหาหนังจาก iTunes                        | 200, 400, 500, 503           |

## Review Service (Microservice) — `http://localhost:3001`

| Method | URI                   | คำอธิบาย                     | Status Code ที่ต้องจัดการ |
| ------ | --------------------- | ---------------------------- | ------------------------- |
| GET    | `/health`             | สถานะ service                | 200                       |
| GET    | `/reviews?movie_id=`  | รีวิวของหนัง + คะแนนเฉลี่ย  | 200, 400, 500             |
| POST   | `/reviews`            | เพิ่มรีวิว                   | 201, 400, 404, 500        |
| DELETE | `/reviews/{id}`       | ลบรีวิว                      | 200, 404, 500             |
