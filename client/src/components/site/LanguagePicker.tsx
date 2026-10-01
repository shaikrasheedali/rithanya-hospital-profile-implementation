"use client";

import { useEffect, useState } from "react";
import { Languages } from "lucide-react";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: { translate: { TranslateElement: new (opts: object, id: string) => unknown } };
  }
}

export function LanguagePicker({ dark = false }: { dark?: boolean }) {
  const [lang, setLang] = useState("en");

  useEffect(() => {
    const m = document.cookie.match(/googtrans=\/en\/(\w+)/);
    if (m) setLang(m[1]);
    if (document.getElementById("google-translate-script")) return;
    window.googleTranslateElementInit = () => {
      if (!window.google) return;
      new window.google.translate.TranslateElement(
        { pageLanguage: "en", includedLanguages: "en,te,hi", autoDisplay: false },
        "google_translate_element",
      );
    };
    const s = document.createElement("script");
    s.id = "google-translate-script";
    s.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  function change(code: string) {
    setLang(code);
    const select = document.querySelector<HTMLSelectElement>(".goog-te-combo");
    if (select) {
      select.value = code;
      select.dispatchEvent(new Event("change"));
    } else {
      // Fallback: set the translate cookie and reload so the engine picks it up.
      const val = code === "en" ? "" : `/en/${code}`;
      document.cookie = `googtrans=${val}; path=/`;
      if (code === "en") document.cookie = "googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      location.reload();
    }
  }

  return (
    <div className="notranslate relative inline-flex items-center" translate="no">
      <div id="google_translate_element" className="hidden" />
      <label
        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
          dark ? "border-white/25 bg-white/10 text-white" : "border-line bg-white/70 text-navy"
        }`}
      >
        <Languages className={`h-4 w-4 ${dark ? "text-gold" : "text-royal"}`} />
        <span className="sr-only">Language</span>
        <select
          value={lang}
          onChange={(e) => change(e.target.value)}
          className="cursor-pointer bg-transparent pr-1 outline-none [&>option]:text-navy"
          aria-label="Select language"
        >
          <option value="en">English</option>
          <option value="te">తెలుగు</option>
          <option value="hi">हिन्दी</option>
        </select>
      </label>
    </div>
  );
}
