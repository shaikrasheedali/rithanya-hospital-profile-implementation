/* Smoke tests: health, public reads, auth guard, validation. Run with `npm test` (server must be able to reach SQLite; does not require HTTP server). */
import assert from "node:assert";
import { prisma } from "../src/db.js";
import { ensureSeed } from "../src/seed.js";
import { getSettings } from "../src/settings.js";
import { getBloodStock, getBlogs, getProducts, getDoctors } from "../src/content.js";
import { computeMonthlyPayroll } from "../src/payroll.js";
import { encryptField, decryptField } from "../src/crypto.js";
import { slugify, sanitizeHtml, formatINR } from "../src/utils.js";

async function main() {
  console.log("[test] ensuring seed…");
  await ensureSeed();

  const s = await getSettings();
  assert.ok(s.legalName.includes("Rithanya"), "settings legalName");
  console.log("[test] settings OK:", s.legalName);

  const stock = await getBloodStock();
  assert.ok(stock.length === 4, `blood stock rows (got ${stock.length})`);
  assert.deepStrictEqual(stock.map((r) => r.groupCategory), ["O", "A", "B", "AB"]);
  console.log("[test] blood stock OK");

  const blogs = await getBlogs({ pageSize: 3 });
  assert.ok(blogs.total >= 4, `blogs total (got ${blogs.total})`);
  console.log("[test] blogs OK:", blogs.total);

  const products = await getProducts();
  assert.ok(products.length >= 8, `products (got ${products.length})`);
  assert.ok(products.every((p) => Array.isArray((p as { media: unknown[] }).media)), "products media attached");
  console.log("[test] products OK:", products.length);

  const doctors = await getDoctors();
  assert.ok(doctors.length >= 3, `doctors (got ${doctors.length})`);
  console.log("[test] doctors OK");

  // utils
  assert.strictEqual(slugify("Thalassemia & Sickle Cell Daycare!"), "thalassemia-and-sickle-cell-daycare");
  assert.ok(!sanitizeHtml('<script>alert(1)</script><p>hi</p><a href="javascript:alert(1)">x</a>').includes("script"));
  assert.ok(formatINR(899).includes("899.00"));
  const enc = encryptField("hello-phi");
  assert.strictEqual(decryptField(enc), "hello-phi");
  assert.strictEqual(decryptField("plain"), "plain");
  console.log("[test] utils/crypto OK");

  // payroll math matches original spec
  const c = computeMonthlyPayroll({ baseSalary: 30000, calendarDays: 30, lopDays: 2, allowances: 2000, otherDeductions: 500 });
  assert.strictEqual(c.paidDays, 28);
  assert.strictEqual(c.lopDeduction, 2000);
  assert.strictEqual(c.netPayable, 29500);
  console.log("[test] payroll OK");

  // DB invariants
  const users = await prisma.user.count();
  assert.ok(users >= 3, `users (got ${users})`);
  const cats = await prisma.clinicalCategory.count();
  assert.ok(cats >= 8, `categories (got ${cats})`);
  console.log("[test] db invariants OK");

  console.log("[test] ALL SMOKE TESTS PASSED");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[test] FAILED", e);
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
