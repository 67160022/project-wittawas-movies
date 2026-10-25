// ตรวจ Swagger/Code Match อัตโนมัติ: route ที่ลงทะเบียนใน Express ต้องตรงกับ path+method ใน openapi.yaml ทุกตัว
jest.mock("../src/db", () => ({ query: jest.fn() }));

const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");
const moviesApp = require("../src/index");
const reviewApp = require("../src/review-service");

const spec = YAML.parse(fs.readFileSync(path.join(__dirname, "..", "openapi.yaml"), "utf8"));
const HTTP_METHODS = ["get", "post", "put", "patch", "delete"];

// อ่าน route จาก Express แล้วแปลง :id เป็น {id} ให้อยู่ในรูปแบบเดียวกับ OpenAPI
function routesOf(app) {
  return app.router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map(
        (method) => `${method.toUpperCase()} ${layer.route.path.replace(/:(\w+)/g, "{$1}")}`,
      ),
    );
}

function specRoutes(isReviewService) {
  return Object.entries(spec.paths)
    .filter(([, item]) => Boolean(item.servers?.[0]?.url.includes("3001")) === isReviewService)
    .flatMap(([p, item]) =>
      HTTP_METHODS.filter((m) => item[m]).map((m) => `${m.toUpperCase()} ${p}`),
    );
}

test("Movies API: ทุก route ในโค้ดมีในเอกสาร และทุก path ในเอกสารมีในโค้ด", () => {
  expect(routesOf(moviesApp).sort()).toEqual(specRoutes(false).sort());
});

test("Review Service: ทุก route ในโค้ดมีในเอกสาร และทุก path ในเอกสารมีในโค้ด", () => {
  expect(routesOf(reviewApp).sort()).toEqual(specRoutes(true).sort());
});

test("ทุก $ref ในเอกสารชี้ไปยัง component ที่มีอยู่จริง", () => {
  const refs = JSON.stringify(spec).match(/#\/components\/[^"]+/g);
  refs.forEach((ref) => {
    const target = ref
      .slice(2)
      .split("/")
      .reduce((node, key) => node?.[key], spec);
    expect({ ref, exists: Boolean(target) }).toEqual({ ref, exists: true });
  });
});
