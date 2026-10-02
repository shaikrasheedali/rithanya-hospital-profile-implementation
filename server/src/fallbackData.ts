export interface MediaItem {
  id: string;
  url: string;
  kind: "IMAGE" | "VIDEO";
  originalName: string;
}

const p = (t: string) => `<p>${t}</p>`;
const ul = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const h = (t: string) => `<h2>${t}</h2>`;

export const FALLBACK_SPECIALTIES = [
  {
    id: "spec-1",
    title: "Diabetology & Endocrinology",
    slug: "diabetology-and-endocrinology",
    shortSummary: "Comprehensive care for Type 1, Type 2 and gestational diabetes with HbA1c screening, complication prevention and long-term metabolic plans.",
    contentHtml:
      h("Diabetes care that goes beyond sugar numbers") +
      p("Led by Dr. Narayana Murthy, M.D., our diabetology clinic manages Type 1, Type 2 and gestational diabetes with a focus on long-term control and prevention of complications.") +
      ul(["Blood sugar monitoring and HbA1c screening", "Diabetic neuropathy and nephropathy prevention", "Personalised dietary guidance", "Long-term metabolic health plans for the whole family"]),
    sortOrder: 0,
    media: [
      { id: "m-glucose-finger", url: "/seed/glucose-finger.webp", kind: "IMAGE" as const, originalName: "glucose-finger.webp" },
      { id: "m-glucose-meter", url: "/seed/glucose-meter.webp", kind: "IMAGE" as const, originalName: "glucose-meter.webp" },
    ],
  },
  {
    id: "spec-2",
    title: "General & Internal Medicine",
    slug: "general-and-internal-medicine",
    shortSummary: "Prompt diagnosis and treatment of fevers, infections, hypertension, respiratory illness, abdominal pain, headaches and migraines.",
    contentHtml:
      h("Everyday and acute illness, handled with care") +
      p("Our general physicians treat viral fevers, malaria, dengue, typhoid and seasonal infections, alongside chronic conditions such as hypertension.") +
      ul(["Acute illness management", "Hypertension and respiratory infections", "Abdominal pain, headaches and migraines", "Observation beds and hydration therapy"]),
    sortOrder: 1,
    media: [
      { id: "m-doctor-consult", url: "/seed/doctor-consult.webp", kind: "IMAGE" as const, originalName: "doctor-consult.webp" },
      { id: "m-doctor-exam", url: "/seed/doctor-exam.webp", kind: "IMAGE" as const, originalName: "doctor-exam.webp" },
    ],
  },
  {
    id: "spec-3",
    title: "Thalassemia & Sickle Cell Daycare",
    slug: "thalassemia-and-sickle-cell-daycare",
    shortSummary: "Our flagship daycare transfusion centre: safe red cell transfusions, iron chelation monitoring and family counselling for children and adults.",
    contentHtml:
      h("A humanitarian daycare wing for hemoglobinopathies") +
      p("The Thalassemia and Sickle Cell Daycare Transfusion Centre provides routine blood transfusions and supportive care for patients with Thalassemia Major and Sickle Cell Disease, in a calm and sanitised daycare setting.") +
      ul(["Safe red cell transfusions", "Iron chelation monitoring", "Regular blood parameter tracking", "Moral support and family counselling"]),
    sortOrder: 2,
    media: [
      { id: "m-blood-beds", url: "/seed/blood-beds.webp", kind: "IMAGE" as const, originalName: "blood-beds.webp" },
      { id: "m-blood-donation", url: "/seed/blood-donation.webp", kind: "IMAGE" as const, originalName: "blood-donation.webp" },
      { id: "m-blood-bag", url: "/seed/blood-bag.webp", kind: "IMAGE" as const, originalName: "blood-bag.webp" },
    ],
  },
  {
    id: "spec-4",
    title: "Diagnostics & Pathology",
    slug: "diagnostics-and-pathology",
    shortSummary: "Routine blood panels, biochemical tests and senior citizen wellness profiles with fast, accurate reporting.",
    contentHtml:
      h("Reliable results, quickly") +
      p("In-house diagnostics support every department — from HbA1c and blood counts to full biochemical panels.") +
      ul(["Routine blood panels", "Biochemical tests", "Senior citizen wellness profiles"]),
    sortOrder: 3,
    media: [
      { id: "m-lab-microscope", url: "/seed/lab-microscope.webp", kind: "IMAGE" as const, originalName: "lab-microscope.webp" },
      { id: "m-lab-woman", url: "/seed/lab-woman.webp", kind: "IMAGE" as const, originalName: "lab-woman.webp" },
    ],
  },
  {
    id: "spec-5",
    title: "Senior Citizen Wellness",
    slug: "senior-citizen-wellness",
    shortSummary: "Dedicated health checkup profiles designed for older adults, with unhurried consultations and accessible facilities.",
    contentHtml:
      h("Healthy ageing, supported") +
      p("Wheelchair-accessible entrances, ramps and wide corridors make visits comfortable for senior citizens, who also receive dedicated wellness profiles.") +
      ul(["Senior wellness profile", "Blood pressure, sugar and cholesterol review", "Medication reconciliation"]),
    sortOrder: 4,
    media: [
      { id: "m-nurse-bp", url: "/seed/nurse-bp.webp", kind: "IMAGE" as const, originalName: "nurse-bp.webp" },
      { id: "m-nurse-care", url: "/seed/nurse-care.webp", kind: "IMAGE" as const, originalName: "nurse-care.webp" },
    ],
  },
  {
    id: "spec-6",
    title: "Visiting Specialties",
    slug: "visiting-specialties",
    shortSummary: "Consulting specialists in obstetrics & gynaecology, reproductive medicine and minimal access surgery, plus visiting physiotherapists and general surgeons.",
    contentHtml:
      h("Extended specialist access") +
      p("Visiting consultants extend the hospital's reach into women's health, reproductive medicine and surgical care. Call ahead for schedules."),
    sortOrder: 5,
    media: [{ id: "m-ward-exam", url: "/seed/ward-exam.webp", kind: "IMAGE" as const, originalName: "ward-exam.webp" }],
  },
];

export const FALLBACK_TREATMENTS = [
  {
    id: "treat-1",
    title: "Thalassemia Major Transfusion Care",
    slug: "thalassemia-major-transfusion-care",
    category: "Blood Disorders",
    isFlagship: true,
    shortSummary: "Regular, safe red cell transfusions with iron-chelation monitoring and counselling in a dedicated daycare.",
    contentHtml:
      h("What to expect") +
      p("Each visit includes pre-transfusion checks, matched blood, bedside monitoring and post-transfusion guidance. Hemoglobin and ferritin are tracked over time so that your care plan stays on target.") +
      ul(["Matched, screened blood units", "Iron chelation monitoring", "Growth and blood parameter tracking", "Family counselling"]),
    sortOrder: 0,
    media: [
      { id: "m-blood-beds", url: "/seed/blood-beds.webp", kind: "IMAGE" as const, originalName: "blood-beds.webp" },
      { id: "m-blood-bag", url: "/seed/blood-bag.webp", kind: "IMAGE" as const, originalName: "blood-bag.webp" },
    ],
  },
  {
    id: "treat-2",
    title: "Sickle Cell Disease Management",
    slug: "sickle-cell-disease-management",
    category: "Blood Disorders",
    isFlagship: true,
    shortSummary: "Supportive care, transfusion support and crisis-prevention guidance for children and adults living with sickle cell disease.",
    contentHtml:
      h("Supportive and preventive care") +
      p("We combine regular review, hydration therapy, transfusion when indicated and education on triggers so patients can avoid painful crises."),
    sortOrder: 1,
    media: [
      { id: "m-blood-donation", url: "/seed/blood-donation.webp", kind: "IMAGE" as const, originalName: "blood-donation.webp" },
      { id: "m-nurse-injection", url: "/seed/nurse-injection.webp", kind: "IMAGE" as const, originalName: "nurse-injection.webp" },
    ],
  },
  {
    id: "treat-3",
    title: "Diabetes Management (Type 1, Type 2 & Gestational)",
    slug: "diabetes-management-type-1-type-2-and-gestational",
    category: "Diabetes & Endocrine",
    isFlagship: true,
    shortSummary: "Evidence-based diabetes care: sugar control, HbA1c tracking, diet planning and screening for neuropathy and nephropathy.",
    contentHtml:
      h("A plan built around you") +
      p("Treatment is tailored by Dr. Narayana Murthy and includes medication review, glucose monitoring education and diet and lifestyle plans.") +
      ul(["HbA1c screening", "Neuropathy and nephropathy prevention", "Diet and lifestyle plan", "Gestational diabetes support"]),
    sortOrder: 2,
    media: [
      { id: "m-glucose-strips", url: "/seed/glucose-strips.webp", kind: "IMAGE" as const, originalName: "glucose-strips.webp" },
      { id: "m-glucose-finger", url: "/seed/glucose-finger.webp", kind: "IMAGE" as const, originalName: "glucose-finger.webp" },
    ],
  },
  {
    id: "treat-4",
    title: "Fever & Seasonal Infection Care",
    slug: "fever-and-seasonal-infection-care",
    category: "Infectious Diseases",
    isFlagship: false,
    shortSummary: "Diagnosis and treatment of viral fevers, malaria, dengue, typhoid and other seasonal infections.",
    contentHtml:
      h("Fast diagnosis, early treatment") +
      p("Same-day tests and observation beds help us treat infections quickly and monitor high-risk patients closely."),
    sortOrder: 3,
    media: [{ id: "m-doctor-vitals", url: "/seed/doctor-vitals.webp", kind: "IMAGE" as const, originalName: "doctor-vitals.webp" }],
  },
  {
    id: "treat-5",
    title: "Hypertension & Respiratory Care",
    slug: "hypertension-and-respiratory-care",
    category: "General Medicine",
    isFlagship: false,
    shortSummary: "Long-term blood pressure control and treatment of respiratory infections, headaches and migraines.",
    contentHtml:
      h("Control that lasts") +
      p("Regular review, medication optimisation and lifestyle advice keep blood pressure within target."),
    sortOrder: 4,
    media: [{ id: "m-nurse-bp", url: "/seed/nurse-bp.webp", kind: "IMAGE" as const, originalName: "nurse-bp.webp" }],
  },
  {
    id: "treat-6",
    title: "Wound Care & Minor Procedures",
    slug: "wound-care-and-minor-procedures",
    category: "Diagnostics & Wellness",
    isFlagship: false,
    shortSummary: "Wound suturing, sterile dressing, hydration therapy and short-stay observation.",
    contentHtml:
      h("Safe, sterile, same-day") +
      p("Minor procedures are performed under sterile conditions with observation beds available for recovery."),
    sortOrder: 5,
    media: [
      { id: "m-nurse-injection", url: "/seed/nurse-injection.webp", kind: "IMAGE" as const, originalName: "nurse-injection.webp" },
      { id: "m-ward-exam", url: "/seed/ward-exam.webp", kind: "IMAGE" as const, originalName: "ward-exam.webp" },
    ],
  },
];

export const FALLBACK_SERVICES = [
  {
    id: "serv-1",
    title: "Daycare Transfusion Unit",
    slug: "daycare-transfusion-unit",
    category: "Daycare",
    shortSummary: "Comfortable daycare beds for scheduled transfusions, with nurses at the bedside throughout.",
    contentHtml:
      h("Designed for repeat visits") +
      p("Clean waiting lounges, observation beds and attentive nursing make recurring transfusions easier for families."),
    sortOrder: 0,
    media: [
      { id: "m-blood-beds", url: "/seed/blood-beds.webp", kind: "IMAGE" as const, originalName: "blood-beds.webp" },
      { id: "m-clip-iv-drip", url: "/seed/clip-iv-drip.mp4", kind: "VIDEO" as const, originalName: "clip-iv-drip.mp4" },
    ],
  },
  {
    id: "serv-2",
    title: "Lab Diagnostics",
    slug: "lab-diagnostics",
    category: "Diagnostics",
    shortSummary: "Routine blood panels, biochemistry and HbA1c with dependable turnaround.",
    contentHtml:
      h("Tests you can trust") +
      p("Our lab supports every clinic and provides health checkup profiles."),
    sortOrder: 1,
    media: [
      { id: "m-lab-microscope", url: "/seed/lab-microscope.webp", kind: "IMAGE" as const, originalName: "lab-microscope.webp" },
      { id: "m-lab-notes", url: "/seed/lab-notes.webp", kind: "IMAGE" as const, originalName: "lab-notes.webp" },
    ],
  },
  {
    id: "serv-3",
    title: "24/7 Pharmacy",
    slug: "24-7-pharmacy",
    category: "Pharmacy",
    shortSummary: "Round-the-clock pharmacy with digital payment support and home delivery through our online store.",
    contentHtml:
      h("Medicines when you need them") +
      p("Order wellness and diabetes-care products online from the Pharmacy page and pay by cash on delivery or UPI."),
    sortOrder: 2,
    media: [
      { id: "m-pharmacy-shelves", url: "/seed/pharmacy-shelves.webp", kind: "IMAGE" as const, originalName: "pharmacy-shelves.webp" },
      { id: "m-pharmacy-counter", url: "/seed/pharmacy-counter.webp", kind: "IMAGE" as const, originalName: "pharmacy-counter.webp" },
    ],
  },
  {
    id: "serv-4",
    title: "Emergency & Observation Beds",
    slug: "emergency-and-observation-beds",
    category: "Emergency",
    shortSummary: "Open 24 hours for inpatient, daycare and urgent care, with observation beds and hydration therapy.",
    contentHtml:
      h("Always open") +
      p("Call +91 83285 81019 for urgent care. Our team is available around the clock."),
    sortOrder: 3,
    media: [
      { id: "m-ward-exam", url: "/seed/ward-exam.webp", kind: "IMAGE" as const, originalName: "ward-exam.webp" },
      { id: "m-nurse-care", url: "/seed/nurse-care.webp", kind: "IMAGE" as const, originalName: "nurse-care.webp" },
    ],
  },
  {
    id: "serv-5",
    title: "Senior Citizen Health Checkups",
    slug: "senior-citizen-health-checkups",
    category: "Outpatient",
    shortSummary: "Wellness profiles for older adults with unhurried consultations.",
    contentHtml:
      h("Preventive care for seniors") +
      p("Includes blood panels, biochemical tests and physician review."),
    sortOrder: 4,
    media: [{ id: "m-nurse-bp", url: "/seed/nurse-bp.webp", kind: "IMAGE" as const, originalName: "nurse-bp.webp" }],
  },
  {
    id: "serv-6",
    title: "Ayushman Bharat Cashless Desk",
    slug: "ayushman-bharat-cashless-desk",
    category: "Outpatient",
    shortSummary: "Dedicated assistance for PM-JAY and other public healthcare scheme paperwork and cashless admissions.",
    contentHtml:
      h("Help with paperwork") +
      p("Our desk guides you through eligibility, documents and pre-authorisation."),
    sortOrder: 5,
    media: [{ id: "m-hospital-corridor", url: "/seed/hospital-corridor.webp", kind: "IMAGE" as const, originalName: "hospital-corridor.webp" }],
  },
];

export const FALLBACK_DOCTORS = [
  {
    id: "doc-1",
    fullName: "Dr. D. Narayana Murthy, M.D.",
    slug: "dr-d-narayana-murthy-md",
    qualifications: "M.D.",
    designation: "Chief Consultant & Daycare Director",
    department: "Diabetology & General Medicine",
    consultationTimings: "OPD 9:00 AM – 8:00 PM · Emergency 24/7",
    isVisiting: false,
    experienceYears: 22,
    biographyHtml:
      p("Dr. Narayana Murthy, M.D., is the Chief Consultant, Diabetic Specialist and General Physician at Rithanya Hospital, and Director of its Thalassemia and Sickle Cell Daycare Transfusion Centre.") +
      p("He is widely respected in Khammam for managing diabetes and other chronic metabolic conditions, and for leading the humanitarian daycare wing for children and adults with hemoglobinopathies.") +
      p("Patients consistently highlight his conversational, reassuring manner and the time he takes to explain diagnoses and medicines clearly."),
    sortOrder: 0,
    media: [
      { id: "m-doctor-vitals", url: "/seed/doctor-vitals.webp", kind: "IMAGE" as const, originalName: "doctor-vitals.webp" },
      { id: "m-doctor-sitting", url: "/seed/doctor-sitting.webp", kind: "IMAGE" as const, originalName: "doctor-sitting.webp" },
    ],
  },
  {
    id: "doc-2",
    fullName: "Dr. A. Lakshmi Deepa",
    slug: "dr-a-lakshmi-deepa",
    qualifications: "M.B.B.S.",
    designation: "Co-Founder & Consulting Physician",
    department: "Hospital Leadership",
    consultationTimings: "By appointment",
    isVisiting: false,
    experienceYears: 18,
    biographyHtml: p("Dr. A. Lakshmi Deepa is co-founder of Rithanya Hospital and shares the hospital's vision of accessible, compassionate care for every family in Khammam."),
    sortOrder: 1,
    media: [{ id: "m-doctor-consult", url: "/seed/doctor-consult.webp", kind: "IMAGE" as const, originalName: "doctor-consult.webp" }],
  },
  {
    id: "doc-3",
    fullName: "Visiting Specialist Panel",
    slug: "visiting-specialist-panel",
    qualifications: "Various",
    designation: "Visiting Faculty",
    department: "Obstetrics & Gynaecology · Minimal Access Surgery · Physiotherapy",
    consultationTimings: "Call +91 83285 81019 for schedules",
    isVisiting: true,
    experienceYears: 15,
    biographyHtml: p("Consulting specialists in Obstetrics & Gynaecology, Infertility/Reproductive Medicine and Minimal Access Surgery visit the hospital along with physiotherapists and general surgeons."),
    sortOrder: 2,
    media: [{ id: "m-doctor-exam", url: "/seed/doctor-exam.webp", kind: "IMAGE" as const, originalName: "doctor-exam.webp" }],
  },
];

export const FALLBACK_INSURANCE = [
  {
    id: "ins-1",
    name: "Ayushman Bharat PM-JAY",
    schemeType: "Government Scheme",
    descriptionHtml:
      p("Rithanya Hospital is empaneled under PM-JAY for subsidised, cashless treatment.") +
      ul(["Carry your Ayushman card and a government photo ID", "Visit the cashless desk on arrival", "We assist with pre-authorisation"]),
    sortOrder: 0,
    media: [{ id: "m-logo-pmjay", url: "/seed/logo-pmjay.webp", kind: "IMAGE" as const, originalName: "logo-pmjay.webp" }],
  },
  {
    id: "ins-2",
    name: "Aarogyasri Health Care Trust",
    schemeType: "Government Scheme",
    descriptionHtml:
      p("Our desk helps eligible families navigate Aarogyasri enrolment and claims.") +
      ul(["White ration card / Aarogyasri card", "Photo ID of patient", "Referral documents where applicable"]),
    sortOrder: 1,
    media: [{ id: "m-logo-aarogyasri", url: "/seed/logo-aarogyasri.webp", kind: "IMAGE" as const, originalName: "logo-aarogyasri.webp" }],
  },
  {
    id: "ins-3",
    name: "Private Insurance & TPA Cashless",
    schemeType: "Private TPA",
    descriptionHtml:
      p("Private health insurance holders can request cashless pre-authorisation through our billing desk.") +
      ul(["Policy or e-card copy", "Photo ID", "Doctor's admission advice"]),
    sortOrder: 2,
    media: [{ id: "m-logo-tpa", url: "/seed/logo-tpa.webp", kind: "IMAGE" as const, originalName: "logo-tpa.webp" }],
  },
];

export const FALLBACK_GALLERY = [
  {
    id: "gal-1",
    title: "Wide, accessible corridors",
    mediaType: "IMAGE",
    caption: "Ramps, wheelchair access and wide corridors throughout.",
    embedCode: "",
    sortOrder: 0,
    media: [
      { id: "m-hospital-wheelchair", url: "/seed/hospital-wheelchair.webp", kind: "IMAGE" as const, originalName: "hospital-wheelchair.webp" },
      { id: "m-hospital-corridor", url: "/seed/hospital-corridor.webp", kind: "IMAGE" as const, originalName: "hospital-corridor.webp" },
    ],
  },
  {
    id: "gal-2",
    title: "Daycare transfusion beds",
    mediaType: "IMAGE",
    caption: "Calm, sanitised beds for scheduled transfusions.",
    embedCode: "",
    sortOrder: 1,
    media: [{ id: "m-blood-beds", url: "/seed/blood-beds.webp", kind: "IMAGE" as const, originalName: "blood-beds.webp" }],
  },
  {
    id: "gal-3",
    title: "Daycare in action",
    mediaType: "VIDEO",
    caption: "A short look at our IV and transfusion care.",
    embedCode: "",
    sortOrder: 2,
    media: [{ id: "m-clip-iv-drip", url: "/seed/clip-iv-drip.mp4", kind: "VIDEO" as const, originalName: "clip-iv-drip.mp4" }],
  },
  {
    id: "gal-4",
    title: "In-house laboratory",
    mediaType: "IMAGE",
    caption: "Fast, accurate diagnostics under one roof.",
    embedCode: "",
    sortOrder: 3,
    media: [{ id: "m-lab-microscope", url: "/seed/lab-microscope.webp", kind: "IMAGE" as const, originalName: "lab-microscope.webp" }],
  },
  {
    id: "gal-5",
    title: "Nursing care",
    mediaType: "IMAGE",
    caption: "Immediate attention from our nursing staff.",
    embedCode: "",
    sortOrder: 4,
    media: [{ id: "m-nurse-care", url: "/seed/nurse-care.webp", kind: "IMAGE" as const, originalName: "nurse-care.webp" }],
  },
  {
    id: "gal-6",
    title: "Blood donation camp",
    mediaType: "IMAGE",
    caption: "Community blood donation partnerships.",
    embedCode: "",
    sortOrder: 5,
    media: [{ id: "m-blood-donation", url: "/seed/blood-donation.webp", kind: "IMAGE" as const, originalName: "blood-donation.webp" }],
  },
  {
    id: "gal-7",
    title: "24/7 pharmacy",
    mediaType: "IMAGE",
    caption: "Medicines available around the clock.",
    embedCode: "",
    sortOrder: 6,
    media: [{ id: "m-pharmacy-shelves", url: "/seed/pharmacy-shelves.webp", kind: "IMAGE" as const, originalName: "pharmacy-shelves.webp" }],
  },
];

export const FALLBACK_TESTIMONIALS = [
  {
    id: "test-1",
    patientName: "Parent of a thalassemia patient",
    location: "Khammam",
    treatment: "Thalassemia daycare",
    rating: 5,
    quote: "The nurses attend to my child the moment we arrive and the doctor explains everything patiently. Transfusion days are no longer scary for us.",
    sortOrder: 0,
    media: [{ id: "m-nurse-care", url: "/seed/nurse-care.webp", kind: "IMAGE" as const, originalName: "nurse-care.webp" }],
  },
  {
    id: "test-2",
    patientName: "Diabetes patient & family",
    location: "Wyra Road",
    treatment: "Diabetology",
    rating: 5,
    quote: "Dr. Narayana Murthy gives encouragement along with treatment. The cost is affordable and my sugar is finally under control.",
    sortOrder: 1,
    media: [{ id: "m-glucose-meter", url: "/seed/glucose-meter.webp", kind: "IMAGE" as const, originalName: "glucose-meter.webp" }],
  },
  {
    id: "test-3",
    patientName: "Senior citizen visitor",
    location: "Nehru Nagar",
    treatment: "Senior wellness checkup",
    rating: 5,
    quote: "Very clean, easy to enter with a wheelchair, and everyone is courteous. Bills were clear and fair.",
    sortOrder: 2,
    media: [{ id: "m-nurse-bp", url: "/seed/nurse-bp.webp", kind: "IMAGE" as const, originalName: "nurse-bp.webp" }],
  },
];

export const FALLBACK_BLOGS = [
  {
    id: "blog-1",
    title: "Understanding HbA1c: Your Three-Month Sugar Report Card",
    slug: "understanding-hba1c-your-three-month-sugar-report-card",
    authorName: "Rithanya Medical Editorial",
    category: "Diabetes Management",
    excerpt: "HbA1c shows your average blood sugar over about three months. Here is how to read it and what to do next.",
    contentHtml:
      h("Why HbA1c matters") +
      p("Unlike a single finger-prick reading, HbA1c reflects your average control across roughly three months, making it the best marker of long-term diabetes management.") +
      ul(["Ask for HbA1c at least every three to six months", "Pair it with fasting and post-meal sugar logs", "Discuss any rising trend with your doctor early"]),
    isPublished: true,
    publishedAt: new Date("2026-09-15T10:00:00.000Z"),
    sortOrder: 0,
    media: [{ id: "m-glucose-strips", url: "/seed/glucose-strips.webp", kind: "IMAGE" as const, originalName: "glucose-strips.webp" }],
  },
  {
    id: "blog-2",
    title: "Living Well with Thalassemia: A Family Guide to Transfusion Days",
    slug: "living-well-with-thalassemia-a-family-guide-to-transfusion-days",
    authorName: "Rithanya Medical Editorial",
    category: "Blood Disorders",
    excerpt: "Preparing for a transfusion visit, what happens in daycare, and how families can support patients.",
    contentHtml:
      h("Before you arrive") +
      p("Eat a light meal, carry previous reports, and call ahead so that matched blood and a bed are ready.") +
      ul(["Bring your transfusion record", "Keep the patient hydrated", "Note any fever or reaction after returning home"]),
    isPublished: true,
    publishedAt: new Date("2026-09-18T10:00:00.000Z"),
    sortOrder: 1,
    media: [{ id: "m-blood-beds", url: "/seed/blood-beds.webp", kind: "IMAGE" as const, originalName: "blood-beds.webp" }],
  },
  {
    id: "blog-3",
    title: "Gestational Diabetes: Protecting Mother and Baby",
    slug: "gestational-diabetes-protecting-mother-and-baby",
    authorName: "Rithanya Medical Editorial",
    category: "Maternal Health",
    excerpt: "Screening, diet and follow-up that keep pregnancy safe when blood sugar runs high.",
    contentHtml:
      h("Early screening helps") +
      p("Gestational diabetes often has no symptoms, so screening during pregnancy is important. With diet changes and follow-up, most mothers deliver healthy babies."),
    isPublished: true,
    publishedAt: new Date("2026-09-22T10:00:00.000Z"),
    sortOrder: 2,
    media: [{ id: "m-doctor-consult", url: "/seed/doctor-consult.webp", kind: "IMAGE" as const, originalName: "doctor-consult.webp" }],
  },
  {
    id: "blog-4",
    title: "Monsoon Fevers: When to See a Doctor",
    slug: "monsoon-fevers-when-to-see-a-doctor",
    authorName: "Rithanya Medical Editorial",
    category: "General Wellness",
    excerpt: "Dengue, malaria and typhoid share symptoms. Know the warning signs that need prompt medical attention.",
    contentHtml:
      h("Do not wait out a fever") +
      p("Fever lasting more than two days, severe body ache, persistent vomiting or bleeding signs need immediate evaluation.") +
      ul(["Stay hydrated", "Avoid self-medicating with antibiotics", "Visit our 24/7 emergency desk for warning signs"]),
    isPublished: true,
    publishedAt: new Date("2026-09-26T10:00:00.000Z"),
    sortOrder: 3,
    media: [{ id: "m-doctor-vitals", url: "/seed/doctor-vitals.webp", kind: "IMAGE" as const, originalName: "doctor-vitals.webp" }],
  },
];

export const FALLBACK_PRODUCTS = [
  {
    id: "prod-1",
    name: "Digital Glucometer Kit",
    slug: "digital-glucometer-kit",
    category: "Diabetes Care",
    price: 899,
    stockUnits: 40,
    description: "Easy-read glucometer with lancing device and carry case.",
    isPrescriptionReq: false,
    sortOrder: 0,
    media: [
      { id: "m-glucose-meter", url: "/seed/glucose-meter.webp", kind: "IMAGE" as const, originalName: "glucose-meter.webp" },
      { id: "m-glucose-finger", url: "/seed/glucose-finger.webp", kind: "IMAGE" as const, originalName: "glucose-finger.webp" },
    ],
  },
  {
    id: "prod-2",
    name: "Glucose Test Strips (50)",
    slug: "glucose-test-strips-50",
    category: "Diabetes Care",
    price: 749,
    stockUnits: 120,
    description: "Compatible test strips, pack of 50.",
    isPrescriptionReq: false,
    sortOrder: 1,
    media: [{ id: "m-glucose-strips", url: "/seed/glucose-strips.webp", kind: "IMAGE" as const, originalName: "glucose-strips.webp" }],
  },
  {
    id: "prod-3",
    name: "Digital BP Monitor",
    slug: "digital-bp-monitor",
    category: "Senior Care",
    price: 1499,
    stockUnits: 25,
    description: "Automatic upper-arm blood pressure monitor with memory.",
    isPrescriptionReq: false,
    sortOrder: 2,
    media: [{ id: "m-nurse-bp", url: "/seed/nurse-bp.webp", kind: "IMAGE" as const, originalName: "nurse-bp.webp" }],
  },
  {
    id: "prod-4",
    name: "Fingertip Pulse Oximeter",
    slug: "fingertip-pulse-oximeter",
    category: "Wellness",
    price: 1199,
    stockUnits: 30,
    description: "Measure SpO2 and pulse rate in seconds.",
    isPrescriptionReq: false,
    sortOrder: 3,
    media: [{ id: "m-doctor-vitals", url: "/seed/doctor-vitals.webp", kind: "IMAGE" as const, originalName: "doctor-vitals.webp" }],
  },
  {
    id: "prod-5",
    name: "Oral Rehydration Salts (ORS) Pack",
    slug: "oral-rehydration-salts-ors-pack",
    category: "First Aid",
    price: 120,
    stockUnits: 200,
    description: "WHO-formula ORS sachets, pack of 10.",
    isPrescriptionReq: false,
    sortOrder: 4,
    media: [{ id: "m-pharmacy-bottle", url: "/seed/pharmacy-bottle.webp", kind: "IMAGE" as const, originalName: "pharmacy-bottle.webp" }],
  },
  {
    id: "prod-6",
    name: "Sterile Dressing Kit",
    slug: "sterile-dressing-kit",
    category: "First Aid",
    price: 349,
    stockUnits: 60,
    description: "Sterile gauze, bandages and tape for wound care.",
    isPrescriptionReq: false,
    sortOrder: 5,
    media: [{ id: "m-nurse-injection", url: "/seed/nurse-injection.webp", kind: "IMAGE" as const, originalName: "nurse-injection.webp" }],
  },
  {
    id: "prod-7",
    name: "Diabetic Nutrition Drink",
    slug: "diabetic-nutrition-drink",
    category: "Diabetes Care",
    price: 560,
    stockUnits: 50,
    description: "Balanced nutrition powder designed for diabetics.",
    isPrescriptionReq: false,
    sortOrder: 6,
    media: [{ id: "m-pharmacy-shelves", url: "/seed/pharmacy-shelves.webp", kind: "IMAGE" as const, originalName: "pharmacy-shelves.webp" }],
  },
  {
    id: "prod-8",
    name: "Digital Thermometer",
    slug: "digital-thermometer",
    category: "Wellness",
    price: 199,
    stockUnits: 90,
    description: "Fast, accurate digital thermometer.",
    isPrescriptionReq: false,
    sortOrder: 7,
    media: [{ id: "m-pharmacy-counter", url: "/seed/pharmacy-counter.webp", kind: "IMAGE" as const, originalName: "pharmacy-counter.webp" }],
  },
];

export const FALLBACK_FACILITIES = [
  {
    id: "fac-1",
    title: "24/7 Emergency & Observation Wing",
    slug: "24-7-emergency-and-observation-wing",
    shortSummary: "Round-the-clock emergency care, rapid triage, trauma stabilization, observation beds and IV hydration therapy.",
    contentHtml:
      h("Round-the-Clock Emergency Response") +
      p("Our emergency department operates 24/7, 365 days a year with dedicated medical officers, critical care trained nursing staff, continuous vitals monitoring, and observation beds.") +
      ul([
        "24/7 emergency triage and acute medical stabilization",
        "Dedicated observation beds with multi-parameter monitors",
        "Rapid IV hydration and emergency medication administration",
        "Direct link to diagnostic laboratory and round-the-clock pharmacy",
      ]),
    sortOrder: 0,
    media: [
      { id: "m-emergency-beds", url: "/seed/hospital-corridor.webp", kind: "IMAGE" as const, originalName: "hospital-corridor.webp" },
      { id: "m-doctor-vitals", url: "/seed/doctor-vitals.webp", kind: "IMAGE" as const, originalName: "doctor-vitals.webp" },
    ],
  },
  {
    id: "fac-2",
    title: "Daycare Blood Transfusion Centre",
    slug: "daycare-blood-transfusion-centre",
    shortSummary: "Sanitised, family-friendly daycare transfusion unit with dedicated nursing, blood warmer technology, and saline flush protocols.",
    contentHtml:
      h("Safe, Sanitised Transfusion Protocols") +
      p("Rithanya Hospital is renowned across Khammam for its compassionate Daycare Transfusion Centre, providing scheduled blood transfusions for Thalassemia, Sickle Cell, and severe anaemia patients in a comfortable environment.") +
      ul([
        "Pre-transfusion screening and blood cross-matching verification",
        "Bedside nursing with real-time temperature and pulse monitoring",
        "Post-transfusion hydration and ferritin level tracking",
        "Subsidized and charitable care coordination",
      ]),
    sortOrder: 1,
    media: [
      { id: "m-transfusion-unit", url: "/seed/blood-bags.webp", kind: "IMAGE" as const, originalName: "blood-bags.webp" },
      { id: "m-nurse-care", url: "/seed/nurse-care.webp", kind: "IMAGE" as const, originalName: "nurse-care.webp" },
    ],
  },
  {
    id: "fac-3",
    title: "In-House Diagnostic Laboratory",
    slug: "in-house-diagnostic-laboratory",
    shortSummary: "Automated clinical biochemistry, hematology, HbA1c testing, blood grouping and infectious disease serology with rapid turnaround.",
    contentHtml:
      h("Precision Laboratory Diagnostics") +
      p("Equipped with automated hematology analyzers, biochemistry platforms, and electrolyte testers to deliver accurate diagnostic reports within hours.") +
      ul([
        "Automated CBC, Hemoglobin electrophoresis, and blood smear testing",
        "HbA1c, lipid profiles, renal function, and liver enzyme panels",
        "Rapid serological testing for Dengue, Malaria, Typhoid, and Viral Fevers",
        "Computerized barcoded samples ensuring zero sample mix-ups",
      ]),
    sortOrder: 2,
    media: [
      { id: "m-lab-microscope", url: "/seed/lab-microscope.webp", kind: "IMAGE" as const, originalName: "lab-microscope.webp" },
      { id: "m-glucose-strips", url: "/seed/glucose-strips.webp", kind: "IMAGE" as const, originalName: "glucose-strips.webp" },
    ],
  },
  {
    id: "fac-4",
    title: "24/7 Pharmacy & Cold Storage",
    slug: "24-7-pharmacy-and-cold-storage",
    shortSummary: "Fully stocked hospital pharmacy with cold chain storage for insulin, vaccines, and emergency life-saving formulations.",
    contentHtml:
      h("Reliable Medication Access Around the Clock") +
      p("Our in-house pharmacy dispenses 100% genuine medications, chronic maintenance drugs, insulin cartridges, surgical disposables, and pediatric suspensions at transparent prices.") +
      ul([
        "Temperature-controlled cold storage for biologics and insulin",
        "24/7 walk-in counter and instant bedside dispensing for inpatients",
        "Digital billing with GST-compliant itemized receipts",
        "Online home delivery and WhatsApp prescription refills",
      ]),
    sortOrder: 3,
    media: [
      { id: "m-pharmacy-shelves", url: "/seed/pharmacy-shelves.webp", kind: "IMAGE" as const, originalName: "pharmacy-shelves.webp" },
      { id: "m-pharmacy-counter", url: "/seed/pharmacy-counter.webp", kind: "IMAGE" as const, originalName: "pharmacy-counter.webp" },
    ],
  },
  {
    id: "fac-5",
    title: "Wheelchair-Accessible Infrastructure",
    slug: "wheelchair-accessible-infrastructure",
    shortSummary: "Gentle entrance ramps, spacious non-slip corridors, accessible restrooms, and dedicated wheelchair assistance.",
    contentHtml:
      h("Barrier-Free Care for Every Patient") +
      p("Designed from the ground up to ensure effortless mobility for senior citizens, post-operative patients, and individuals with disabilities.") +
      ul([
        "Gradual incline ramps with sturdy support handrails at all entries",
        "Wide corridors accommodating patient stretchers and wheelchairs comfortably",
        "Specially fitted accessible washrooms with safety grab-bars",
        "Hospital assistance staff available at the porch on arrival",
      ]),
    sortOrder: 4,
    media: [
      { id: "m-hospital-corridor", url: "/seed/hospital-corridor.webp", kind: "IMAGE" as const, originalName: "hospital-corridor.webp" },
    ],
  },
  {
    id: "fac-6",
    title: "Cashless Insurance & Ayushman Desk",
    slug: "cashless-insurance-and-ayushman-desk",
    shortSummary: "Dedicated liaison officers facilitating seamless pre-authorizations for PM-JAY, Aarogyasri, and major private health TPAs.",
    contentHtml:
      h("Hassle-Free Health Insurance Processing") +
      p("Our dedicated insurance assistance desk guides patients and families through paperwork, pre-authorization claims, and fast settlement.") +
      ul([
        "Empaneled under Ayushman Bharat PM-JAY and Telangana Aarogyasri",
        "Network hospital for Star Health, Care Health, HDFC ERGO, ICICI Lombard",
        "Transparent pre-authorization and query-resolution desk",
        "Zero-delay admission coordination for covered procedures",
      ]),
    sortOrder: 5,
    media: [
      { id: "m-insurance-desk", url: "/seed/doctor-consult.webp", kind: "IMAGE" as const, originalName: "doctor-consult.webp" },
    ],
  },
];

export const FALLBACK_BLOOD_STOCK = [
  { id: "bs-op", bloodGroup: "O+", groupCategory: "O", colorCode: "SKY_BLUE", wholeBloodUnits: 14, plasmaUnits: 9, lastUpdated: new Date() },
  { id: "bs-on", bloodGroup: "O-", groupCategory: "O", colorCode: "SKY_BLUE", wholeBloodUnits: 8, plasmaUnits: 5, lastUpdated: new Date() },
  { id: "bs-ap", bloodGroup: "A+", groupCategory: "A", colorCode: "YELLOW", wholeBloodUnits: 11, plasmaUnits: 7, lastUpdated: new Date() },
  { id: "bs-an", bloodGroup: "A-", groupCategory: "A", colorCode: "YELLOW", wholeBloodUnits: 6, plasmaUnits: 4, lastUpdated: new Date() },
  { id: "bs-bp", bloodGroup: "B+", groupCategory: "B", colorCode: "RED", wholeBloodUnits: 9, plasmaUnits: 6, lastUpdated: new Date() },
  { id: "bs-bn", bloodGroup: "B-", groupCategory: "B", colorCode: "RED", wholeBloodUnits: 5, plasmaUnits: 3, lastUpdated: new Date() },
  { id: "bs-abp", bloodGroup: "AB+", groupCategory: "AB", colorCode: "WHITE", wholeBloodUnits: 4, plasmaUnits: 3, lastUpdated: new Date() },
  { id: "bs-abn", bloodGroup: "AB-", groupCategory: "AB", colorCode: "WHITE", wholeBloodUnits: 2, plasmaUnits: 2, lastUpdated: new Date() },
];
