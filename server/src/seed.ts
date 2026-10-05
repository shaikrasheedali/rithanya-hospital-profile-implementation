import fs from "node:fs/promises";
import path from "node:path";
import { prisma, isDbOnCooldown, reportDbError, withDbTimeout } from "./db.js";
import { hashPassword, computeModules } from "./auth.js";
import { encryptField, encryptJson } from "./crypto.js";
import { setEntityMedia, registerAssetInMemory, type EntityType } from "./media.js";
import { DEFAULT_SETTINGS } from "./settings.js";
import { slugify } from "./utils.js";
import {
  FALLBACK_SPECIALTIES,
  FALLBACK_SERVICES,
  FALLBACK_TREATMENTS,
  FALLBACK_FACILITIES,
} from "./fallbackData.js";

function seedDirCandidate(): string {
  // Prefer original Next.js public/seed if present (sibling project), else local assets.
  const candidates = [
    path.join(process.cwd(), "public", "seed"),
    path.join(process.cwd(), "..", "..", "public", "seed"),
    path.join(process.cwd(), "..", "rithanya-hospital-profile-implementation", "public", "seed"),
  ];
  return candidates[0];
}

const FILES: Array<[string, "IMAGE" | "VIDEO"]> = [
  ...[
    "hospital-corridor", "hospital-wheelchair", "doctor-consult", "doctor-exam", "doctor-vitals", "doctor-sitting",
    "blood-donation", "blood-bag", "blood-beds", "glucose-finger", "glucose-strips", "glucose-meter", "lab-microscope",
    "lab-woman", "lab-notes", "pharmacy-shelves", "pharmacy-bottle", "pharmacy-counter", "nurse-injection", "nurse-bp",
    "nurse-care", "ward-exam", "logo-pmjay", "logo-aarogyasri", "logo-tpa",
    "rithanya-hospital-khammam-building-exterior-signboard",
    "rithanya-hospital-khammam-main-entrance-reception",
    "rithanya-hospital-khammam-outpatient-waiting-area-registration",
    "rithanya-hospital-khammam-doctor-consulting-patient",
    "rithanya-hospital-khammam-doctor-in-consultation-room",
    "rithanya-hospital-khammam-surgeon-reviewing-xray-reports",
    "rithanya-hospital-khammam-child-gifted-plant-with-doctor",
    "rithanya-hospital-khammam-childrens-day-celebration-group-photo",
    "rithanya-hospital-khammam-health-camp-registration-desk",
    "rithanya-hospital-khammam-rotary-blood-donation-camp-stage",
    "rithanya-hospital-khammam-blood-bank-officials-donor-registration",
    "rithanya-hospital-khammam-blood-donation-couch-donor",
    "rithanya-hospital-khammam-blood-donation-banner-awareness",
    "rithanya-hospital-khammam-thalassemia-camp-chief-guest-stage",
    "rithanya-hospital-khammam-newspaper-eenadu-thalassemia-transfusion-camp",
    "rithanya-hospital-khammam-newspaper-surya-world-thalassemia-day",
    "rithanya-hospital-khammam-newspaper-bhadrachalam-camp-blood-transfusion",
    "rithanya-hospital-khammam-newspaper-district-blood-donation-awareness",
    "rithanya-hospital-khammam-newspaper-blood-donation-camp-coverage",
    "rithanya-hospital-khammam-newspaper-thalassemia-society-appreciation",
    "rithanya-hospital-khammam-newspaper-pediatric-thalassemia-support",
    "rithanya-hospital-khammam-newspaper-rotary-club-blood-camp",
    "rithanya-hospital-khammam-newspaper-community-health-camp-report",
  ].map((n) => [`${n}.webp`, "IMAGE"] as [string, "IMAGE"]),
  ["clip-iv-drip.mp4", "VIDEO"],
];

async function seedMedia(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  // Ensure local seed dir exists; if original assets are missing we create lightweight placeholders
  const localSeed = path.join(process.cwd(), "public", "seed");
  await fs.mkdir(localSeed, { recursive: true });
  for (const [file, kind] of FILES) {
    const srcCandidates = [
      path.join(process.cwd(), "public", "seed", file),
      path.join(process.cwd(), "server", "public", "seed", file),
      path.join(process.cwd(), "client", "public", "seed", file),
      path.resolve(__dirname, "..", "public", "seed", file),
      path.resolve(__dirname, "../..", "public", "seed", file),
      path.join(process.cwd(), "..", "rithanya-hospital-profile-implementation", "public", "seed", file),
      path.join("C:", "Users", "skras", "Downloads", "rithanya-hospital-profile-implementation", "public", "seed", file),
    ];
    let size = 0;
    let foundPath: string | null = null;
    for (const c of srcCandidates) {
      try {
        const st = await fs.stat(c);
        size = st.size;
        foundPath = c;
        break;
      } catch { /* ignore */ }
    }
    if (!foundPath) {
      // Create a tiny placeholder so seed never fails offline
      const placeholder = file.endsWith(".mp4")
        ? Buffer.from("placeholder-video")
        : Buffer.from(`placeholder-${file}`);
      try {
        await fs.writeFile(path.join(localSeed, file), placeholder);
        size = placeholder.length;
        foundPath = path.join(localSeed, file);
      } catch { continue; }
    } else if (!foundPath.startsWith(localSeed)) {
      try {
        const buf = await fs.readFile(foundPath);
        await fs.writeFile(path.join(localSeed, file), buf);
        size = buf.length;
      } catch { /* ignore */ }
    }
    const filename = `seed-${file}`;
    const url = `/seed/${file}`;
    const row = await prisma.mediaAsset.upsert({
      where: { filename },
      create: {
        filename,
        originalName: file,
        mimeType: kind === "VIDEO" ? "video/mp4" : "image/webp",
        kind,
        sizeInBytes: size,
        url,
      },
      update: { sizeInBytes: size },
    });
    registerAssetInMemory(row as any);
    ids[file.replace(/\.(webp|mp4)$/, "")] = row.id;
  }
  return ids;
}

const p = (t: string) => `<p>${t}</p>`;
const ul = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const h = (t: string) => `<h2>${t}</h2>`;

async function put(
  create: (v: Record<string, unknown>) => Promise<{ id: string }>,
  type: EntityType,
  rows: Array<{ v: Record<string, unknown>; media: string[] }>,
  slugKey?: string,
) {
  let i = 0;
  for (const r of rows) {
    const values: Record<string, unknown> = { sortOrder: i++, ...r.v };
    if (slugKey) values.slug = slugify(String(values[slugKey]));
    const mediaIds = r.media.filter(Boolean);
    const inserted = await create(values);
    if (mediaIds.length) await setEntityMedia(type, inserted.id, mediaIds);
    else {
      // Ensure at least the first available media is linked; fallback to any seeded asset
      const anyAsset = await prisma.mediaAsset.findFirst();
      if (anyAsset) await setEntityMedia(type, inserted.id, [anyAsset.id]);
    }
  }
}

export async function ensureBaseData() {
  if (isDbOnCooldown()) return;
  try {
    await withDbTimeout(
      prisma.hospitalSetting.upsert({
        where: { id: "PRIMARY_CONFIG" },
        create: { ...DEFAULT_SETTINGS, socialShareThumbnailUrl: "/seed/hospital-corridor.webp" },
        update: {},
      }),
      2500
    );
    const colors: Record<string, string> = { O: "SKY_BLUE", A: "YELLOW", B: "RED", AB: "WHITE" };
    const seedStock: Record<string, [number, number, string]> = {
      "O+": [14, 9, "O"],
      "O-": [8, 5, "O"],
      "A+": [11, 7, "A"],
      "A-": [6, 4, "A"],
      "B+": [9, 6, "B"],
      "B-": [5, 3, "B"],
      "AB+": [4, 3, "AB"],
      "AB-": [2, 2, "AB"],
      "O": [14, 9, "O"],
      "A": [11, 7, "A"],
      "B": [9, 6, "B"],
      "AB": [4, 3, "AB"],
    };
    for (const [g, [wb, pl, cat]] of Object.entries(seedStock)) {
      try {
        await withDbTimeout(
          prisma.bloodStock.upsert({
            where: { bloodGroup: g },
            create: { bloodGroup: g, groupCategory: cat, colorCode: colors[cat], wholeBloodUnits: wb, plasmaUnits: pl },
            update: {},
          }),
          1500
        );
      } catch {
        // ignore
      }
    }
  } catch (err) {
    reportDbError(err);
    console.warn("[seed] Database offline, skipping DB base data seed:", (err as Error)?.message || err);
  }
  void seedDirCandidate();
}

export async function ensureSeed() {
  if (isDbOnCooldown()) {
    console.log("[seed] Database is offline or on cooldown, using in-memory demo collections.");
    return;
  }
  try {
    await ensureBaseData();
    if (isDbOnCooldown()) return;
  console.log("[seed] Verifying demo accounts and content collections…");
  const m = await seedMedia();

  // 1. Demo accounts
  const accounts: Array<[string, string, string, "SUPERADMIN" | "ADMIN" | "STAFF", string]> = [
    ["superadmin", "mgrhameed@gmail.com", "Hospital Superadmin", "SUPERADMIN", "Hameed@2026"],
    ["admin", "admin@rithanyahospital.com", "Administration Desk", "ADMIN", "Rithanya@2026"],
  ];
  for (const [username, email, fullName, role, pw] of accounts) {
    const passwordHash = await hashPassword(pw);
    const existing = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    let userId: string;
    if (!existing) {
      const u = await prisma.user.create({
        data: { username, email, fullName, role, passwordHash },
      });
      userId = u.id;
    } else {
      userId = existing.id;
      await prisma.user.update({
        where: { id: existing.id },
        data: { passwordHash, role, isActive: true },
      });
    }
    const mods = computeModules(role);
    await prisma.userModuleAccess.upsert({
      where: { userId },
      create: {
        userId,
        canManageEMR: mods.emr,
        canManageBloodBank: mods.bloodbank,
        canManageCMS: mods.cms,
        canManageStore: mods.store,
        canManageHR: mods.hr,
        canManageFinance: mods.finance,
        canManageDPDP: mods.dpdp,
        canManageSettings: mods.settings,
      },
      update: {
        canManageEMR: mods.emr,
        canManageBloodBank: mods.bloodbank,
        canManageCMS: mods.cms,
        canManageStore: mods.store,
        canManageHR: mods.hr,
        canManageFinance: mods.finance,
        canManageDPDP: mods.dpdp,
        canManageSettings: mods.settings,
      },
    });
  }

  function mediaIdsFor(mediaList: Array<{ originalName: string }>, mediaMap: Record<string, string>): string[] {
    return (mediaList || []).map((x) => mediaMap[x.originalName.replace(/\.(webp|mp4)$/, "")]).filter(Boolean);
  }

  // 2. Specialties (4 items)
  const specialtyCount = await prisma.specialty.count();
  if (specialtyCount === 0) {
    for (const spec of FALLBACK_SPECIALTIES) {
      const inserted = await prisma.specialty.create({
        data: {
          title: spec.title,
          slug: spec.slug,
          shortSummary: spec.shortSummary,
          contentHtml: spec.contentHtml,
          sortOrder: spec.sortOrder,
        },
      });
      const mediaIds = mediaIdsFor(spec.media, m);
      if (mediaIds.length) await setEntityMedia("specialties", inserted.id, mediaIds);
    }
  }

  // 3. Treatments & Conditions Managed (40 items)
  const treatmentCount = await prisma.treatment.count();
  if (treatmentCount === 0) {
    for (const tr of FALLBACK_TREATMENTS) {
      const inserted = await prisma.treatment.create({
        data: {
          title: tr.title,
          slug: tr.slug,
          category: tr.category,
          isFlagship: tr.isFlagship,
          shortSummary: tr.shortSummary,
          contentHtml: tr.contentHtml,
          sortOrder: tr.sortOrder,
        },
      });
      const mediaIds = mediaIdsFor(tr.media, m);
      if (mediaIds.length) await setEntityMedia("treatments", inserted.id, mediaIds);
    }
  }

  // 4. Services (4 items)
  const serviceCount = await prisma.service.count();
  if (serviceCount === 0) {
    for (const serv of FALLBACK_SERVICES) {
      const inserted = await prisma.service.create({
        data: {
          title: serv.title,
          slug: serv.slug,
          category: serv.category,
          shortSummary: serv.shortSummary,
          contentHtml: serv.contentHtml,
          sortOrder: serv.sortOrder,
        },
      });
      const mediaIds = mediaIdsFor(serv.media, m);
      if (mediaIds.length) await setEntityMedia("services", inserted.id, mediaIds);
    }
  }

  // 4b. Facilities
  const facilityCount = await prisma.facility.count();
  if (facilityCount === 0) {
    for (const fac of FALLBACK_FACILITIES) {
      const inserted = await prisma.facility.create({
        data: {
          title: fac.title,
          slug: fac.slug,
          shortSummary: fac.shortSummary,
          contentHtml: fac.contentHtml,
          sortOrder: fac.sortOrder,
        },
      });
      const mediaIds = mediaIdsFor(fac.media, m);
      if (mediaIds.length) await setEntityMedia("facilities", inserted.id, mediaIds);
    }
  }

  // 5. Doctors
  const doctorCount = await prisma.doctor.count();
  if (doctorCount === 0) {
    await put((v) => prisma.doctor.create({ data: v as never }), "doctors", [
      {
        v: {
          fullName: "Dr. D. Narayana Murthy, M.D.", qualifications: "M.D.", designation: "Chief Consultant & Daycare Director", department: "Diabetology & General Medicine", consultationTimings: "OPD 9:00 AM – 8:00 PM · Emergency 24/7",
          biographyHtml:
            p("Dr. Narayana Murthy, M.D., is the Chief Consultant, Diabetic Specialist and General Physician at Rithanya Hospital, and Director of its Thalassemia and Sickle Cell Daycare Transfusion Centre.") +
            p("He is widely respected in Khammam for managing diabetes and other chronic metabolic conditions, and for leading the humanitarian daycare wing for children and adults with hemoglobinopathies.") +
            p("Patients consistently highlight his conversational, reassuring manner and the time he takes to explain diagnoses and medicines clearly."),
        },
        media: [m["doctor-vitals"], m["doctor-sitting"]],
      },
      {
        v: { fullName: "Dr. A. Lakshmi Deepa", qualifications: "M.B.B.S.", designation: "Co-Founder & Consulting Physician", department: "Hospital Leadership", consultationTimings: "By appointment",
          biographyHtml: p("Dr. A. Lakshmi Deepa is co-founder of Rithanya Hospital and shares the hospital's vision of accessible, compassionate care for every family in Khammam.") },
        media: [m["doctor-consult"]],
      },
      {
        v: { fullName: "Visiting Specialist Panel", qualifications: "Various", designation: "Visiting Faculty", department: "Obstetrics & Gynaecology · Minimal Access Surgery · Physiotherapy", consultationTimings: "Call +91 83285 81019 for schedules", isVisiting: true,
          biographyHtml: p("Consulting specialists in Obstetrics & Gynaecology, Infertility/Reproductive Medicine and Minimal Access Surgery visit the hospital along with physiotherapists and general surgeons.") },
        media: [m["doctor-exam"]],
      },
    ], "fullName");
  }

  // 6. Insurance
  const insuranceCount = await prisma.insuranceProvider.count();
  if (insuranceCount === 0) {
    await put((v) => prisma.insuranceProvider.create({ data: v as never }), "insurance", [
      { v: { name: "Ayushman Bharat PM-JAY", schemeType: "Government Scheme", descriptionHtml: p("Rithanya Hospital is empaneled under PM-JAY for subsidised, cashless treatment.") + ul(["Carry your Ayushman card and a government photo ID", "Visit the cashless desk on arrival", "We assist with pre-authorisation"]) }, media: [m["logo-pmjay"]] },
      { v: { name: "Aarogyasri Health Care Trust", schemeType: "Government Scheme", descriptionHtml: p("Our desk helps eligible families navigate Aarogyasri enrolment and claims.") + ul(["White ration card / Aarogyasri card", "Photo ID of patient", "Referral documents where applicable"]) }, media: [m["logo-aarogyasri"]] },
      { v: { name: "Private Insurance & TPA Cashless", schemeType: "Private TPA", descriptionHtml: p("Private health insurance holders can request cashless pre-authorisation through our billing desk.") + ul(["Policy or e-card copy", "Photo ID", "Doctor's admission advice"]) }, media: [m["logo-tpa"]] },
    ]);
  }

  // 7. Gallery
  const galleryCount = await prisma.galleryItem.count();
  if (galleryCount === 0) {
    await put((v) => prisma.galleryItem.create({ data: v as never }), "gallery", [
      { v: { title: "Wide, accessible corridors", mediaType: "IMAGE", caption: "Ramps, wheelchair access and wide corridors throughout." }, media: [m["hospital-wheelchair"], m["hospital-corridor"]] },
      { v: { title: "Daycare transfusion beds", mediaType: "IMAGE", caption: "Calm, sanitised beds for scheduled transfusions." }, media: [m["blood-beds"]] },
      { v: { title: "Daycare in action", mediaType: "VIDEO", caption: "A short look at our IV and transfusion care." }, media: [m["clip-iv-drip"]] },
      { v: { title: "In-house laboratory", mediaType: "IMAGE", caption: "Fast, accurate diagnostics under one roof." }, media: [m["lab-microscope"]] },
      { v: { title: "Nursing care", mediaType: "IMAGE", caption: "Immediate attention from our nursing staff." }, media: [m["nurse-care"]] },
      { v: { title: "Blood donation camp", mediaType: "IMAGE", caption: "Community blood donation partnerships." }, media: [m["blood-donation"]] },
      { v: { title: "24/7 pharmacy", mediaType: "IMAGE", caption: "Medicines available around the clock." }, media: [m["pharmacy-shelves"]] },
    ]);
  }

  // 8. Testimonials
  const testimonialCount = await prisma.testimonial.count();
  if (testimonialCount === 0) {
    await put((v) => prisma.testimonial.create({ data: v as never }), "testimonials", [
      { v: { patientName: "Parent of a thalassemia patient", location: "Khammam", treatment: "Thalassemia daycare", rating: 5, quote: "The nurses attend to my child the moment we arrive and the doctor explains everything patiently. Transfusion days are no longer scary for us." }, media: [m["nurse-care"]] },
      { v: { patientName: "Diabetes patient & family", location: "Wyra Road", treatment: "Diabetology", rating: 5, quote: "Dr. Narayana Murthy gives encouragement along with treatment. The cost is affordable and my sugar is finally under control." }, media: [m["glucose-meter"]] },
      { v: { patientName: "Senior citizen visitor", location: "Nehru Nagar", treatment: "Senior wellness checkup", rating: 5, quote: "Very clean, easy to enter with a wheelchair, and everyone is courteous. Bills were clear and fair." }, media: [m["nurse-bp"]] },
    ]);
  }

  // 9. Blogs
  const blogCount = await prisma.blogPost.count();
  if (blogCount === 0) {
    const blog = (title: string, category: string, excerpt: string, body: string, media: string[]) => ({
      v: { title, category, excerpt, contentHtml: body },
      media,
    });
    await put((v) => prisma.blogPost.create({ data: v as never }), "blogs", [
      blog("Understanding HbA1c: Your Three-Month Sugar Report Card", "Diabetes Management", "HbA1c shows your average blood sugar over about three months. Here is how to read it and what to do next.", h("Why HbA1c matters") + p("Unlike a single finger-prick reading, HbA1c reflects your average control across roughly three months, making it the best marker of long-term diabetes management.") + ul(["Ask for HbA1c at least every three to six months", "Pair it with fasting and post-meal sugar logs", "Discuss any rising trend with your doctor early"]), [m["glucose-strips"]]),
      blog("Living Well with Thalassemia: A Family Guide to Transfusion Days", "Blood Disorders", "Preparing for a transfusion visit, what happens in daycare, and how families can support patients.", h("Before you arrive") + p("Eat a light meal, carry previous reports, and call ahead so that matched blood and a bed are ready.") + ul(["Bring your transfusion record", "Keep the patient hydrated", "Note any fever or reaction after returning home"]), [m["blood-beds"]]),
      blog("Gestational Diabetes: Protecting Mother and Baby", "Maternal Health", "Screening, diet and follow-up that keep pregnancy safe when blood sugar runs high.", h("Early screening helps") + p("Gestational diabetes often has no symptoms, so screening during pregnancy is important. With diet changes and follow-up, most mothers deliver healthy babies."), [m["doctor-consult"]]),
      blog("Monsoon Fevers: When to See a Doctor", "General Wellness", "Dengue, malaria and typhoid share symptoms. Know the warning signs that need prompt medical attention.", h("Do not wait out a fever") + p("Fever lasting more than two days, severe body ache, persistent vomiting or bleeding signs need immediate evaluation.") + ul(["Stay hydrated", "Avoid self-medicating with antibiotics", "Visit our 24/7 emergency desk for warning signs"]), [m["doctor-vitals"]]),
    ], "title");
  }

  // 10. Products
  const productCount = await prisma.product.count();
  if (productCount === 0) {
    const prod = (name: string, category: string, price: number, stock: number, desc: string, media: string[], rx = false) => ({
      v: { name, category, price, stockUnits: stock, description: desc, isPrescriptionReq: rx },
      media,
    });
    await put((v) => prisma.product.create({ data: v as never }), "products", [
      prod("Digital Glucometer Kit", "Diabetes Care", 899, 40, "Easy-read glucometer with lancing device and carry case.", [m["glucose-meter"], m["glucose-finger"]]),
      prod("Glucose Test Strips (50)", "Diabetes Care", 749, 120, "Compatible test strips, pack of 50.", [m["glucose-strips"]]),
      prod("Digital BP Monitor", "Senior Care", 1499, 25, "Automatic upper-arm blood pressure monitor with memory.", [m["nurse-bp"]]),
      prod("Fingertip Pulse Oximeter", "Wellness", 1199, 30, "Measure SpO2 and pulse rate in seconds.", [m["doctor-vitals"]]),
      prod("Oral Rehydration Salts (ORS) Pack", "First Aid", 120, 200, "WHO-formula ORS sachets, pack of 10.", [m["pharmacy-bottle"]]),
      prod("Sterile Dressing Kit", "First Aid", 349, 60, "Sterile gauze, bandages and tape for wound care.", [m["nurse-injection"]]),
      prod("Diabetic Nutrition Drink", "Diabetes Care", 560, 50, "Balanced nutrition powder designed for diabetics.", [m["pharmacy-shelves"]]),
      prod("Digital Thermometer", "Wellness", 199, 90, "Fast, accurate digital thermometer.", [m["pharmacy-counter"]]),
    ], "name");
  }

  // 11. Clinical categories
  const clinicalCatCount = await prisma.clinicalCategory.count();
  if (clinicalCatCount === 0) {
    const cats = ["Thalassemia Major", "Sickle Cell Disease", "Type 1 Diabetes", "Type 2 Diabetes", "Gestational Diabetes", "Viral Fever / Infectious", "Hypertension", "General Medicine"];
    for (const c of cats) {
      await prisma.clinicalCategory.create({ data: { name: c } });
    }
  }

  // 12. Expense categories
  const expenseCatCount = await prisma.expenseCategory.count();
  if (expenseCatCount === 0) {
    for (const c of ["Patient Billing", "Pharmacy Purchases", "Salaries", "Utilities", "Consumables", "Donations"]) {
      await prisma.expenseCategory.create({ data: { entity: "RITHANYA_HOSPITAL", name: c } });
    }
    for (const c of ["Voluntary Blood Donations", "Blood Bag Consumables", "Testing & Serology Kits", "Donor Camp Operations", "Salaries"]) {
      await prisma.expenseCategory.create({ data: { entity: "RVBC", name: c } });
    }
  }

  // 13. Employees
  const employeeCount = await prisma.employee.count();
  if (employeeCount === 0) {
    await prisma.employee.createMany({
      data: [
        {
          entity: "RITHANYA_HOSPITAL",
          fullName: "Dr. D. Narayana Murthy, M.D.",
          designation: "Chief Consultant & Medical Director",
          department: "Diabetology & General Medicine",
          shiftSchedule: "General",
          contactNumber: "8328581019",
          monthlyFixedBaseSalary: 150000,
          isActive: true,
        },
        {
          entity: "RITHANYA_HOSPITAL",
          fullName: "S. Kavitha, B.Sc Nursing",
          designation: "Head Nurse & Daycare Incharge",
          department: "Thalassemia Daycare & Inpatient",
          shiftSchedule: "Morning",
          contactNumber: "9848022331",
          monthlyFixedBaseSalary: 45000,
          isActive: true,
        },
        {
          entity: "RITHANYA_HOSPITAL",
          fullName: "P. Ramesh, B.Pharm",
          designation: "Senior Pharmacist",
          department: "Pharmacy & Store",
          shiftSchedule: "General",
          contactNumber: "9848033442",
          monthlyFixedBaseSalary: 38000,
          isActive: true,
        },
        {
          entity: "RVBC",
          fullName: "V. Srinivas",
          designation: "Blood Bank Officer & Donor Lead",
          department: "Blood Bank & Transfusion Operations",
          shiftSchedule: "General",
          contactNumber: "9848044553",
          monthlyFixedBaseSalary: 55000,
          isActive: true,
        },
        {
          entity: "RVBC",
          fullName: "K. Radhika, DMLT",
          designation: "Senior Serology & Testing Technician",
          department: "Laboratory & Component Separation",
          shiftSchedule: "Morning",
          contactNumber: "9848055664",
          monthlyFixedBaseSalary: 40000,
          isActive: true,
        },
      ],
    });
  }
} catch (err) {
  reportDbError(err);
  console.warn("[seed] Notice: Seed aborted due to DB connection timeout, using resilient offline caches:", (err as Error)?.message || err);
}

  console.log("[seed] Done.");
}
