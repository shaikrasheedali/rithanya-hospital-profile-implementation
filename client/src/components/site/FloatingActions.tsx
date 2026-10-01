"use client";

import { MessageCircle, Phone } from "lucide-react";
import { telHref } from "@/lib/utils";

export function FloatingActions({ phone, whatsapp }: { phone: string; whatsapp: string }) {
  return (
    <div className="no-print fixed bottom-5 right-5 z-40 flex flex-col gap-3">
      <a
        href={`https://wa.me/${whatsapp}?text=${encodeURIComponent("Hello Rithanya Hospital, I would like a consultation.")}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl hover:scale-110"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
      <a
        href={telHref(phone)}
        aria-label="Call emergency hotline"
        className="flex h-14 w-14 animate-pulse-ring items-center justify-center rounded-full bg-[#D32F2F] text-white shadow-xl hover:scale-110"
      >
        <Phone className="h-7 w-7" />
      </a>
    </div>
  );
}
