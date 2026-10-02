import { prisma, isDbOnCooldown, reportDbError, reportDbSuccess } from "./db.js";

export const DEFAULT_ADDRESS =
  "Opposite Old LIC Office, Wyra Road, Nehru Nagar, Khammam HO, Khammam – 507001, Telangana, India";

export const DEFAULT_SETTINGS = {
  id: "PRIMARY_CONFIG",
  legalName: "Rithanya Hospital",
  clinicalTagline: "Dedicated Thalassemia Daycare, Diabetology & 24/7 Emergency Care",
  emergencyHotline: "8328581019",
  secondaryHotline: "9054177824",
  whatsappNumber: "918328581019",
  email: "care@rithanyahospital.com",
  criticalBloodAlertThreshold: 3,
  physicalAddress: DEFAULT_ADDRESS,
  opdTimings: "Open 24 Hours | Daycare & OPD: 9:00 AM - 8:00 PM",
  noticeBanner:
    "Thalassemia & Sickle Cell daycare transfusions run by appointment — please call ahead so a bed and matched blood are ready for you.",
  seoPageTitle: "Rithanya Hospital (రితన్య హాస్పిటల్) | Khammam | 24/7 Emergency, Thalassemia Daycare & Diabetology",
  metaDescription:
    "Rithanya Hospital, Wyra Road, Opposite Old LIC Office, Khammam. Thalassemia & Sickle Cell Daycare Transfusion Centre, Diabetology, 24/7 emergency care, blood bank and Ayushman Bharat PM-JAY cashless treatment. Best Hospital Award 2022 by the District Collector.",
  targetKeywords:
    "Rithanya Hospital, hospital in Khammam, thalassemia daycare Khammam, diabetologist Khammam, Dr Narayana Murthy, sickle cell transfusion, Ayushman Bharat Khammam, 24/7 emergency Khammam",
  canonicalUrl: "https://rithanyahospital.com",
  robotsIndexFollow: true,
  faviconUrl: null as string | null,
  socialShareThumbnailUrl: null as string | null,
};

export async function getSettings() {
  if (isDbOnCooldown()) return DEFAULT_SETTINGS;
  try {
    const row = await prisma.hospitalSetting.findUnique({ where: { id: "PRIMARY_CONFIG" } });
    if (row) {
      reportDbSuccess();
      return row;
    }
    try {
      const created = await prisma.hospitalSetting.create({ data: DEFAULT_SETTINGS });
      reportDbSuccess();
      return created;
    } catch {
      const again = await prisma.hospitalSetting.findUnique({ where: { id: "PRIMARY_CONFIG" } });
      if (!again) return DEFAULT_SETTINGS;
      reportDbSuccess();
      return again;
    }
  } catch (err) {
    reportDbError(err);
    console.warn("[settings] Database offline or query timed out, using DEFAULT_SETTINGS:", err instanceof Error ? err.message : err);
    return DEFAULT_SETTINGS;
  }
}
