import { Outlet } from "react-router-dom";
import { CartProvider } from "@/components/site/CartProvider";
import { BookingProvider } from "@/components/site/BookingProvider";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { FloatingActions } from "@/components/site/FloatingActions";
import { SettingsProvider, useSiteSettings } from "@/lib/settingsContext";

function SiteInner() {
  const { settings: s } = useSiteSettings();

  return (
    <CartProvider>
      <BookingProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <Navbar brand={s.legalName} phone={s.emergencyHotline} />
        <main id="main" className="min-h-screen bg-canvas">
          <Outlet />
        </main>
        <Footer s={s} />
        <FloatingActions
          phone={s.emergencyHotline}
          whatsapp={s.whatsappNumber}
        />
      </BookingProvider>
    </CartProvider>
  );
}

export default function SiteLayout() {
  return (
    <SettingsProvider>
      <SiteInner />
    </SettingsProvider>
  );
}
