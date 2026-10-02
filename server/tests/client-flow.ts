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
import multer from "multer";
import sharp from "sharp";
import publicRoutes from "../src/routes/public.js";
import authRoutes from "../src/routes/auth.js";
import portalRoutes from "../src/routes/portal.js";
import mediaRoutes, { getSeedDir } from "../src/routes/media.js";

async function runClientFlowTests() {
  console.log("=================================================");
  console.log("  Rithanya Hospital - Frontend Client Flow Tests ");
  console.log("=================================================");

  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 130 * 1024 * 1024, files: 10 } });
  app.use("/api/portal/media", upload.array("files", 10));
  app.use("/api/public", publicRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/portal", portalRoutes);
  app.use("/api/media", mediaRoutes);

  const seedDir = getSeedDir();
  if (seedDir) {
    app.use("/seed", express.static(seedDir));
  }

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
    // Verify none of the asset IDs have 'disk-0-' or 'disk-\d+-' prefix
    for (const a of dataMedia.assets) {
      assert.ok(!a.id.startsWith("disk-"), `Asset id '${a.id}' must be clean filename, not disk- prefixed`);
    }
    console.log(`✓ Portal media API passed (${dataMedia.assets.length} assets returned, all IDs clean)`);

    // 11h. Update specialty spec-1 via CMS PUT (Testing user's exact issue scenario: saving an item with a disk-prefixed or clean image)
    console.log("\n[Test 11h] Testing CMS Item Update fetch('PUT /api/portal/cms/specialties/spec-1')...");
    const testDiskAsset = "disk-0-1790865049238-e905f64ce7895904.webp";
    const resUpdateSpec = await fetch(`${BASE}/api/portal/cms/specialties/spec-1`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        title: "Diabetology & Advanced Endocrinology Center",
        shortSummary: "Comprehensive care for Type 1, Type 2 and gestational diabetes with HbA1c screening.",
        contentHtml: "<p>Updated diabetology content with new protocols.</p>",
        sortOrder: 0,
        mediaIds: [testDiskAsset],
      }),
    });
    assert.strictEqual(resUpdateSpec.status, 200, "CMS PUT /api/portal/cms/specialties/spec-1 returned 200 (not 404)");
    const dataUpdateSpec: any = await resUpdateSpec.json();
    assert.strictEqual(dataUpdateSpec.ok, true, "Response indicated ok: true");
    console.log("✓ Updating spec-1 with disk asset succeeded with status 200");

    // 11h-2: Verify media resolution for spec-1
    console.log("[Test 11h-2] Testing media resolution of cover image on updated item...");
    const resPublicSpecCheck = await fetch(`${BASE}/api/public/clinical?type=specialties`);
    const dataPublicSpecCheck: any = await resPublicSpecCheck.json();
    const updatedSpecItem = dataPublicSpecCheck.items.find((x: any) => x.id === "spec-1");
    assert.ok(updatedSpecItem, "spec-1 must exist in public specialties");
    assert.ok(Array.isArray(updatedSpecItem.media) && updatedSpecItem.media.length > 0, "spec-1 has media");
    const coverMedia = updatedSpecItem.media[0];
    console.log(`✓ Resolved cover media url: ${coverMedia.url}`);
    assert.ok(!coverMedia.url.includes("disk-0-"), `Cover URL '${coverMedia.url}' must not include disk-0- prefix`);
    assert.ok(coverMedia.url.includes("1790865049238-e905f64ce7895904.webp"), "Cover URL includes target filename");

    // 11h-3: Direct GET request to legacy disk-prefixed URL (/api/media/disk-0-1790865049238-e905f64ce7895904.webp)
    console.log("[Test 11h-3] Testing GET /api/media/disk-0-... returns HTTP 200 (fixes user's 404 error)...");
    const resDiskPrefixed = await fetch(`${BASE}/api/media/${testDiskAsset}`);
    assert.strictEqual(resDiskPrefixed.status, 200, "GET disk-0- prefixed image URL returned 200 OK (NOT 404)");
    assert.strictEqual(resDiskPrefixed.headers.get("content-type"), "image/webp", "Content-Type is image/webp");
    const diskBuf = await resDiskPrefixed.arrayBuffer();
    assert.ok(diskBuf.byteLength > 1000, `Image content served (${diskBuf.byteLength} bytes)`);
    console.log(`✓ Direct fetch of /api/media/${testDiskAsset} passed with 200 OK (${diskBuf.byteLength} bytes)`);

    // 11h-4: Direct GET request to clean URL (/api/media/1790865049238-e905f64ce7895904.webp)
    console.log("[Test 11h-4] Testing GET /api/media/1790865049238-e905f64ce7895904.webp...");
    const resCleanMedia = await fetch(`${BASE}/api/media/1790865049238-e905f64ce7895904.webp`);
    assert.strictEqual(resCleanMedia.status, 200, "Clean media URL returned 200 OK");
    console.log("✓ Direct fetch of clean media URL returned 200 OK");

    // 11h-5: Direct GET request to seed media fallback (/api/media/disk-0-blood-bag.webp and /seed/blood-bag.webp)
    console.log("[Test 11h-5] Testing seed asset resolution & fallbacks...");
    const resSeedPrefixed = await fetch(`${BASE}/api/media/disk-0-blood-bag.webp`);
    assert.strictEqual(resSeedPrefixed.status, 200, "Seed asset with disk-0- prefix returned 200 OK");
    const resSeedDirect = await fetch(`${BASE}/seed/blood-bag.webp`);
    assert.strictEqual(resSeedDirect.status, 200, "Static /seed/blood-bag.webp returned 200 OK");
    console.log("✓ Seed assets & prefixed fallbacks passed with 200 OK");

    // 11i. Verify public API immediately reflects the updated spec-1 item
    console.log("[Test 11i] Testing Public Reflect for Updated Specialty...");
    const resPublicSpec = await fetch(`${BASE}/api/public/clinical?type=specialties`);
    assert.strictEqual(resPublicSpec.status, 200, "Clinical specialties returned 200");
    const dataPublicSpec: any = await resPublicSpec.json();
    const updatedSpec = dataPublicSpec.items.find((x: any) => x.id === "spec-1");
    assert.ok(updatedSpec, "Updated item spec-1 must exist in public list");
    assert.strictEqual(updatedSpec.title, "Diabetology & Advanced Endocrinology Center", "Public item title matches updated value");
    console.log(`✓ Public API immediately reflects updated item: "${updatedSpec.title}"`);

    // 11j. Test CMS Create: POST /api/portal/cms/specialties
    console.log("\n[Test 11j] Testing CMS Item Create fetch('POST /api/portal/cms/specialties')...");
    const resCreateSpec = await fetch(`${BASE}/api/portal/cms/specialties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        title: "Pediatric Hematology Care",
        shortSummary: "Dedicated care for childhood blood disorders.",
        contentHtml: "<p>Advanced pediatric hematology care.</p>",
        sortOrder: 99,
        mediaIds: [],
      }),
    });
    assert.strictEqual(resCreateSpec.status, 200, "CMS create item returned 200");
    const dataCreateSpec: any = await resCreateSpec.json();
    assert.strictEqual(dataCreateSpec.ok, true, "Create item ok is true");
    const createdId = dataCreateSpec.item?.id;
    console.log(`✓ CMS create item passed (created id: ${createdId})`);

    // 11k. Test CMS Delete: DELETE /api/portal/cms/specialties/:id
    console.log("[Test 11k] Testing CMS Item Delete fetch('DELETE /api/portal/cms/specialties/:id')...");
    const resDeleteSpec = await fetch(`${BASE}/api/portal/cms/specialties/${createdId}`, {
      method: "DELETE",
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(resDeleteSpec.status, 200, "CMS delete item returned 200");
    const dataDeleteSpec: any = await resDeleteSpec.json();
    assert.strictEqual(dataDeleteSpec.ok, true, "Delete item ok is true");
    console.log("✓ CMS delete item passed");

    // =========================================================================
    // Test 13: USER WORKFLOW: Upload an Image and Use it as Cover in a New Facility Item
    // =========================================================================
    console.log("\n[Test 13] USER WORKFLOW: Upload Image & Create New Facility with Cover...");
    const sampleWebp = await sharp({
      create: { width: 400, height: 300, channels: 4, background: { r: 10, g: 37, b: 64, alpha: 1 } },
    })
      .webp({ quality: 80, effort: 2 })
      .toBuffer();

    const uploadFormData = new FormData();
    uploadFormData.append("files", new Blob([sampleWebp], { type: "image/webp" }), "emergency-trauma-wing.webp");

    const tUploadStart = performance.now();
    const resUploadImage = await fetch(`${BASE}/api/portal/media`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
      body: uploadFormData,
    });
    const tUploadEnd = performance.now();
    const uploadDuration = Math.round(tUploadEnd - tUploadStart);
    assert.strictEqual(resUploadImage.status, 200, "Image upload returned 200 OK");
    const dataUpload: any = await resUploadImage.json();
    assert.ok(Array.isArray(dataUpload.assets) && dataUpload.assets.length > 0, "Uploaded asset returned");
    const uploadedAsset = dataUpload.assets[0];
    assert.ok(uploadedAsset.id, "Asset has id");
    assert.ok(uploadedAsset.url.startsWith("/api/media/"), "Asset URL is valid /api/media/ URL");
    console.log(`✓ Image uploaded in ${uploadDuration}ms (blazing fast): ${uploadedAsset.filename}`);

    // Create a new facility item using the uploaded image as cover
    console.log("[Test 13b] Creating new facility item with uploaded cover image...");
    const facilityPayload = {
      title: "24/7 Advanced Trauma & Critical Care Center",
      shortSummary: "State of the art trauma center with 24/7 emergency resuscitation and ICU beds.",
      contentHtml: "<p>Fully equipped trauma response wing with advanced monitors and oxygen supply.</p>",
      sortOrder: 1,
      mediaIds: [uploadedAsset.id],
    };

    const resCreateFac = await fetch(`${BASE}/api/portal/cms/facilities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify(facilityPayload),
    });
    assert.strictEqual(resCreateFac.status, 200, "Facility create returned 200 OK");
    const dataCreateFac: any = await resCreateFac.json();
    assert.strictEqual(dataCreateFac.ok, true, "Facility creation acknowledged ok: true");
    const createdFacility = dataCreateFac.item;
    assert.ok(createdFacility && createdFacility.id, "Created facility has valid id");
    assert.ok(Array.isArray(createdFacility.media) && createdFacility.media.length > 0, "Created facility has media attached");
    assert.ok(!createdFacility.media[0].url.includes("disk-0-"), "Cover URL must not have disk-0- prefix");
    console.log(`✓ Facility created with ID: ${createdFacility.id} and Cover URL: ${createdFacility.media[0].url}`);

    // Verify the cover image loads via direct HTTP GET
    console.log("[Test 13c] Verifying the newly created facility's cover image loads via HTTP GET...");
    const resVerifyCover = await fetch(`${BASE}${createdFacility.media[0].url}`);
    assert.strictEqual(resVerifyCover.status, 200, "Cover image loaded with 200 OK");
    const coverBuf = await resVerifyCover.arrayBuffer();
    assert.ok(coverBuf.byteLength > 100, "Cover image content is valid");
    console.log(`✓ Cover image loaded successfully (${coverBuf.byteLength} bytes)`);

    // Verify the facility appears on the public website with the cover image
    console.log("[Test 13d] Verifying new facility is visible on public website...");
    const resPublicFac = await fetch(`${BASE}/api/public/facilities`);
    assert.strictEqual(resPublicFac.status, 200, "Public facilities returned 200");
    const dataPublicFac: any = await resPublicFac.json();
    const foundPublicFac = dataPublicFac.items.find((f: any) => f.id === createdFacility.id || f.title.includes("24/7 Advanced Trauma"));
    assert.ok(foundPublicFac, "New facility must be present in public facilities API");
    assert.ok(foundPublicFac.media && foundPublicFac.media.length > 0, "Public facility has cover media");
    console.log(`✓ Public website displays new facility with cover: "${foundPublicFac.title}"`);

    // Test updating the facility cover / content
    console.log("[Test 13e] Updating facility item via PUT /api/portal/cms/facilities/:id...");
    const resUpdateFac = await fetch(`${BASE}/api/portal/cms/facilities/${createdFacility.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        ...facilityPayload,
        title: "24/7 Advanced Emergency & Multi-Specialty Trauma Care Center",
        sortOrder: 0,
      }),
    });
    assert.strictEqual(resUpdateFac.status, 200, "Facility update returned 200 OK");
    const dataUpdateFac: any = await resUpdateFac.json();
    assert.strictEqual(dataUpdateFac.ok, true, "Facility update acknowledged");
    console.log("✓ Facility item updated successfully");

    // Clean up created facility item
    console.log("[Test 13f] Cleaning up created test facility via DELETE...");
    const resDeleteFac = await fetch(`${BASE}/api/portal/cms/facilities/${createdFacility.id}`, {
      method: "DELETE",
      headers: { Cookie: cookieHeader },
    });
    assert.strictEqual(resDeleteFac.status, 200, "Facility deleted with 200 OK");
    console.log("✓ Facility deleted successfully (User workflow 1 fully validated!)");

    // =========================================================================
    // Test 14: Thorough Verification of ALL Admin Dashboard Pages & Desks
    // =========================================================================
    console.log("\n[Test 14] Thorough Verification of ALL Admin Dashboard Pages & Desks...");
    const portalPages = [
      { name: "Dashboard Overview", url: "/api/portal/dashboard" },
      { name: "Appointments Desk", url: "/api/portal/appointments" },
      { name: "EMR Inpatients", url: "/api/portal/patients?type=INPATIENT" },
      { name: "EMR Outpatients", url: "/api/portal/patients?type=OUTPATIENT" },
      { name: "EMR Discharged", url: "/api/portal/patients?discharged=true" },
      { name: "Clinical Categories", url: "/api/portal/r/categories" },
      { name: "Blood Bank", url: "/api/portal/blood-stock" },
      { name: "Store Products", url: "/api/portal/cms/products" },
      { name: "Store Orders", url: "/api/portal/orders" },
      { name: "HR Employees", url: "/api/portal/employees" },
      { name: "HR Payroll", url: "/api/portal/payroll?month=10&year=2026" },
      { name: "Finance Categories", url: "/api/portal/expense-categories" },
      { name: "Finance Ledger", url: "/api/portal/ledger" },
      { name: "Finance Overview", url: "/api/portal/finance-overview" },
      { name: "Compliance DPDP", url: "/api/portal/dpdp-requests" },
      { name: "Access Users", url: "/api/portal/users" },
      { name: "Access Permissions", url: "/api/portal/permissions" },
      { name: "Settings Master", url: "/api/portal/settings" },
      { name: "Settings Audit Logs", url: "/api/portal/audit-logs" },
      { name: "CMS Facilities", url: "/api/portal/cms/facilities" },
      { name: "CMS Specialties", url: "/api/portal/cms/specialties" },
      { name: "CMS Treatments", url: "/api/portal/cms/treatments" },
      { name: "CMS Services", url: "/api/portal/cms/services" },
      { name: "CMS Doctors", url: "/api/portal/cms/doctors" },
      { name: "CMS Insurance", url: "/api/portal/cms/insurance" },
      { name: "CMS Gallery", url: "/api/portal/cms/gallery" },
      { name: "CMS Blogs", url: "/api/portal/cms/blogs" },
      { name: "CMS Testimonials", url: "/api/portal/cms/testimonials" },
      { name: "Media Assets Desk", url: "/api/portal/media" },
    ];

    for (const page of portalPages) {
      const tStart = performance.now();
      const resPage = await fetch(`${BASE}${page.url}`, {
        headers: { Cookie: cookieHeader },
      });
      const tEnd = performance.now();
      const pageLatency = Math.round(tEnd - tStart);
      assert.strictEqual(resPage.status, 200, `Page desk [${page.name}] must respond with 200 OK`);
      const body = await resPage.json();
      assert.ok(body !== null && typeof body === "object", `Page desk [${page.name}] returns valid object`);
      console.log(`  ✓ Desk [${page.name}]: 200 OK (${pageLatency}ms)`);
    }
    console.log("✓ All 29 Portal Desks and Pages responded with 200 OK and valid data!");

    // 11l. Performance & Throughput Benchmark (/api/public/home)
    console.log("\n[Test 11l] Benchmarking Public Home Response Latency...");
    const t0 = performance.now();
    const resBench = await fetch(`${BASE}/api/public/home`);
    const t1 = performance.now();
    assert.strictEqual(resBench.status, 200, "Home endpoint returned 200");
    const latency = Math.round(t1 - t0);
    console.log(`✓ Home page response latency: ${latency}ms (blazing fast near real-time performance)`);
    assert.ok(latency < 100, `Latency must be < 100ms (was ${latency}ms)`);
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
