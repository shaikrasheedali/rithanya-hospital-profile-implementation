/* Exhaustive backend E2E: every endpoint × method × valid/invalid/edge inputs.
 * Spawns the BUILT server (node dist/src/index.js) on PORT 4455, runs ~130 assertions, then cleans up.
 *
 * Run:  npm run build && npm run test:e2e
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PORT = 4455;
const BASE = `http://localhost:${PORT}`;
const SERVER_DIR = process.cwd();

let pass = 0;
let fail = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string, extra?: unknown) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(label + (extra !== undefined ? ` :: ${JSON.stringify(extra).slice(0, 300)}` : ""));
    console.error(`  FAIL ${label}`, extra ?? "");
  }
}

type Jar = { cookie: string };
async function req(
  method: string,
  url: string,
  opts: { body?: unknown; jar?: Jar; form?: FormData; headers?: Record<string, string>; raw?: boolean } = {},
): Promise<{ status: number; json: unknown; text: string; headers: Headers }> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.jar) headers.Cookie = opts.jar.cookie;
  let body: string | FormData | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(BASE + url, { method, headers, body });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text, headers: res.headers };
}

async function login(username: string, password: string): Promise<Jar> {
  const res = await fetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = res.headers.get("set-cookie") ?? "";
  ok(res.status === 200, `login ${username} 200`, res.status);
  ok(/rh_session=/.test(setCookie), `login ${username} sets cookie`);
  return { cookie: setCookie.split(";")[0] };
}

async function waitForHealth(child: ChildProcess): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + "/api/health");
      if (r.ok) return;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill();
  throw new Error("server did not become healthy");
}

async function main() {
  const child = spawn("node", ["dist/src/index.js"], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore",
  });
  const cleanupUploads: string[] = [];
  try {
    await waitForHealth(child);
    console.log("[e2e] server up, running assertions…");

    /* ---------- health / frontend / static ---------- */
    {
      const r = await req("GET", "/api/health");
      ok(r.status === 200 && (r.json as { ok?: boolean })?.ok === true, "GET /api/health 200 {ok:true}", r.text);
      const home = await req("GET", "/");
      ok(home.status === 200 && home.text.includes('<div id="root"'), "GET / serves SPA", home.status);
      const portal = await req("GET", "/portal/dashboard");
      ok(portal.status === 200 && portal.text.includes('<div id="root"'), "GET /portal/dashboard serves SPA", portal.status);
      const nope = await req("GET", "/api/nope");
      ok(nope.status === 404, "GET /api/nope 404", nope.status);
      const seed = await req("GET", "/seed/hospital-corridor.webp");
      ok(seed.status === 200 && (seed.headers.get("content-type") ?? "").includes("image/webp"), "GET /seed/*.webp 200 webp", seed.status);
      ok(Number(seed.headers.get("content-length") ?? 0) > 1000, "seed webp is a real image (>1KB)", seed.headers.get("content-length"));
      const seedMissing = await req("GET", "/seed/does-not-exist.webp");
      ok(seedMissing.status === 404, "GET /seed/missing 404", seedMissing.status);
    }

    /* ---------- public reads ---------- */
    {
      const s = await req("GET", "/api/public/settings");
      ok(s.status === 200 && !!(s.json as { settings?: { legalName?: string } })?.settings?.legalName, "public settings", s.status);
      for (const t of ["specialties", "treatments", "services"]) {
        const r = await req("GET", `/api/public/clinical?type=${t}`);
        ok(r.status === 200 && Array.isArray((r.json as { items?: unknown[] })?.items) && ((r.json as { items: unknown[] }).items.length > 0), `clinical ${t} non-empty`, r.status);
      }
      const badType = await req("GET", "/api/public/clinical?type=nope");
      ok(badType.status === 400, "clinical invalid type 400", badType.status);
      const sp = await req("GET", "/api/public/clinical?type=specialties");
      const slug = (sp.json as { items: Array<{ slug: string }> }).items[0].slug;
      const one = await req("GET", `/api/public/clinical/specialties/${slug}`);
      ok(one.status === 200 && (one.json as { item?: { slug?: string } })?.item?.slug === slug, "clinical detail 200", one.status);
      const oneMissing = await req("GET", "/api/public/clinical/specialties/no-such-slug");
      ok(oneMissing.status === 404, "clinical detail missing 404", oneMissing.status);
      const badColl = await req("GET", "/api/public/clinical/nope/slug");
      ok(badColl.status === 404, "clinical bad collection 404", badColl.status);
      const docs = await req("GET", "/api/public/doctors");
      ok(docs.status === 200 && ((docs.json as { items: unknown[] }).items.length >= 3), "doctors list", docs.status);
      const dslug = (docs.json as { items: Array<{ slug: string }> }).items[0].slug;
      ok((await req("GET", `/api/public/doctors/${dslug}`)).status === 200, "doctor detail 200");
      ok((await req("GET", "/api/public/doctors/nope")).status === 404, "doctor detail 404");
      ok((await req("GET", "/api/public/insurance")).status === 200, "insurance 200");
      ok((await req("GET", "/api/public/gallery")).status === 200, "gallery 200");
      ok((await req("GET", "/api/public/testimonials")).status === 200, "testimonials 200");
      ok((await req("GET", "/api/public/services?limit=2")).status === 200, "services limit 200");
      ok((await req("GET", "/api/public/treatments")).status === 200, "treatments 200");
      ok((await req("GET", "/api/public/flagship?limit=2")).status === 200, "flagship 200");
      const blogs = await req("GET", "/api/public/blogs?page=1&pageSize=2");
      ok(blogs.status === 200 && ((blogs.json as { posts: unknown[] }).posts.length === 2), "blogs pagination", blogs.status);
      const bq = await req("GET", "/api/public/blogs?q=zzz-no-match-zzz");
      ok(bq.status === 200 && (bq.json as { total: number }).total === 0, "blogs empty search", bq.status);
      const bc = await req("GET", "/api/public/blogs?category=Diabetes%20Management");
      ok(bc.status === 200 && (bc.json as { total: number }).total > 0, "blogs category filter", bc.status);
      const bslug = (blogs.json as { posts: Array<{ slug: string }> }).posts[0].slug;
      ok((await req("GET", `/api/public/blogs/${bslug}`)).status === 200, "blog detail 200");
      ok((await req("GET", "/api/public/blogs/nope")).status === 404, "blog detail 404");
      const prods = await req("GET", "/api/public/products");
      ok(prods.status === 200 && ((prods.json as { items: unknown[] }).items.length >= 8), "products list", prods.status);
      const stock = await req("GET", "/api/public/blood-stock");
      ok(stock.status === 200 && ((stock.json as { stock: unknown[] }).stock.length === 4), "blood-stock 4 groups", stock.status);
      const hm = await req("GET", "/api/public/home");
      ok(hm.status === 200 && !!(hm.json as { settings?: unknown })?.settings && Array.isArray((hm.json as { specialties?: unknown[] })?.specialties), "home aggregate", hm.status);
    }

    /* ---------- public writes: appointments ---------- */
    let apptId = "";
    {
      const good = await req("POST", "/api/public/appointments", { body: { fullName: "E2E Visitor", phone: "9000000099", department: "Diabetology", preferredDate: "2026-11-01", message: "routine", source: "WEBSITE" } });
      ok(good.status === 200, "appointment create 200", good.text);
      ok((await req("POST", "/api/public/appointments", { body: { fullName: "X", phone: "9000000099" } })).status === 400, "appointment short name 400");
      ok((await req("POST", "/api/public/appointments", { body: { fullName: "E2E Visitor", phone: "123" } })).status === 400, "appointment bad phone 400");
      ok((await req("POST", "/api/public/appointments", { body: {} })).status === 400, "appointment empty 400");
      const badSource = await req("POST", "/api/public/appointments", { body: { fullName: "E2E Src", phone: "9000000098", source: "HACK" } });
      ok(badSource.status === 200, "appointment bad source defaults WEBSITE", badSource.status);
      const sup = await login("superadmin", "Rithanya@2026");
      const list = await req("GET", "/api/portal/appointments", { jar: sup });
      const hit = ((list.json as { items: Array<{ id: string; fullName: string }> }).items ?? []).find((a) => a.fullName === "E2E Visitor");
      ok(!!hit, "appointment persisted, visible in portal");
      apptId = hit!.id;
    }

    /* ---------- auth ---------- */
    const sup = await login("superadmin", "Rithanya@2026");
    const adm = await login("admin", "Admin@2026");
    const stf = await login("staff", "Staff@2026");
    {
      ok((await req("POST", "/api/auth/login", { body: { username: "superadmin", password: "wrong" } })).status === 401, "login wrong pw 401");
      ok((await req("POST", "/api/auth/login", { body: { username: "ghost", password: "whatever123" } })).status === 401, "login unknown 401");
      ok((await req("POST", "/api/auth/login", { body: {} })).status === 400, "login empty 400");
      ok((await req("GET", "/api/auth/me")).status === 401, "me unauth 401");
      const me = await req("GET", "/api/auth/me", { jar: sup });
      ok(me.status === 200 && (me.json as { user?: { role?: string } })?.user?.role === "SUPERADMIN", "me superadmin", me.status);
      ok((await req("POST", "/api/auth/bootstrap", { body: {} })).status === 403, "bootstrap locked 403");
      ok((await req("POST", "/api/auth/logout", { jar: sup })).status === 200, "logout 200");
      ok((await req("GET", "/api/portal/dashboard")).status === 401, "portal guard unauth 401");
      ok((await req("GET", "/api/portal/settings", { jar: stf })).status === 403, "staff settings 403");
      ok((await req("GET", "/api/portal/users", { jar: stf })).status === 403, "staff users 403");
      ok((await req("POST", "/api/portal/r/users", { jar: stf, body: {} })).status === 403, "staff create-user 403");
      ok((await req("GET", "/api/portal/patients", { jar: stf })).status === 200, "staff patients 200 (has emr)");
      ok((await req("GET", "/api/portal/cms/specialties", { jar: adm })).status === 200, "admin cms 200");
      ok((await req("GET", "/api/portal/settings", { jar: adm })).status === 403, "admin settings 403");
      const csrf = await req("POST", "/api/portal/r/categories", { jar: sup, body: { name: "x" }, headers: { Origin: "https://evil.example" } });
      ok(csrf.status === 403, "CSRF origin blocked 403", csrf.status);
    }

    /* ---------- portal: categories CRUD ---------- */
    {
      const name = `E2E Cat ${Date.now()}`;
      const c = await req("POST", "/api/portal/r/categories", { jar: sup, body: { name, description: "tmp" } });
      ok(c.status === 200, "category create 200", c.text);
      const cid = (c.json as { data: { id: string } }).data.id;
      ok((await req("POST", "/api/portal/r/categories", { jar: sup, body: { name } })).status === 409, "category duplicate 409");
      ok((await req("POST", "/api/portal/r/categories", { jar: sup, body: {} })).status === 400, "category empty 400");
      ok((await req("PUT", `/api/portal/r/categories/${cid}`, { jar: sup, body: { name: name + " v2" } })).status === 200, "category update 200");
      ok((await req("PUT", "/api/portal/r/categories/00000000-0000-0000-0000-000000000000", { jar: sup, body: { name: "z" } })).status === 404, "category update bogus 404");
      ok((await req("DELETE", `/api/portal/r/categories/${cid}`, { jar: sup })).status === 200, "category delete 200");
      const list = await req("GET", "/api/portal/r/categories", { jar: sup });
      ok(list.status === 200 && Array.isArray((list.json as { items: unknown[] }).items), "categories list 200");
    }

    /* ---------- portal: patients lifecycle ---------- */
    let patientId = "";
    {
      const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 10, g: 37, b: 64 } } }).png().toBuffer();
      const consent = `data:image/png;base64,${png.toString("base64")}`;
      const badPhone = await req("POST", "/api/portal/r/patients", { jar: sup, body: { patientType: "OUTPATIENT", fullName: "E2E Pat", contactNumber: "12", age: 30, gender: "MALE", bloodGroup: "O+ve" } });
      ok(badPhone.status === 400, "patient bad phone 400", badPhone.text);
      const badAge = await req("POST", "/api/portal/r/patients", { jar: sup, body: { patientType: "OUTPATIENT", fullName: "E2E Pat", contactNumber: "9000000051", age: 999, gender: "MALE", bloodGroup: "O+ve" } });
      ok(badAge.status === 400, "patient bad age 400");
      const noRoom = await req("POST", "/api/portal/r/patients", { jar: sup, body: { patientType: "INPATIENT", fullName: "E2E Pat", contactNumber: "9000000051", age: 30, gender: "MALE", bloodGroup: "O+ve" } });
      ok(noRoom.status === 400, "inpatient without room 400");
      const created = await req("POST", "/api/portal/r/patients", { jar: sup, body: { patientType: "OUTPATIENT", fullName: "E2E Patient", contactNumber: "9000000051", age: 30, gender: "MALE", bloodGroup: "O+ve", clinicalCondition: "e2e", allergies: ["Dust"], consentPhoto: consent } });
      ok(created.status === 200 && !!(created.json as { data: { id?: string } }).data?.id, "patient create 200", created.text);
      patientId = (created.json as { data: { id: string } }).data.id;
      ok((await req("PUT", `/api/portal/r/patients/${patientId}`, { jar: sup, body: { age: 31 } })).status === 200, "patient update 200");
      ok((await req("POST", `/api/portal/r/patients/${patientId}`, { jar: sup, body: { action: "vitals", haemoglobin: 0, spO2: 98, pulse: 80, bpSystolic: 120, bpDiastolic: 80 } })).status === 400, "vitals bad hb 400");
      ok((await req("POST", "/api/portal/r/patients/00000000-0000-0000-0000-000000000000", { jar: sup, body: { action: "vitals", haemoglobin: 12, spO2: 98, pulse: 80, bpSystolic: 120, bpDiastolic: 80 } })).status === 404, "vitals bogus patient 404");
      ok((await req("POST", `/api/portal/r/patients/${patientId}`, { jar: sup, body: { action: "vitals", haemoglobin: 12.5, spO2: 98, pulse: 80, bpSystolic: 120, bpDiastolic: 80, clinicalNotes: "e2e" } })).status === 200, "vitals valid 200");
      ok((await req("POST", `/api/portal/r/patients/${patientId}`, { jar: sup, body: { action: "nope" } })).status === 400, "patient unknown action 400");
      const plist = await req("GET", "/api/portal/patients?type=OUTPATIENT", { jar: sup });
      const row = ((plist.json as { patients: Array<{ id: string; fullName: string; consentPhotoUrl: string | null; vitals: unknown[] }> }).patients ?? []).find((p) => p.id === patientId);
      ok(!!row && row.fullName === "E2E Patient" && row.vitals.length === 1, "patient decrypted + vitals in list", row);
      if (row?.consentPhotoUrl) {
        const file = row.consentPhotoUrl.split("/").pop()!;
        const cf = await req("GET", `/api/portal/consent/${file}`, { jar: stf });
        ok(cf.status === 200 && (cf.headers.get("content-type") ?? "").includes("image/webp"), "consent file 200 webp", cf.status);
        cleanupUploads.push(`uploads/private/consent/${file}`);
      }
      ok((await req("GET", "/api/portal/consent/bogus.webp")).status === 401, "consent unauth 401");
      ok((await req("GET", "/api/portal/consent/bogus.webp", { jar: sup })).status === 404, "consent missing 404");
      ok((await req("POST", `/api/portal/r/patients/${patientId}`, { jar: sup, body: { action: "discharge", notes: "e2e recovered" } })).status === 200, "discharge 200");
      const dis = await req("GET", "/api/portal/patients?discharged=1", { jar: sup });
      ok(((dis.json as { patients: Array<{ id: string }> }).patients ?? []).some((p) => p.id === patientId), "discharged list contains patient");
      ok((await req("POST", `/api/portal/r/patients/${patientId}`, { jar: sup, body: { action: "archive" } })).status === 200, "archive 200");
      ok((await req("POST", `/api/portal/r/patients/${patientId}`, { jar: sup, body: { action: "unarchive" } })).status === 200, "unarchive 200");
      ok((await req("DELETE", `/api/portal/r/patients/${patientId}`, { jar: sup })).status === 200, "patient remove (archive) 200");
    }

    /* ---------- portal: appointments update/remove ---------- */
    {
      ok((await req("PUT", `/api/portal/r/appointments/${apptId}`, { jar: sup, body: { status: "CONFIRMED" } })).status === 200, "appt confirm 200");
      ok((await req("PUT", "/api/portal/r/appointments/00000000-0000-0000-0000-000000000000", { jar: sup, body: { status: "CONFIRMED" } })).status === 404, "appt update bogus 404");
      ok((await req("PUT", `/api/portal/r/appointments/${apptId}`, { jar: sup, body: { status: "BOGUS" } })).status === 400, "appt bad status 400");
      ok((await req("DELETE", `/api/portal/r/appointments/${apptId}`, { jar: sup })).status === 200, "appt delete 200");
      ok((await req("DELETE", "/api/portal/r/appointments/00000000-0000-0000-0000-000000000000", { jar: sup })).status === 404, "appt delete bogus 404");
    }

    /* ---------- portal: bloodbank ---------- */
    {
      ok((await req("POST", "/api/portal/r/bloodbank", { jar: sup, body: {} })).status === 400, "bloodbank empty 400");
      ok((await req("POST", "/api/portal/r/bloodbank", { jar: sup, body: { stocks: [{ bloodGroup: "Z", wholeBloodUnits: 1, plasmaUnits: 1 }] } })).status === 400, "bloodbank bad group 400");
      ok((await req("POST", "/api/portal/r/bloodbank", { jar: sup, body: { stocks: [{ bloodGroup: "O", wholeBloodUnits: -1, plasmaUnits: 0 }] } })).status === 400, "bloodbank negative 400");
      ok((await req("POST", "/api/portal/r/bloodbank", { jar: sup, body: { stocks: [{ bloodGroup: "O", wholeBloodUnits: 14, plasmaUnits: 9 }, { bloodGroup: "A", wholeBloodUnits: 11, plasmaUnits: 7 }, { bloodGroup: "B", wholeBloodUnits: 9, plasmaUnits: 6 }, { bloodGroup: "AB", wholeBloodUnits: 4, plasmaUnits: 3 }] } })).status === 200, "bloodbank bulk 200");
      const bb = await req("GET", "/api/portal/blood-stock", { jar: sup });
      ok(bb.status === 200 && typeof (bb.json as { threshold?: number }).threshold === "number", "portal blood-stock 200", bb.status);
    }

    /* ---------- public orders + portal cancel (stock restore) ---------- */
    {
      const prods = await req("GET", "/api/public/products");
      const p = ((prods.json as { items: Array<{ id: string; stockUnits: number }> }).items ?? []).find((x) => x.stockUnits > 5)!;
      const before = p.stockUnits;
      ok((await req("POST", "/api/public/orders", { body: { name: "E", phone: "9000000061", address: "12 Main St, Khammam", pin: "507001", items: [] } })).status === 400, "order empty cart 400");
      ok((await req("POST", "/api/public/orders", { body: { name: "E2E Buyer", phone: "9000000061", address: "12 Main St, Khammam", pin: "123", items: [{ productId: p.id, quantity: 1 }] } })).status === 400, "order bad pin 400");
      ok((await req("POST", "/api/public/orders", { body: { name: "E2E Buyer", phone: "9000000061", address: "12 Main St, Khammam", pin: "507001", items: [{ productId: p.id, quantity: 0 }] } })).status === 400, "order qty 0 400");
      ok((await req("POST", "/api/public/orders", { body: { name: "E2E Buyer", phone: "9000000061", address: "12 Main St, Khammam", pin: "507001", items: [{ productId: p.id, quantity: before + 50 }] } })).status === 400, "order over-stock 400");
      ok((await req("POST", "/api/public/orders", { body: { name: "E2E Buyer", phone: "9000000061", address: "12 Main St, Khammam", pin: "507001", items: [{ productId: "00000000-0000-0000-0000-000000000000", quantity: 1 }] } })).status === 400, "order unknown product 400");
      const placed = await req("POST", "/api/public/orders", { body: { name: "E2E Buyer", phone: "9000000061", address: "12 Main St, Khammam", pin: "507001", paymentMethod: "UPI", items: [{ productId: p.id, quantity: 2 }] } });
      ok(placed.status === 200 && !!(placed.json as { orderNumber?: string })?.orderNumber, "order placed 200", placed.text);
      const orders = await req("GET", "/api/portal/orders", { jar: sup });
      const ord = ((orders.json as { items: Array<{ id: string; orderNumber: string }> }).items ?? []).find((o) => o.orderNumber === (placed.json as { orderNumber: string }).orderNumber)!;
      ok(!!ord, "order visible in portal");
      ok((await req("PUT", `/api/portal/r/orders/${ord.id}`, { jar: sup, body: { status: "PAID" } })).status === 200, "order → PAID 200");
      ok((await req("PUT", `/api/portal/r/orders/${ord.id}`, { jar: sup, body: { status: "CANCELLED" } })).status === 200, "order → CANCELLED restores stock 200");
      ok((await req("PUT", `/api/portal/r/orders/${ord.id}`, { jar: sup, body: { status: "PAID" } })).status === 400, "cancelled reopen 400");
      const after = await req("GET", "/api/public/products");
      const pAfter = ((after.json as { items: Array<{ id: string; stockUnits: number }> }).items ?? []).find((x) => x.id === p.id)!;
      ok(pAfter.stockUnits === before, `stock restored (${before})`, pAfter.stockUnits);
      ok((await req("PUT", "/api/portal/r/orders/00000000-0000-0000-0000-000000000000", { jar: sup, body: { status: "PAID" } })).status === 404, "order bogus 404");
    }

    /* ---------- portal: CMS collections ---------- */
    {
      ok((await req("GET", "/api/portal/cms/nope", { jar: sup })).status === 404, "cms unknown 404");
      const noMedia = await req("POST", "/api/portal/cms/specialties", { jar: sup, body: { title: "E2E Spec", shortSummary: "x".repeat(10) } });
      ok(noMedia.status === 400, "cms missing media 400", noMedia.text);
      const noTitle = await req("POST", "/api/portal/cms/specialties", { jar: stf, body: { title: "x" } });
      ok(noTitle.status === 403, "cms staff forbidden 403", noTitle.status);
      const media = await req("GET", "/api/portal/media", { jar: sup });
      const assetId = ((media.json as { assets: Array<{ id: string; kind: string }> }).assets ?? []).find((a) => a.kind === "IMAGE")!.id;
      const created = await req("POST", "/api/portal/cms/specialties", { jar: sup, body: { title: `E2E Specialty ${Date.now()}`, shortSummary: "End-to-end test specialty", contentHtml: "<p>hi</p>", mediaIds: [assetId] } });
      ok(created.status === 200, "cms create 200", created.text);
      const list = await req("GET", "/api/portal/cms/specialties", { jar: sup });
      const item = ((list.json as { items: Array<{ id: string; title: string }> }).items ?? []).find((x) => x.title.startsWith("E2E Specialty"))!;
      ok(!!item, "cms item listed");
      ok((await req("PUT", `/api/portal/cms/specialties/${item.id}`, { jar: sup, body: { title: item.title, shortSummary: "updated", mediaIds: [] } })).status === 400, "cms update empty media 400");
      ok((await req("PUT", `/api/portal/cms/specialties/${item.id}`, { jar: sup, body: { title: "E2E Specialty v2", shortSummary: "updated", mediaIds: [assetId] } })).status === 200, "cms update 200");
      ok((await req("PUT", "/api/portal/cms/specialties/00000000-0000-0000-0000-000000000000", { jar: sup, body: { title: "z", shortSummary: "z", mediaIds: [assetId] } })).status === 404, "cms update bogus 404");
      ok((await req("DELETE", `/api/portal/cms/specialties/${item.id}`, { jar: sup })).status === 200, "cms delete 200");
    }

    /* ---------- portal: media upload / serve / delete ---------- */
    {
      ok((await req("GET", "/api/portal/media", { jar: stf })).status === 200, "media list as staff 200");
      const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 13, g: 71, b: 161 } } }).png().toBuffer();
      const fd = new FormData();
      fd.append("files", new File([png], "e2e.png", { type: "image/png" }));
      fd.append("files", new File(["hello"], "e2e.txt", { type: "text/plain" }));
      const up = await req("POST", "/api/portal/media", { jar: sup, form: fd });
      ok(up.status === 200 && ((up.json as { assets: unknown[] }).assets.length === 1) && ((up.json as { errors: unknown[] }).errors.length === 1), "media upload 1 ok + 1 error", up.text);
      const asset = ((up.json as { assets: Array<{ id: string; filename: string; url: string }> }).assets)[0];
      const serve = await req("GET", `/api/media/${asset.filename}`);
      ok(serve.status === 200 && (serve.headers.get("content-type") ?? "").includes("image/webp"), "serve uploaded webp 200", serve.status);
      const range = await req("GET", `/api/media/${asset.filename}`, { headers: { Range: "bytes=0-99" } });
      ok(range.status === 206, "range 206", range.status);
      ok((await req("GET", "/api/media/evil.txt")).status === 404, "media bad ext 404");
      ok((await req("GET", "/api/media/missing.webp")).status === 404, "media missing 404");
      ok((await req("GET", "/api/media/..%2Fpackage.json")).status === 404, "media traversal 404");
      // linked asset cannot be deleted: link it via a temp specialty first
      const linked = await req("POST", "/api/portal/cms/specialties", { jar: sup, body: { title: `E2E Link ${Date.now()}`, shortSummary: "link probe", mediaIds: [asset.id] } });
      ok(linked.status === 200, "link asset via cms 200");
      ok((await req("DELETE", `/api/portal/media/${asset.id}`, { jar: sup })).status === 409, "delete linked asset 409");
      const list2 = await req("GET", "/api/portal/cms/specialties", { jar: sup });
      const li = ((list2.json as { items: Array<{ id: string; title: string }> }).items ?? []).find((x) => x.title.startsWith("E2E Link"))!;
      await req("DELETE", `/api/portal/cms/specialties/${li.id}`, { jar: sup });
      ok((await req("DELETE", `/api/portal/media/${asset.id}`, { jar: sup })).status === 200, "delete unlinked asset 200");
      ok((await req("DELETE", "/api/portal/media/00000000-0000-0000-0000-000000000000", { jar: sup })).status === 404, "delete media bogus 404");
      const emptyFd = new FormData();
      ok((await req("POST", "/api/portal/media", { jar: sup, form: emptyFd })).status === 400, "media no files 400");
    }

    /* ---------- public DPDP + portal desk ---------- */
    {
      const fd = new FormData();
      fd.append("fullName", "E2E Requester");
      fd.append("phoneNumber", "9000000077");
      fd.append("requestDetails", "Please erase my test records for e2e.");
      fd.append("identityProof", new File(["proof"], "id.png", { type: "image/png" }));
      const created = await req("POST", "/api/public/dpdp", { form: fd });
      ok(created.status === 200 && !!(created.json as { trackingCode?: string })?.trackingCode, "dpdp create 200", created.text);
      const code = (created.json as { trackingCode: string }).trackingCode;
      ok((await req("POST", "/api/public/dpdp", { body: {} })).status === 400, "dpdp empty 400");
      const st = await req("GET", `/api/public/dpdp?code=${code}&phone=9000000077`);
      ok(st.status === 200 && (st.json as { status?: string })?.status === "PENDING", "dpdp status pending", st.text);
      ok((await req("GET", `/api/public/dpdp?code=${code}&phone=9000000000`)).status === 404, "dpdp wrong phone 404");
      ok((await req("GET", "/api/public/dpdp")).status === 400, "dpdp status missing params 400");
      const all = await req("GET", "/api/portal/dpdp-requests", { jar: sup });
      const row = ((all.json as { items: Array<{ id: string; trackingCode: string; identityProofFile: string | null }> }).items ?? []).find((x) => x.trackingCode === code)!;
      ok(!!row, "dpdp request in portal");
      if (row.identityProofFile) {
        const proof = await req("GET", `/api/portal/dpdp-proof/${row.identityProofFile}`, { jar: sup });
        ok(proof.status === 200, "dpdp proof 200", proof.status);
        ok((await req("GET", `/api/portal/dpdp-proof/${row.identityProofFile}`, { jar: stf })).status === 403, "dpdp proof staff 403");
        ok((await req("GET", "/api/portal/dpdp-proof/bogus.png", { jar: sup })).status === 404, "dpdp proof missing 404");
        cleanupUploads.push(`uploads/private/${row.identityProofFile}`);
      }
      const match = await req("POST", `/api/portal/r/dpdp/${row.id}`, { jar: sup, body: { action: "match" } });
      ok(match.status === 200 && Array.isArray((match.json as { data: { matches: unknown[] } }).data?.matches), "dpdp match 200", match.text);
      ok((await req("POST", `/api/portal/r/dpdp/${row.id}`, { jar: sup, body: { action: "erase" } })).status === 404, "dpdp erase no-match 404");
      ok((await req("POST", `/api/portal/r/dpdp/${row.id}`, { jar: sup, body: { action: "resolve", notes: "e2e verified manually" } })).status === 200, "dpdp resolve 200");
      const st2 = await req("GET", `/api/public/dpdp?code=${code}&phone=9000000077`);
      ok((st2.json as { status?: string })?.status === "MANUALLY_RESOLVED", "dpdp public reflects resolution");
      ok((await req("POST", `/api/portal/r/dpdp/${row.id}`, { jar: sup, body: { action: "erase" } })).status === 400, "dpdp erase after resolve 400");
    }

    /* ---------- portal: employees + payroll + payslip ---------- */
    {
      const bad = await req("POST", "/api/portal/r/employees", { jar: sup, body: { entity: "RITHANYA_HOSPITAL", fullName: "E", designation: "Nurse", department: "Nursing", monthlyFixedBaseSalary: -5 } });
      ok(bad.status === 400, "employee invalid 400", bad.text);
      const created = await req("POST", "/api/portal/r/employees", { jar: sup, body: { entity: "RITHANYA_HOSPITAL", fullName: "E2E Nurse", designation: "Staff Nurse", department: "Nursing", shiftSchedule: "General", contactNumber: "9000000044", monthlyFixedBaseSalary: 30000, isActive: true } });
      ok(created.status === 200, "employee create 200", created.text);
      const eid = (created.json as { data: { id: string } }).data.id;
      ok((await req("POST", `/api/portal/r/employees/${eid}`, { jar: sup, body: { action: "toggle" } })).status === 200, "employee toggle 200");
      ok((await req("POST", "/api/portal/r/payroll", { jar: sup, body: { employeeId: eid, month: 13, year: 2026 } })).status === 400, "payroll bad month 400");
      ok((await req("POST", "/api/portal/r/payroll", { jar: sup, body: { employeeId: "00000000-0000-0000-0000-000000000000", month: 5, year: 2026 } })).status === 404, "payroll bogus employee 404");
      const pr = await req("POST", "/api/portal/r/payroll", { jar: sup, body: { employeeId: eid, month: 5, year: 2026, lopDays: 2, allowances: 2000, otherDeductions: 500 } });
      // May 2026 has 31 calendar days: per-day 30000/31, LOP 2d → 1935.48, net 30000−1935.48+2000−500 = 29564.52
      ok(pr.status === 200 && (pr.json as { data: { netPayable?: number } }).data?.netPayable === 29564.52, "payroll net 29564.52 (31-day month)", pr.text);
      const rid = (pr.json as { data: { id: string } }).data.id;
      const slip = await req("GET", `/api/portal/payslip/${rid}`, { jar: sup });
      ok(slip.status === 200 && !!(slip.json as { record?: unknown })?.record, "payslip 200", slip.status);
      ok((await req("GET", "/api/portal/payslip/00000000-0000-0000-0000-000000000000", { jar: sup })).status === 404, "payslip bogus 404");
      const pp = await req("GET", "/api/portal/payroll?month=5&year=2026", { jar: sup });
      ok(pp.status === 200 && Array.isArray((pp.json as { records?: unknown[] }).records), "payroll page-data 200");
      ok((await req("DELETE", `/api/portal/r/payroll/${rid}`, { jar: sup })).status === 200, "payroll remove 200");
      ok((await req("DELETE", `/api/portal/r/employees/${eid}`, { jar: sup })).status === 200, "employee delete 200");
      const emp = await req("GET", "/api/portal/employees", { jar: sup });
      ok(emp.status === 200 && !!(emp.json as { entity?: string })?.entity, "employees page-data 200");

      // Entity separation test for HR:
      const rvbcEmp = await req("POST", "/api/portal/r/employees", { jar: sup, body: { entity: "RVBC", fullName: "RVBC Phlebotomist", designation: "Phlebotomist", department: "Laboratory", shiftSchedule: "Morning", contactNumber: "9000000045", monthlyFixedBaseSalary: 28000, isActive: true } });
      ok(rvbcEmp.status === 200, "rvbc employee create 200", rvbcEmp.text);
      const rvbcEid = (rvbcEmp.json as { data: { id: string } }).data.id;

      const rhList = await req("GET", "/api/portal/employees?entity=RITHANYA_HOSPITAL", { jar: sup });
      const rvbcList = await req("GET", "/api/portal/employees?entity=RVBC", { jar: sup });
      ok(rhList.status === 200 && !(rhList.json as { items: Array<{ id: string }> }).items.some((e) => e.id === rvbcEid), "RH employee list does not include RVBC employee");
      ok(rvbcList.status === 200 && (rvbcList.json as { items: Array<{ id: string }> }).items.some((e) => e.id === rvbcEid), "RVBC employee list includes RVBC employee");

      await req("DELETE", `/api/portal/r/employees/${rvbcEid}`, { jar: sup });
    }

    /* ---------- portal: finance ---------- */
    {
      const cat = await req("POST", "/api/portal/r/expense-categories", { jar: sup, body: { name: `E2E Fin ${Date.now()}` } });
      ok(cat.status === 200, "expense-category create 200", cat.text);
      const catId = (cat.json as { data: { id: string } }).data.id;
      ok((await req("POST", "/api/portal/r/expense-categories", { jar: sup, body: { name: "Patient Billing" } })).status === 409, "expense-category duplicate 409");
      const bad = await req("POST", "/api/portal/r/ledger", { jar: sup, body: { type: "DEBIT", itemName: "x", vendorPayee: "y", amount: 0, method: "Cash" } });
      ok(bad.status === 400, "ledger zero amount 400", bad.text);
      const le = await req("POST", "/api/portal/r/ledger", { jar: sup, body: { type: "DEBIT", itemName: "E2E supplies", vendorPayee: "E2E vendor", amount: 1250.5, method: "UPI", categoryId: catId } });
      ok(le.status === 200, "ledger create 200", le.text);
      const leid = (le.json as { data: { id: string } }).data.id;
      ok((await req("PUT", `/api/portal/r/ledger/${leid}`, { jar: sup, body: { type: "DEBIT", itemName: "E2E supplies v2", vendorPayee: "E2E vendor", amount: 1300, method: "Cash", categoryId: catId } })).status === 200, "ledger update 200");
      ok((await req("DELETE", `/api/portal/r/ledger/${leid}`, { jar: sup })).status === 200, "ledger delete 200");
      ok((await req("DELETE", `/api/portal/r/expense-categories/${catId}`, { jar: sup })).status === 200, "expense-category delete 200");
      const ov = await req("GET", "/api/portal/finance-overview", { jar: sup });
      ok(ov.status === 200 && !!(ov.json as { totals?: unknown })?.totals && Array.isArray((ov.json as { months?: unknown[] })?.months), "finance-overview 200", ov.status);
      const lg = await req("GET", "/api/portal/ledger", { jar: sup });
      ok(lg.status === 200 && Array.isArray((lg.json as { items?: unknown[] })?.items), "ledger page-data 200");

      // Entity separation test for Finance:
      const rvbcCat = await req("POST", "/api/portal/r/expense-categories", { jar: sup, body: { entity: "RVBC", name: `RVBC Test Cat ${Date.now()}` } });
      ok(rvbcCat.status === 200, "rvbc expense-category create 200", rvbcCat.text);
      const rvbcCatId = (rvbcCat.json as { data: { id: string } }).data.id;

      const rvbcLedger = await req("POST", "/api/portal/r/ledger", { jar: sup, body: { entity: "RVBC", type: "CREDIT", itemName: "Blood Camp Grant", vendorPayee: "Govt Health Board", amount: 50000, method: "NEFT", categoryId: rvbcCatId } });
      ok(rvbcLedger.status === 200, "rvbc ledger create 200", rvbcLedger.text);
      const rvbcLedgerId = (rvbcLedger.json as { data: { id: string } }).data.id;

      const rhLedgerList = await req("GET", "/api/portal/ledger?entity=RITHANYA_HOSPITAL", { jar: sup });
      const rvbcLedgerList = await req("GET", "/api/portal/ledger?entity=RVBC", { jar: sup });
      ok(rhLedgerList.status === 200 && !(rhLedgerList.json as { items: Array<{ id: string }> }).items.some((i) => i.id === rvbcLedgerId), "RH ledger does not leak RVBC entries");
      ok(rvbcLedgerList.status === 200 && (rvbcLedgerList.json as { items: Array<{ id: string }> }).items.some((i) => i.id === rvbcLedgerId), "RVBC ledger includes RVBC entries");

      const rhFin = await req("GET", "/api/portal/finance-overview?entity=RITHANYA_HOSPITAL", { jar: sup });
      const rvbcFin = await req("GET", "/api/portal/finance-overview?entity=RVBC", { jar: sup });
      ok(rhFin.status === 200 && rvbcFin.status === 200, "finance overview scoped for both entities 200");
      ok((rvbcFin.json as { totals: { credit: number } }).totals.credit >= 50000, "RVBC finance overview reflects RVBC credit");

      await req("DELETE", `/api/portal/r/ledger/${rvbcLedgerId}`, { jar: sup });
      await req("DELETE", `/api/portal/r/expense-categories/${rvbcCatId}`, { jar: sup });
    }

    /* ---------- portal: users + permissions + settings + audit ---------- */
    {
      const uname = `e2e_${Date.now()}`;
      const short = await req("POST", "/api/portal/r/users", { jar: sup, body: { username: uname, email: `${uname}@x.com`, fullName: "E2E", role: "STAFF", password: "short" } });
      ok(short.status === 400, "user short pw 400", short.text);
      const created = await req("POST", "/api/portal/r/users", { jar: sup, body: { username: uname, email: `${uname}@x.com`, fullName: "E2E Temp", role: "STAFF", password: "TempPass@123" } });
      ok(created.status === 200, "user create 200", created.text);
      const uid = (created.json as { data: { id: string } }).data.id;
      ok((await req("POST", "/api/portal/r/users", { jar: sup, body: { username: uname, email: `other@x.com`, fullName: "Dup", role: "STAFF", password: "TempPass@123" } })).status === 409, "user duplicate 409");
      ok((await req("POST", "/api/portal/r/users", { jar: adm, body: { username: `${uname}2`, email: `${uname}2@x.com`, fullName: "X", role: "SUPERADMIN", password: "TempPass@123" } })).status === 403, "admin create superadmin 403");
      ok((await req("PUT", `/api/portal/r/users/${uid}`, { jar: sup, body: {} })).status === 200, "user noop update 200");
      const me = await req("GET", "/api/auth/me", { jar: sup });
      const myId = (me.json as { user: { id: string } }).user.id;
      ok((await req("PUT", `/api/portal/r/users/${myId}`, { jar: sup, body: { isActive: false } })).status === 400, "self deactivate 400");
      ok((await req("PUT", `/api/portal/r/users/${myId}`, { jar: sup, body: { role: "ADMIN" } })).status === 400, "self role change 400");
      ok((await req("DELETE", `/api/portal/r/users/${myId}`, { jar: sup })).status === 400, "self delete 400");
      const users = await req("GET", "/api/portal/users", { jar: sup });
      ok(users.status === 200 && !JSON.stringify(users.json).includes("passwordHash"), "users list hides hashes");
      const pm = await req("PUT", `/api/portal/r/permissions/${uid}`, { jar: sup, body: { modules: { emr: true, cms: true } } });
      ok(pm.status === 200, "permissions update 200", pm.text);
      ok((await req("PUT", `/api/portal/r/permissions/${myId}`, { jar: sup, body: { modules: {} } })).status === 403, "self permissions 403");
      ok((await req("PUT", `/api/portal/r/permissions/${uid}`, { jar: adm, body: { modules: {} } })).status === 200, "admin permissions staff 200");
      ok((await req("DELETE", `/api/portal/r/users/${uid}`, { jar: sup })).status === 200, "user delete 200");
      ok((await req("PUT", "/api/portal/r/settings/x", { jar: sup, body: {} })).status === 400, "settings empty 400");
      ok((await req("PUT", "/api/portal/r/settings/x", { jar: sup, body: { canonicalUrl: "not-a-url" } })).status === 400, "settings bad url 400");
      ok((await req("PUT", "/api/portal/r/settings/x", { jar: sup, body: { noticeBanner: "E2E banner — all systems verified" } })).status === 200, "settings update 200");
      const pub = await req("GET", "/api/public/settings");
      ok((pub.json as { settings: { noticeBanner: string } }).settings.noticeBanner === "E2E banner — all systems verified", "settings reflected publicly");
      await req("PUT", "/api/portal/r/settings/x", { jar: sup, body: { noticeBanner: "Thalassemia & Sickle Cell daycare transfusions run by appointment — please call ahead so a bed and matched blood are ready for you." } });
      const perms = await req("GET", "/api/portal/permissions", { jar: sup });
      ok(perms.status === 200 && Array.isArray((perms.json as { items: unknown[] }).items), "permissions list 200");
      const audit = await req("GET", "/api/portal/audit-logs", { jar: sup });
      ok(audit.status === 200 && ((audit.json as { items: unknown[] }).items.length > 20), "audit logs growing", (audit.json as { items: unknown[] }).items?.length);
      const dash = await req("GET", "/api/portal/dashboard", { jar: sup });
      ok(dash.status === 200 && typeof (dash.json as { stats: { patients: number } }).stats?.patients === "number", "dashboard shape 200");
      const pats = await req("GET", "/api/portal/patients?archived=1&discharged=1", { jar: sup });
      ok(pats.status === 200 && Array.isArray((pats.json as { patients: unknown[] }).patients), "patients archived filter 200");
    }

    console.log(`\n[e2e] ${pass} passed, ${fail} failed`);
    if (fail > 0) {
      console.error("[e2e] FAILURES:\n - " + failures.join("\n - "));
      process.exitCode = 1;
    }
  } finally {
    child.kill();
    for (const f of cleanupUploads) {
      try {
        await fs.rm(path.join(SERVER_DIR, f), { force: true });
      } catch { /* ignore */ }
    }
  }
}

main().catch((e) => {
  console.error("[e2e] fatal", e);
  process.exit(1);
});
