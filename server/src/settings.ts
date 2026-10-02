import { prisma, isDbOnCooldown, reportDbError, reportDbSuccess, withDbTimeout } from "./db.js";

export const DEFAULT_ADDRESS =
  "Opposite Old LIC Office, Wyra Road, Nehru Nagar, Khammam HO, Khammam – 507001, Telangana, India";

export const DEFAULT_SETTINGS = {
  id: "PRIMARY_CONFIG",
  legalName: "Rithanya Hospital",
  clinicalTagline: "Dedicated Thalassemia Daycare, Diabetology & 24/7 Emergency Care",
  emergencyHotline: "8328581019",
  secondaryHotline: "9054177824" as string | null,
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

let cachedSettings = { ...DEFAULT_SETTINGS };
let settingsLoaded = false;

export function updateCachedSettings(partial: Partial<typeof DEFAULT_SETTINGS>): void {
  cachedSettings = { ...cachedSettings, ...partial };
}

export async function getSettings() {
  if (settingsLoaded || isDbOnCooldown()) return cachedSettings;
  try {
    const row = await withDbTimeout(prisma.hospitalSetting.findUnique({ where: { id: "PRIMARY_CONFIG" } }), 1500);
    if (row) {
      reportDbSuccess();
      cachedSettings = { ...cachedSettings, ...row };
      settingsLoaded = true;
      return cachedSettings;
    }
  } catch (err) {
    reportDbError(err);
    console.warn("[settings] Database query timed out, using cached settings:", err instanceof Error ? err.message : err);
  }
  return cachedSettings;
}
