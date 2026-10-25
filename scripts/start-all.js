// เปิด Movies API (Gateway, :3000) และ Review Service (:3001) พร้อมกันด้วยคำสั่งเดียว
// แต่ละ service รันเป็น process แยกกัน — ปิด service หนึ่งได้โดยอีก service ยังทำงานอยู่
const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const services = [
  { name: "review-service", file: "src/review-service/index.js" },
  { name: "movies-api", file: "src/index.js" },
];

const children = services.map(({ name, file }) => {
  const child = spawn(process.execPath, [file], { cwd: root });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split("\n")
      .filter(Boolean)
      .map((line) => `[${name}] ${line}`)
      .join("\n") + "\n";

  child.stdout.on("data", (chunk) => process.stdout.write(prefix(chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(prefix(chunk)));
  child.on("exit", (code) => console.log(`[${name}] exited with code ${code}`));
  return child;
});

const stopAll = () => {
  children.forEach((child) => child.kill());
  process.exit(0);
};

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);
