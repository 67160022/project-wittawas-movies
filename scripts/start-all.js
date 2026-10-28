// เปิด Movies API (Gateway, :3000) และ Review Service (:3001) พร้อมกันด้วยคำสั่งเดียว
// แต่ละ service รันเป็น process แยกกัน — ปิด service หนึ่งได้โดยอีก service ยังทำงานอยู่
// ก่อนเปิด service จะเตรียมฐานข้อมูลให้ก่อน: เปิด container MySQL → รอจนพร้อม → npm run db:init
require("dotenv").config({ quiet: true });
const { spawn, spawnSync } = require("node:child_process");
const path = require("node:path");
const mysql = require("mysql2/promise");

const root = path.join(__dirname, "..");
const DB_CONTAINER = process.env.DB_CONTAINER || "mysql-project-backend";
const services = [
  { name: "review-service", file: "src/review-service/index.js" },
  { name: "movies-api", file: "src/index.js" },
];

const docker = (...args) => spawnSync("docker", args, { encoding: "utf8" });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const dbReady = async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    });
    await connection.end();
    return true;
  } catch {
    return false;
  }
};

const prepareDatabase = async () => {
  if (!(await dbReady())) {
    console.log(`[db] เปิด container ${DB_CONTAINER} ...`);
    const started = docker("start", DB_CONTAINER);
    if (started.error || started.status !== 0) {
      console.error(`[db] เปิด container ไม่สำเร็จ: ${(started.stderr || started.error.message).trim()}`);
      return;
    }

    // container หลุดจาก network → Docker ไม่ publish พอร์ต 3306 ต้องต่อ bridge ใหม่แล้วรีสตาร์ท
    const networks = docker("inspect", "-f", "{{len .NetworkSettings.Networks}}", DB_CONTAINER);
    if (networks.stdout.trim() === "0") {
      console.log("[db] container ไม่ได้ต่อ network — ต่อ bridge ให้ใหม่");
      docker("network", "connect", "bridge", DB_CONTAINER);
      docker("restart", DB_CONTAINER);
    }

    for (let i = 0; i < 30 && !(await dbReady()); i++) await sleep(1000);
  }

  spawnSync(process.execPath, ["scripts/init-db.js"], { cwd: root, stdio: "inherit" });
};

const startServices = () => services.map(({ name, file }) => {
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

let children = [];

const stopAll = () => {
  children.forEach((child) => child.kill());
  process.exit(0);
};

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

prepareDatabase().then(() => {
  children = startServices();
});
