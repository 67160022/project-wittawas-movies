// สร้างฐานข้อมูลจาก schema.sql + seed.sql ถ้ายังไม่มี แล้วเติม seed-more.sql (ไม่ลบข้อมูลเดิม)
require("dotenv").config({ quiet: true });
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  const [rows] = await connection.query("SHOW DATABASES LIKE ?", [process.env.DB_NAME]);
  const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

  if (rows.length > 0) {
    console.log(`มีฐานข้อมูล ${process.env.DB_NAME} อยู่แล้ว ไม่ต้องสร้างใหม่`);
  } else {
    await connection.query(read("schema.sql"));
    await connection.query(read("seed.sql"));
    console.log(`สร้างฐานข้อมูล ${process.env.DB_NAME} พร้อมข้อมูลตัวอย่างเรียบร้อย`);
  }

  // ข้อมูลตัวอย่างเพิ่มเติม — รันซ้ำได้ ข้ามรายการที่มีอยู่แล้ว
  await connection.query(read("seed-more.sql"));
  const [[{ total }]] = await connection.query(
    `SELECT COUNT(*) AS total FROM \`${process.env.DB_NAME}\`.movies`,
  );
  console.log(`เติมข้อมูลตัวอย่างเพิ่มเติมแล้ว (มีหนังทั้งหมด ${total} เรื่อง)`);

  await connection.end();
})().catch((err) => {
  console.error("สร้างฐานข้อมูลไม่สำเร็จ:", err.message);
  process.exit(1);
});
