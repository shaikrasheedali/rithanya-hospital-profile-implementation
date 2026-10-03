import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Settings } from "@/lib/auth";

export const FALLBACK_SETTINGS: Settings = {
  id: "PRIMARY_CONFIG",
  legalName: "Rithanya Hospital",
  clinicalTagline: "Dedicated Thalassemia Daycare, Diabetology & 24/7 Emergency Care",
  emergencyHotline: "8328581019",
  secondaryHotline: "9054177824",
  whatsappNumber: "918328581019",
  email: "care@rithanyahospital.com",
  criticalBloodAlertThreshold: 3,
  physicalAddress: "Opposite Old LIC Office, Wyra Road, Khammam – 507001",
  opdTimings: "Open 24 Hours | Daycare & OPD: 9:00 AM - 8:00 PM",
  noticeBanner: "",
  seoPageTitle: "Rithanya Hospital | Khammam",
  metaDescription: "Multi-speciality hospital in Khammam",
  targetKeywords: "hospital, khammam",
  canonicalUrl: "https://rithanyahospital.com",
  robotsIndexFollow: true,
  faviconUrl: null,
  socialShareThumbnailUrl: null,
};

type SettingsContextType = {
  settings: Settings;
  reloadSettings: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextType>({
  settings: FALLBACK_SETTINGS,
  reloadSettings: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(FALLBACK_SETTINGS);

  async function reloadSettings() {
    try {
      const res = await fetch("/api/public/settings", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const d = await res.json();
        if (d?.settings) setSettings(d.settings);
      }
    } catch (err) {
      console.warn("Could not load settings:", err);
    }
  }

  useEffect(() => {
    reloadSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, reloadSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSiteSettings(): SettingsContextType {
  return useContext(SettingsContext);
}
