import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db.js";
import { hashPassword, computeModules } from "./auth.js";
import { encryptField, encryptJson } from "./crypto.js";
import { setEntityMedia, type EntityType } from "./media.js";
import { DEFAULT_SETTINGS } from "./settings.js";
import { slugify } from "./utils.js";

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
  await prisma.hospitalSetting.upsert({
    where: { id: "PRIMARY_CONFIG" },
    create: { ...DEFAULT_SETTINGS, socialShareThumbnailUrl: "/seed/hospital-corridor.webp" },
    update: {},
  });
  const colors: Record<string, string> = { O: "SKY_BLUE", A: "YELLOW", B: "RED", AB: "WHITE" };
  const seedStock: Record<string, [number, number]> = { O: [14, 9], A: [11, 7], B: [9, 6], AB: [4, 3] };
  for (const g of ["O", "A", "B", "AB"]) {
    await prisma.bloodStock.upsert({
      where: { bloodGroup: g },
      create: { bloodGroup: g, groupCategory: g, colorCode: colors[g], wholeBloodUnits: seedStock[g][0], plasmaUnits: seedStock[g][1] },
      update: {},
    });
  }
  void seedDirCandidate();
}

export async function ensureSeed() {
  await ensureBaseData();
  const n = await prisma.user.count();
  if (n > 0) return;
  console.log("[seed] Seeding Rithanya Hospital demo content…");
  const m = await seedMedia();

  const accounts: Array<[string, string, string, "SUPERADMIN" | "ADMIN" | "STAFF", string]> = [
    ["superadmin", "superadmin@rithanyahospital.com", "Hospital Superadmin", "SUPERADMIN", "Rithanya@2026"],
    ["admin", "admin@rithanyahospital.com", "Administration Desk", "ADMIN", "Admin@2026"],
    ["staff", "staff@rithanyahospital.com", "Nursing Station Staff", "STAFF", "Staff@2026"],
  ];
  for (const [username, email, fullName, role, pw] of accounts) {
    const u = await prisma.user.create({ data: { username, email, fullName, role, passwordHash: await hashPassword(pw) } });
    const mods = computeModules(role);
    await prisma.userModuleAccess.create({
      data: {
        userId: u.id,
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

  await put((v) => prisma.specialty.create({ data: v as never }), "specialties", [
    {
      v: {
        title: "Diabetology & Endocrinology",
        shortSummary: "Comprehensive care for Type 1, Type 2 and gestational diabetes with HbA1c screening, complication prevention and long-term metabolic plans.",
        contentHtml:
          h("Diabetes care that goes beyond sugar numbers") +
          p("Led by Dr. Narayana Murthy, M.D., our diabetology clinic manages Type 1, Type 2 and gestational diabetes with a focus on long-term control and prevention of complications.") +
          ul(["Blood sugar monitoring and HbA1c screening", "Diabetic neuropathy and nephropathy prevention", "Personalised dietary guidance", "Long-term metabolic health plans for the whole family"]),
      },
      media: [m["glucose-finger"], m["glucose-meter"]],
    },
    {
      v: {
        title: "General & Internal Medicine",
        shortSummary: "Prompt diagnosis and treatment of fevers, infections, hypertension, respiratory illness, abdominal pain, headaches and migraines.",
        contentHtml:
          h("Everyday and acute illness, handled with care") +
          p("Our general physicians treat viral fevers, malaria, dengue, typhoid and seasonal infections, alongside chronic conditions such as hypertension.") +
          ul(["Acute illness management", "Hypertension and respiratory infections", "Abdominal pain, headaches and migraines", "Observation beds and hydration therapy"]),
      },
      media: [m["doctor-consult"], m["doctor-exam"]],
    },
    {
      v: {
        title: "Thalassemia & Sickle Cell Daycare",
        shortSummary: "Our flagship daycare transfusion centre: safe red cell transfusions, iron chelation monitoring and family counselling for children and adults.",
        contentHtml:
          h("A humanitarian daycare wing for hemoglobinopathies") +
          p("The Thalassemia and Sickle Cell Daycare Transfusion Centre provides routine blood transfusions and supportive care for patients with Thalassemia Major and Sickle Cell Disease, in a calm and sanitised daycare setting.") +
          ul(["Safe red cell transfusions", "Iron chelation monitoring", "Regular blood parameter tracking", "Moral support and family counselling"]),
      },
      media: [m["blood-beds"], m["blood-donation"], m["blood-bag"]],
    },
    {
      v: {
        title: "Diagnostics & Pathology",
        shortSummary: "Routine blood panels, biochemical tests and senior citizen wellness profiles with fast, accurate reporting.",
        contentHtml: h("Reliable results, quickly") + p("In-house diagnostics support every department — from HbA1c and blood counts to full biochemical panels.") + ul(["Routine blood panels", "Biochemical tests", "Senior citizen wellness profiles"]),
      },
      media: [m["lab-microscope"], m["lab-woman"]],
    },
    {
      v: {
        title: "Senior Citizen Wellness",
        shortSummary: "Dedicated health checkup profiles designed for older adults, with unhurried consultations and accessible facilities.",
        contentHtml: h("Healthy ageing, supported") + p("Wheelchair-accessible entrances, ramps and wide corridors make visits comfortable for senior citizens, who also receive dedicated wellness profiles.") + ul(["Senior wellness profile", "Blood pressure, sugar and cholesterol review", "Medication reconciliation"]),
      },
      media: [m["nurse-bp"], m["nurse-care"]],
    },
    {
      v: {
        title: "Visiting Specialties",
        shortSummary: "Consulting specialists in obstetrics & gynaecology, reproductive medicine and minimal access surgery, plus visiting physiotherapists and general surgeons.",
        contentHtml: h("Extended specialist access") + p("Visiting consultants extend the hospital's reach into women's health, reproductive medicine and surgical care. Call ahead for schedules."),
      },
      media: [m["ward-exam"]],
    },
  ], "title");

  await put((v) => prisma.treatment.create({ data: v as never }), "treatments", [
    {
      v: { title: "Thalassemia Major Transfusion Care", category: "Blood Disorders", isFlagship: true, shortSummary: "Regular, safe red cell transfusions with iron-chelation monitoring and counselling in a dedicated daycare.", contentHtml: h("What to expect") + p("Each visit includes pre-transfusion checks, matched blood, bedside monitoring and post-transfusion guidance. Hemoglobin and ferritin are tracked over time so that your care plan stays on target.") + ul(["Matched, screened blood units", "Iron chelation monitoring", "Growth and blood parameter tracking", "Family counselling"]) },
      media: [m["blood-beds"], m["blood-bag"]],
    },
    {
      v: { title: "Sickle Cell Disease Management", category: "Blood Disorders", isFlagship: true, shortSummary: "Supportive care, transfusion support and crisis-prevention guidance for children and adults living with sickle cell disease.", contentHtml: h("Supportive and preventive care") + p("We combine regular review, hydration therapy, transfusion when indicated and education on triggers so patients can avoid painful crises.") },
      media: [m["blood-donation"], m["nurse-injection"]],
    },
    {
      v: { title: "Diabetes Management (Type 1, Type 2 & Gestational)", category: "Diabetes & Endocrine", isFlagship: true, shortSummary: "Evidence-based diabetes care: sugar control, HbA1c tracking, diet planning and screening for neuropathy and nephropathy.", contentHtml: h("A plan built around you") + p("Treatment is tailored by Dr. Narayana Murthy and includes medication review, glucose monitoring education and diet and lifestyle plans.") + ul(["HbA1c screening", "Neuropathy and nephropathy prevention", "Diet and lifestyle plan", "Gestational diabetes support"]) },
      media: [m["glucose-strips"], m["glucose-finger"]],
    },
    {
      v: { title: "Fever & Seasonal Infection Care", category: "Infectious Diseases", shortSummary: "Diagnosis and treatment of viral fevers, malaria, dengue, typhoid and other seasonal infections.", contentHtml: h("Fast diagnosis, early treatment") + p("Same-day tests and observation beds help us treat infections quickly and monitor high-risk patients closely.") },
      media: [m["doctor-vitals"]],
    },
    {
      v: { title: "Hypertension & Respiratory Care", category: "General Medicine", shortSummary: "Long-term blood pressure control and treatment of respiratory infections, headaches and migraines.", contentHtml: h("Control that lasts") + p("Regular review, medication optimisation and lifestyle advice keep blood pressure within target.") },
      media: [m["nurse-bp"]],
    },
    {
      v: { title: "Wound Care & Minor Procedures", category: "Diagnostics & Wellness", shortSummary: "Wound suturing, sterile dressing, hydration therapy and short-stay observation.", contentHtml: h("Safe, sterile, same-day") + p("Minor procedures are performed under sterile conditions with observation beds available for recovery.") },
      media: [m["nurse-injection"], m["ward-exam"]],
    },
  ], "title");

  await put((v) => prisma.service.create({ data: v as never }), "services", [
    { v: { title: "Daycare Transfusion Unit", category: "Daycare", shortSummary: "Comfortable daycare beds for scheduled transfusions, with nurses at the bedside throughout.", contentHtml: h("Designed for repeat visits") + p("Clean waiting lounges, observation beds and attentive nursing make recurring transfusions easier for families.") }, media: [m["blood-beds"], m["clip-iv-drip"]] },
    { v: { title: "Lab Diagnostics", category: "Diagnostics", shortSummary: "Routine blood panels, biochemistry and HbA1c with dependable turnaround.", contentHtml: h("Tests you can trust") + p("Our lab supports every clinic and provides health checkup profiles.") }, media: [m["lab-microscope"], m["lab-notes"]] },
    { v: { title: "24/7 Pharmacy", category: "Pharmacy", shortSummary: "Round-the-clock pharmacy with digital payment support and home delivery through our online store.", contentHtml: h("Medicines when you need them") + p("Order wellness and diabetes-care products online from the Pharmacy page and pay by cash on delivery or UPI.") }, media: [m["pharmacy-shelves"], m["pharmacy-counter"]] },
    { v: { title: "Emergency & Observation Beds", category: "Emergency", shortSummary: "Open 24 hours for inpatient, daycare and urgent care, with observation beds and hydration therapy.", contentHtml: h("Always open") + p("Call +91 83285 81019 for urgent care. Our team is available around the clock.") }, media: [m["ward-exam"], m["nurse-care"]] },
    { v: { title: "Senior Citizen Health Checkups", category: "Outpatient", shortSummary: "Wellness profiles for older adults with unhurried consultations.", contentHtml: h("Preventive care for seniors") + p("Includes blood panels, biochemical tests and physician review.") }, media: [m["nurse-bp"]] },
    { v: { title: "Ayushman Bharat Cashless Desk", category: "Outpatient", shortSummary: "Dedicated assistance for PM-JAY and other public healthcare scheme paperwork and cashless admissions.", contentHtml: h("Help with paperwork") + p("Our desk guides you through eligibility, documents and pre-authorisation.") }, media: [m["hospital-corridor"]] },
  ], "title");

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

  await put((v) => prisma.insuranceProvider.create({ data: v as never }), "insurance", [
    { v: { name: "Ayushman Bharat PM-JAY", schemeType: "Government Scheme", descriptionHtml: p("Rithanya Hospital is empaneled under PM-JAY for subsidised, cashless treatment.") + ul(["Carry your Ayushman card and a government photo ID", "Visit the cashless desk on arrival", "We assist with pre-authorisation"]) }, media: [m["logo-pmjay"]] },
    { v: { name: "Aarogyasri Health Care Trust", schemeType: "Government Scheme", descriptionHtml: p("Our desk helps eligible families navigate Aarogyasri enrolment and claims.") + ul(["White ration card / Aarogyasri card", "Photo ID of patient", "Referral documents where applicable"]) }, media: [m["logo-aarogyasri"]] },
    { v: { name: "Private Insurance & TPA Cashless", schemeType: "Private TPA", descriptionHtml: p("Private health insurance holders can request cashless pre-authorisation through our billing desk.") + ul(["Policy or e-card copy", "Photo ID", "Doctor's admission advice"]) }, media: [m["logo-tpa"]] },
  ]);

  await put((v) => prisma.galleryItem.create({ data: v as never }), "gallery", [
    { v: { title: "Wide, accessible corridors", mediaType: "IMAGE", caption: "Ramps, wheelchair access and wide corridors throughout." }, media: [m["hospital-wheelchair"], m["hospital-corridor"]] },
    { v: { title: "Daycare transfusion beds", mediaType: "IMAGE", caption: "Calm, sanitised beds for scheduled transfusions." }, media: [m["blood-beds"]] },
    { v: { title: "Daycare in action", mediaType: "VIDEO", caption: "A short look at our IV and transfusion care." }, media: [m["clip-iv-drip"]] },
    { v: { title: "In-house laboratory", mediaType: "IMAGE", caption: "Fast, accurate diagnostics under one roof." }, media: [m["lab-microscope"]] },
    { v: { title: "Nursing care", mediaType: "IMAGE", caption: "Immediate attention from our nursing staff." }, media: [m["nurse-care"]] },
    { v: { title: "Blood donation camp", mediaType: "IMAGE", caption: "Community blood donation partnerships." }, media: [m["blood-donation"]] },
    { v: { title: "24/7 pharmacy", mediaType: "IMAGE", caption: "Medicines available around the clock." }, media: [m["pharmacy-shelves"]] },
  ]);

  await put((v) => prisma.testimonial.create({ data: v as never }), "testimonials", [
    { v: { patientName: "Parent of a thalassemia patient", location: "Khammam", treatment: "Thalassemia daycare", rating: 5, quote: "The nurses attend to my child the moment we arrive and the doctor explains everything patiently. Transfusion days are no longer scary for us." }, media: [m["nurse-care"]] },
    { v: { patientName: "Diabetes patient & family", location: "Wyra Road", treatment: "Diabetology", rating: 5, quote: "Dr. Narayana Murthy gives encouragement along with treatment. The cost is affordable and my sugar is finally under control." }, media: [m["glucose-meter"]] },
    { v: { patientName: "Senior citizen visitor", location: "Nehru Nagar", treatment: "Senior wellness checkup", rating: 5, quote: "Very clean, easy to enter with a wheelchair, and everyone is courteous. Bills were clear and fair." }, media: [m["nurse-bp"]] },
  ]);

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

  const cats = ["Thalassemia Major", "Sickle Cell Disease", "Type 1 Diabetes", "Type 2 Diabetes", "Gestational Diabetes", "Viral Fever / Infectious", "Hypertension", "General Medicine"];
  for (const c of cats) {
    await prisma.clinicalCategory.create({ data: { name: c } });
  }

  for (const c of ["Patient Billing", "Pharmacy Purchases", "Salaries", "Utilities", "Consumables", "Donations"]) {
    await prisma.expenseCategory.create({ data: { entity: "RITHANYA_HOSPITAL", name: c } });
  }

  for (const c of ["Voluntary Blood Donations", "Blood Bag Consumables", "Testing & Serology Kits", "Donor Camp Operations", "Salaries"]) {
    await prisma.expenseCategory.create({ data: { entity: "RVBC", name: c } });
  }

  console.log("[seed] Done.");
}
