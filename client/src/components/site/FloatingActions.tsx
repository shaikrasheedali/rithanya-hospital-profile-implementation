"use client";

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, Phone } from "lucide-react";
import { telHref } from "@/lib/utils";

export function FloatingActions({ phone, whatsapp }: { phone: string; whatsapp: string }) {
  const { pathname } = useLocation();
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > Math.min(window.innerHeight, 560));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  // On the home hero the call and booking buttons are already in view, and the
  // fixed pills would cover the copy on phones and short landscape screens.
  // Show them only once the visitor has scrolled past the hero.
  const onHomeHero = pathname === "/" && !pastHero;

  return (
    <div className={`no-print floating-actions fixed bottom-3 right-3 z-40 flex flex-col gap-2.5 md:bottom-5 md:right-5 md:gap-3 ${onHomeHero ? "max-sm:hidden floating-hide-short" : ""}`}>
      <a
        href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hello Rithanya Hospital, I would like a consultation.")}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl hover:scale-110 md:h-14 md:w-14"
      >
        <MessageCircle className="h-6 w-6 md:h-7 md:w-7" />
      </a>
      <a
        href={telHref(phone)}
        aria-label="Call emergency hotline"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D32F2F] text-white shadow-xl hover:scale-110 max-md:animate-none md:h-14 md:w-14 md:animate-pulse-ring"
      >
        <Phone className="h-6 w-6 md:h-7 md:w-7" />
      </a>
    </div>
  );
}
