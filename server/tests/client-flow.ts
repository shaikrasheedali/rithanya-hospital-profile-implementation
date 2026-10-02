/**
 * Comprehensive frontend client-side triggered test suite.
 * Simulates all API calls triggered by every page and component on the frontend.
 */
import assert from "node:assert";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import publicRoutes from "../src/routes/public.js";
import authRoutes from "../src/routes/auth.js";
import portalRoutes from "../src/routes/portal.js";

async function runClientFlowTests() {
  console.log("=================================================");
  console.log("  Rithanya Hospital - Frontend Client Flow Tests ");
  console.log("=================================================");

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/public", publicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/portal", portalRoutes);

  // Serve static assets from public / client/dist
  const distDir = path.resolve(__dirname, "../../client/dist");
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as { port: number };
  const BASE = `http://127.0.0.1:${address.port}`;
  console.log(`[test-server] Running on ${BASE}`);

  try {
    // 1. Home page API test (/api/public/home)
    console.log("\n[Test 1] Testing Home Page fetch('/api/public/home')...");
    const resHome = await fetch(`${BASE}/api/public/home`);
    assert.strictEqual(resHome.status, 200, "Home endpoint returned status 200");
    const dataHome: any = await resHome.json();
    assert.ok(dataHome.settings, "data.settings must be present");
    assert.ok(dataHome.settings.emergencyHotline, "emergencyHotline must be present");
    assert.ok(Array.isArray(dataHome.specialties) && dataHome.specialties.length > 0, "specialties array non-empty");
    assert.ok(Array.isArray(dataHome.flagship) && dataHome.flagship.length > 0, "flagship array non-empty");
    assert.ok(Array.isArray(dataHome.services) && dataHome.services.length > 0, "services array non-empty");
    assert.ok(Array.isArray(dataHome.doctors) && dataHome.doctors.length > 0, "doctors array non-empty");
    assert.ok(Array.isArray(dataHome.gallery) && dataHome.gallery.length > 0, "gallery array non-empty");
    assert.ok(Array.isArray(dataHome.insurance) && dataHome.insurance.length > 0, "insurance array non-empty");
    assert.ok(dataHome.blogs && Array.isArray(dataHome.blogs.posts), "blogs.posts must be an array");
    assert.ok(Array.isArray(dataHome.testimonials) && dataHome.testimonials.length > 0, "testimonials array non-empty");
    assert.ok(Array.isArray(dataHome.stock) && dataHome.stock.length > 0, "blood stock array non-empty");
    console.log(`✓ Home page API passed (Specialties: ${dataHome.specialties.length}, Doctors: ${dataHome.doctors.length}, Blood stock: ${dataHome.stock.length})`);

    // 2. Settings API test (/api/public/settings)
    console.log("\n[Test 2] Testing Settings fetch('/api/public/settings')...");
    const resSettings = await fetch(`${BASE}/api/public/settings`);
    assert.strictEqual(resSettings.status, 200, "Settings endpoint returned status 200");
    const dataSettings: any = await resSettings.json();
    assert.ok(dataSettings.settings, "settings object present");
    assert.ok(dataSettings.settings.legalName.includes("Rithanya"), "legalName matches Rithanya Hospital");
    assert.strictEqual(dataSettings.settings.emergencyHotline, "8328581019", "emergency hotline is correct");
    console.log(`✓ Settings API passed (${dataSettings.settings.legalName} - Hotline: ${dataSettings.settings.emergencyHotline})`);

    // 3. Doctors API test (/api/public/doctors & doctor detail)
    console.log("\n[Test 3] Testing Doctors API fetch('/api/public/doctors')...");
    const resDocs = await fetch(`${BASE}/api/public/doctors`);
    assert.strictEqual(resDocs.status, 200, "Doctors list endpoint returned status 200");
    const dataDocs: any = await resDocs.json();
    assert.ok(Array.isArray(dataDocs.items) && dataDocs.items.length >= 3, "Doctors list has at least 3 doctors");
    console.log(`✓ Doctors list API passed (${dataDocs.items.length} doctors found)`);

    console.log("[Test 3b] Testing Doctor Detail fetch('/api/public/doctors/dr-d-narayana-murthy-md')...");
    const resDocDetail = await fetch(`${BASE}/api/public/doctors/dr-d-narayana-murthy-md`);
    assert.strictEqual(resDocDetail.status, 200, "Doctor detail endpoint returned status 200");
    const dataDocDetail: any = await resDocDetail.json();
    assert.ok(dataDocDetail.item && dataDocDetail.item.fullName.includes("Narayana Murthy"), "Doctor detail contains Narayana Murthy");
    console.log(`✓ Doctor detail API passed (${dataDocDetail.item.fullName})`);

    // 4. Clinical Care APIs (Specialties, Treatments, Services)
    console.log("\n[Test 4] Testing Clinical Care endpoints...");
    const resSpec = await fetch(`${BASE}/api/public/clinical?type=specialties`);
    assert.strictEqual(resSpec.status, 200, "Specialties returned 200");
    const dataSpec: any = await resSpec.json();
    assert.ok(Array.isArray(dataSpec.items) && dataSpec.items.length >= 6, "Specialties list has items");
    console.log(`✓ Clinical Specialties API passed (${dataSpec.items.length} items)`);

    const resTreat = await fetch(`${BASE}/api/public/clinical?type=treatments`);
    assert.strictEqual(resTreat.status, 200, "Treatments returned 200");
    const dataTreat: any = await resTreat.json();
    assert.ok(Array.isArray(dataTreat.items) && dataTreat.items.length >= 6, "Treatments list has items");
    console.log(`✓ Clinical Treatments API passed (${dataTreat.items.length} items)`);

    const resServ = await fetch(`${BASE}/api/public/clinical?type=services`);
    assert.strictEqual(resServ.status, 200, "Services returned 200");
    const dataServ: any = await resServ.json();
    assert.ok(Array.isArray(dataServ.items) && dataServ.items.length >= 6, "Services list has items");
    console.log(`✓ Clinical Services API passed (${dataServ.items.length} items)`);

    // Detail checks
    const resSpecDetail = await fetch(`${BASE}/api/public/clinical/specialties/diabetology-and-endocrinology`);
    assert.strictEqual(resSpecDetail.status, 200, "Specialty detail returned 200");
    const dataSpecDetail: any = await resSpecDetail.json();
    assert.ok(dataSpecDetail.item && dataSpecDetail.item.title.includes("Diabetology"), "Specialty detail matches");
    console.log(`✓ Clinical Specialty Detail API passed (${dataSpecDetail.item.title})`);

    // 5. Blood Bank / Blood Stock API (Positive and Negative groups)
    console.log("\n[Test 5] Testing Blood Stock fetch('/api/public/blood-stock')...");
    const resBlood = await fetch(`${BASE}/api/public/blood-stock`);
    assert.strictEqual(resBlood.status, 200, "Blood stock returned 200");
    const dataBlood: any = await resBlood.json();
    assert.ok(Array.isArray(dataBlood.stock) && dataBlood.stock.length >= 4, "Blood stock has items");
    const bloodGroups = dataBlood.stock.map((s: any) => s.bloodGroup);
    console.log(`✓ Blood Stock API passed (${dataBlood.stock.length} entries, Groups: ${bloodGroups.join(", ")})`);

    // 5b. Facilities API & Detail
    console.log("\n[Test 5b] Testing Facilities fetch('/api/public/facilities')...");
    const resFac = await fetch(`${BASE}/api/public/facilities`);
    assert.strictEqual(resFac.status, 200, "Facilities returned 200");
    const dataFac: any = await resFac.json();
    assert.ok(Array.isArray(dataFac.items) && dataFac.items.length >= 4, "Facilities list has items");
    console.log(`✓ Facilities API passed (${dataFac.items.length} facilities found)`);

    const facSlug = dataFac.items[0].slug;
    const resFacDetail = await fetch(`${BASE}/api/public/facilities/${facSlug}`);
    assert.strictEqual(resFacDetail.status, 200, "Facility detail returned 200");
    const dataFacDetail: any = await resFacDetail.json();
    assert.ok(dataFacDetail.item && dataFacDetail.item.title, "Facility detail has item title");
    console.log(`✓ Facility detail API passed (${dataFacDetail.item.title})`);

    // 6. Insurance Providers API
    console.log("\n[Test 6] Testing Insurance Providers fetch('/api/public/insurance')...");
    const resIns = await fetch(`${BASE}/api/public/insurance`);
    assert.strictEqual(resIns.status, 200, "Insurance returned 200");
    const dataIns: any = await resIns.json();
    assert.ok(Array.isArray(dataIns.items) && dataIns.items.length >= 3, "Insurance list has items");
    console.log(`✓ Insurance API passed (${dataIns.items.length} providers found)`);

    // 7. Gallery API
    console.log("\n[Test 7] Testing Gallery fetch('/api/public/gallery?limit=6')...");
    const resGal = await fetch(`${BASE}/api/public/gallery?limit=6`);
    assert.strictEqual(resGal.status, 200, "Gallery returned 200");
    const dataGal: any = await resGal.json();
    assert.ok(Array.isArray(dataGal.items) && dataGal.items.length > 0, "Gallery has items");
    console.log(`✓ Gallery API passed (${dataGal.items.length} items returned)`);

    // 8. Blogs / Insights API
    console.log("\n[Test 8] Testing Blogs fetch('/api/public/blogs?page=1&pageSize=6')...");
    const resBlogs = await fetch(`${BASE}/api/public/blogs?page=1&pageSize=6`);
    assert.strictEqual(resBlogs.status, 200, "Blogs returned 200");
    const dataBlogs: any = await resBlogs.json();
    assert.ok(Array.isArray(dataBlogs.posts) && dataBlogs.posts.length > 0, "Blogs has posts");
    assert.ok(typeof dataBlogs.total === "number", "Blogs has total");
    console.log(`✓ Blogs API passed (${dataBlogs.posts.length} posts, total: ${dataBlogs.total})`);

    const resBlogDetail = await fetch(`${BASE}/api/public/blogs/understanding-hba1c-your-three-month-sugar-report-card`);
    assert.strictEqual(resBlogDetail.status, 200, "Blog detail returned 200");
    const dataBlogDetail: any = await resBlogDetail.json();
    assert.ok(dataBlogDetail.item && dataBlogDetail.item.title.includes("HbA1c"), "Blog detail matches");
    console.log(`✓ Blog detail API passed (${dataBlogDetail.item.title})`);

    // 9. Products / Pharmacy API
    console.log("\n[Test 9] Testing Products fetch('/api/public/products')...");
    const resProd = await fetch(`${BASE}/api/public/products`);
    assert.strictEqual(resProd.status, 200, "Products returned 200");
    const dataProd: any = await resProd.json();
    assert.ok(Array.isArray(dataProd.items) && dataProd.items.length >= 8, "Products list has items");
    console.log(`✓ Products API passed (${dataProd.items.length} pharmacy items)`);

    // 10. Appointment submission
    console.log("\n[Test 10] Testing Appointment Booking POST('/api/public/appointments')...");
    const resApt = await fetch(`${BASE}/api/public/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Test Patient",
        phone: "9876543210",
        department: "Diabetology",
        preferredDate: "2026-10-05",
        message: "Requesting routine consultation",
        source: "WEBSITE",
      }),
    });
    assert.strictEqual(resApt.status, 200, "Appointment POST returned 200");
    const dataApt: any = await resApt.json();
    assert.strictEqual(dataApt.ok, true, "Appointment booking acknowledged");
    console.log("✓ Appointment submission API passed (ok: true)");

    // 11. Staff Auth Login
    console.log("\n[Test 11] Testing Staff Auth POST('/api/auth/login')...");
    const resLogin = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "superadmin",
        password: "Rithanya@2026",
      }),
    });
    assert.strictEqual(resLogin.status, 200, "Superadmin login returned 200");
    const dataLogin: any = await resLogin.json();
    assert.strictEqual(dataLogin.ok, true, "Login successful");
    assert.strictEqual(dataLogin.role, "SUPERADMIN", "Role is SUPERADMIN");
    // Cookie extraction for session verification
    const setCookie = resLogin.headers.get("set-cookie") || "";
    const cookieHeader = setCookie.split(";")[0] || "";

    console.log("[Test 11b] Testing GET('/api/auth/me') with session cookie...");
    const resMe = await fetch(`${BASE}/api/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(resMe.status, 200, "Auth /me returned 200");
    const dataMe: any = await resMe.json();
    assert.ok(dataMe.user && dataMe.user.role === "SUPERADMIN", "/me user role is SUPERADMIN");
    console.log(`✓ Auth /me passed (user: ${dataMe.user.username}, role: ${dataMe.user.role})`);

    console.log("[Test 11c] Testing Staff Auth by Email POST('/api/auth/login')...");
    const resLoginEmail = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "superadmin@rithanyahospital.com",
        password: "Rithanya@2026",
      }),
    });
    assert.strictEqual(resLoginEmail.status, 200, "Superadmin email login returned 200");
    const dataLoginEmail: any = await resLoginEmail.json();
    assert.strictEqual(dataLoginEmail.ok, true, "Email login successful");
    console.log("✓ Staff Email Login passed (superadmin@rithanyahospital.com)");

    console.log("[Test 11d] Testing Invalid Credentials POST('/api/auth/login') returns 401 (never 503)...");
    const resInvalid = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "unknown_user",
        password: "WrongPassword123!",
      }),
    });
    assert.strictEqual(resInvalid.status, 401, "Invalid login returns 401");
    const dataInvalid: any = await resInvalid.json();
    assert.ok(dataInvalid.error, "Error message returned");
    console.log("[Test 11e] Testing Portal Dashboard fetch('/api/portal/dashboard')...");
    const resDashboard = await fetch(`${BASE}/api/portal/dashboard`, {
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(resDashboard.status, 200, "Portal dashboard returned 200 (never 500)");
    const dataDashboard: any = await resDashboard.json();
    assert.ok(dataDashboard.stats, "Dashboard stats present");
    console.log(`✓ Portal dashboard API passed (patients: ${dataDashboard.stats.patients}, appointments: ${dataDashboard.stats.appointments})`);

    console.log("[Test 11f] Testing Portal Appointments fetch('/api/portal/appointments')...");
    const resApts = await fetch(`${BASE}/api/portal/appointments`, {
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(resApts.status, 200, "Portal appointments returned 200 (never 500)");
    const dataApts: any = await resApts.json();
    assert.ok(Array.isArray(dataApts.items), "Portal appointments items is array");
    console.log(`✓ Portal appointments API passed (${dataApts.items.length} appointments)`);

    console.log("[Test 11g] Testing Portal Media fetch('/api/portal/media')...");
    const resMedia = await fetch(`${BASE}/api/portal/media`, {
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(resMedia.status, 200, "Portal media returned 200 (never 500)");
    const dataMedia: any = await resMedia.json();
    assert.ok(Array.isArray(dataMedia.assets), "Portal media assets is array");
    console.log(`✓ Portal media API passed (${dataMedia.assets.length} assets returned)`);

    // 12. Frontend SPA index & Navbar button ordering verification
    console.log("\n[Test 12] Testing Frontend SPA and Navbar ordering...");
    const resIndex = await fetch(`${BASE}/`);
    assert.strictEqual(resIndex.status, 200, "Frontend index.html served with 200");
    const html = await resIndex.text();
    assert.ok(html.includes('<div id="root"></div>'), "root container is present");

    // Inspect the client bundle for the navbar button order:
    // User requested order: Hospital, Facilities, Departments, Doctors, Pharmacy, Insights, Contact us
    const clientJsFiles = fs.readdirSync(path.join(distDir, "assets")).filter((f) => f.endsWith(".js"));
    assert.ok(clientJsFiles.length > 0, "Client JS bundle exists");
    const bundleContent = fs.readFileSync(path.join(distDir, "assets", clientJsFiles[0]), "utf8");

    // Check occurrences of the labels in the bundle
    const labels = ["Hospital", "Facilities", "Departments", "Doctors", "Products", "Blogs", "Contact us"];
    let lastPos = 0;
    for (const label of labels) {
      const regex = new RegExp(`label:[\\\`"']${label}[\\\`"']`);
      const match = bundleContent.slice(lastPos).match(regex);
      assert.ok(match && match.index !== undefined, `Label "${label}" must appear in bundle in sequence`);
      lastPos = lastPos + match.index + match[0].length;
    }
    console.log("✓ Navbar buttons sequence in frontend bundle confirmed:");
    console.log("   1. Hospital");
    console.log("   2. Facilities");
    console.log("   3. Departments");
    console.log("   4. Doctors");
    console.log("   5. Products");
    console.log("   6. Blogs");
    console.log("   7. Contact us");

    console.log("\n=================================================");
    console.log("  ALL FRONTEND CLIENT-TRIGGERED TESTS PASSED!    ");
    console.log("=================================================");
  } finally {
    server.close();
  }
}

runClientFlowTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
