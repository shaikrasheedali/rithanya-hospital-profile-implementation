import fs from "node:fs";
import path from "node:path";
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

const CACHE_FILE = path.resolve(process.cwd(), "uploads", "settings-cache.json");

function loadSettingsCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    }
  } catch (err) {
    console.warn("[settings] Could not read settings cache:", err);
  }
  return { ...DEFAULT_SETTINGS };
}

let cachedSettings = loadSettingsCache();
let settingsLoaded = false;

function persistSettingsCache(): void {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedSettings, null, 2), "utf-8");
  } catch (err) {
    console.warn("[settings] Could not persist settings cache file:", err);
  }
}

export function updateCachedSettings(partial: Partial<typeof DEFAULT_SETTINGS>): void {
  cachedSettings = { ...cachedSettings, ...partial };
  persistSettingsCache();
}

export async function getSettings() {
  if (isDbOnCooldown()) return cachedSettings;
  try {
    const row = await withDbTimeout(prisma.hospitalSetting.findUnique({ where: { id: "PRIMARY_CONFIG" } }), 1500);
    if (row) {
      reportDbSuccess();
      cachedSettings = { ...cachedSettings, ...row };
      settingsLoaded = true;
      persistSettingsCache();
      return cachedSettings;
    }
  } catch (err) {
    reportDbError(err);
    console.warn("[settings] Database query timed out, using cached settings:", err instanceof Error ? err.message : err);
  }
  return cachedSettings;
}
