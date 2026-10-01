import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { CartProvider } from "@/components/site/CartProvider";
import { BookingProvider } from "@/components/site/BookingProvider";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { FloatingActions } from "@/components/site/FloatingActions";
import type { Settings } from "@/lib/auth";

const FALLBACK: Settings = {
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
  seoPageTitle: "",
  metaDescription: "",
  targetKeywords: "",
  canonicalUrl: "https://rithanyahospital.com",
  robotsIndexFollow: true,
  faviconUrl: null,
  socialShareThumbnailUrl: null,
};

export default function SiteLayout() {
  const [s, setS] = useState<Settings>(FALLBACK);

  useEffect(() => {
    fetch("/api/public/settings")
      .then((r) => r.json())
      .then((d) => d.settings && setS(d.settings))
      .catch(() => undefined);
  }, []);

  return (
    <CartProvider>
      <BookingProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
        <Navbar brand={s.legalName} phone={s.emergencyHotline} />
        <main id="main" className="min-h-screen bg-canvas">
          <Outlet />
        </main>
        <Footer s={s} />
        <FloatingActions phone={s.emergencyHotline} whatsapp={s.whatsappNumber} />
      </BookingProvider>
    </CartProvider>
  );
}
