const http = require("node:http");

http
  .createServer((req, res) => {
    console.log("รับคำขอแล้ว แต่ไม่ตอบกลับ เพื่อทดสอบ timeout");
  })
  .listen(59999, "127.0.0.1", () => {
    console.log("Timeout test server running on port 59999");
  });
