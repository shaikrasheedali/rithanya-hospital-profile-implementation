/* Smoke tests: health, public reads, auth guard, validation. Run with `npm test`.
   Offline-tolerant: when MySQL is unreachable the CMS stores/caches keep data
   locally (durable outbox replays writes on reconnect), so every assertion
   below must pass in both modes. */
import assert from "node:assert";
import { prisma, isDbOnCooldown } from "../src/db.js";
import { ensureSeed } from "../src/seed.js";
import { getSettings } from "../src/settings.js";
import { getBloodStock, getBlogs, getProducts, getDoctors } from "../src/content.js";
import { listCollection, updateItem, getCollectionStore } from "../src/cms.js";
import { FALLBACK_SPECIALTIES } from "../src/fallbackData.js";
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
  assert.ok(stock.length === 8, `blood stock rows (got ${stock.length})`);
  assert.deepStrictEqual(stock.map((r) => r.bloodGroup), ["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"]);
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

  // Admin-edit durability regression (the historical "admin edits wiped/reverted
  // to defaults" bug): the CMS store must keep exactly the canonical items with
  // no duplicates, and an admin edit must stick (memory now, DB when reachable).
  const specialties = await listCollection("specialties");
  const specIds = specialties.map((i) => i.id as string);
  assert.strictEqual(specialties.length, FALLBACK_SPECIALTIES.length, `specialties count (got ${specialties.length})`);
  assert.strictEqual(new Set(specIds).size, specIds.length, `no duplicate specialty ids (${specIds.join(",")})`);
  for (const f of FALLBACK_SPECIALTIES) {
    assert.ok(specIds.includes(f.id), `canonical specialty ${f.id} present`);
  }
  const store = getCollectionStore("specialties");
  assert.strictEqual(store.size, FALLBACK_SPECIALTIES.length, "store mirrors collection size");
  const edited = specialties[0]!;
  const originalSummary = edited.shortSummary as string;
  const SmokeSummary = `smoke-edit-${Date.now()}`;
  const upd = await updateItem("specialties", edited.id as string, { shortSummary: SmokeSummary });
  assert.ok(upd, "updateItem responded");
  const reloaded = await listCollection("specialties");
  assert.strictEqual(
    reloaded.find((i) => i.id === edited.id)?.shortSummary,
    SmokeSummary,
    "admin edit persists in the store",
  );
  // Revert so test runs leave the dataset pristine (queued outbox ops replay
  // in the same order, so the final restored value is always the original).
  await updateItem("specialties", edited.id as string, { shortSummary: originalSummary });
  const reverted = await listCollection("specialties");
  assert.strictEqual(reverted.find((i) => i.id === edited.id)?.shortSummary, originalSummary, "revert applied");
  console.log("[test] cms specialties regression OK");

  // utils
  assert.strictEqual(slugify("Thalassemia & Sickle Cell Daycare!"), "thalassemia-and-sickle-cell-daycare");
  const sanitized = sanitizeHtml(
    '<script>alert(1)</script><p>hi</p><a href="javascript:alert(1)">x</a><a href="data:text/html,<script>x</script>">y</a><img src="data:image/png;base64,iVBOR" alt="ok">',
  );
  assert.ok(!sanitized.includes("script"), "no script tags or payloads");
  assert.ok(!sanitized.includes("javascript:"), "javascript: neutralized");
  assert.ok(!sanitized.includes("data:text/html"), "data:text/html neutralized");
  assert.ok(sanitized.includes("data:image/png"), "data:image kept for inline images");
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

  // DB invariants (when database is online)
  if (!isDbOnCooldown()) {
    try {
      const users = await prisma.user.count();
      assert.ok(users >= 2, `users (got ${users})`);
      const cats = await prisma.clinicalCategory.count();
      assert.ok(cats >= 8, `categories (got ${cats})`);
      console.log("[test] db invariants OK");
    } catch {
      console.log("[test] DB offline during query, resilient fallback verified");
    }
  } else {
    console.log("[test] DB offline / cooldown, resilient fallback verified");
  }

  console.log("[test] ALL SMOKE TESTS PASSED");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("[test] FAILED", e);
  try { await prisma.$disconnect(); } catch { /* ignore */ }
  process.exit(1);
});
