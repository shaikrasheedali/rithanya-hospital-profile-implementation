"use client";
import { Link, useLocation } from "react-router-dom";


import { useEffect, useState } from "react";
import { ChevronDown, HeartPulse, LogIn, Menu, Phone, ShoppingBag, X } from "lucide-react";
import { LanguagePicker } from "@/components/site/LanguagePicker";
import { useCart } from "@/components/site/CartProvider";
import { telHref } from "@/lib/utils";

type NavItem = { label: string; href: string; children?: { label: string; href: string }[] };

const NAV: NavItem[] = [
  {
    label: "Departments",
    href: "/clinical-care",
    children: [
      { label: "Specialties", href: "/clinical-care/specialties" },
      { label: "Treatments", href: "/clinical-care/treatments" },
      { label: "Services", href: "/clinical-care/services" },
    ],
  },
  { label: "Doctors", href: "/doctors" },
  { label: "Facilities", href: "/about#facilities" },
  { label: "Pharmacy", href: "/products" },
  { label: "Insights", href: "/insights" },
  {
    label: "Hospital",
    href: "/about",
    children: [
      { label: "About Us", href: "/about" },
      { label: "Insurance Providers", href: "/insurance-providers" },
      { label: "Gallery", href: "/gallery" },
      { label: "DPDP Erasure Request", href: "/dpdp-erasure-request" },
    ],
  },
  { label: "Contact", href: "/contact" },
];

export function Navbar({ brand, phone }: { brand: string; phone: string }) {
  const pathname = useLocation().pathname;
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { count, open: openCart } = useCart();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 60);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  const solid = !isHome || scrolled;
  const linkCls = solid
    ? "text-white/90 hover:text-gold"
    : "text-[#333333] hover:text-[#0D47A1]";

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors ${solid ? "bg-navy shadow-lg shadow-navy/20 on-dark" : "bg-white/85 shadow-sm backdrop-blur-md"}`}>
      <nav className={`mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 transition-all sm:px-6 lg:px-8 xl:px-6 ${solid ? "py-3" : "py-4"}`} aria-label="Primary">
        <Link to="/" className="flex flex-none items-center gap-2.5" aria-label={`${brand} — home`}>
          <img
            src="/logo.png"
            alt={`${brand} logo`}
            className="h-10 w-10 flex-none object-contain drop-shadow-sm transition-transform hover:scale-105"
          />
          <span className={`whitespace-nowrap text-xl font-semibold transition-colors ${solid ? "text-white" : "text-[#0A2540]"}`} style={{ fontFamily: "var(--font-heading)" }}>
            {brand}
          </span>
        </Link>

        <ul className="hidden items-center gap-3 xl:flex">
          {NAV.map((item) => (
            <li key={item.label} className="group relative">
              <Link to={item.href} className={`flex items-center gap-1 whitespace-nowrap py-2 text-sm font-medium transition-colors 2xl:text-base ${linkCls}`}>
                {item.label}
                {item.children && <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />}
              </Link>
              {item.children && (
                <div className="invisible absolute left-1/2 top-full z-10 w-64 -translate-x-1/2 translate-y-2 pt-3 opacity-0 transition-all group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <ul className="rounded-xl border border-line bg-white p-2 shadow-2xl">
                    {item.children.map((c) => (
                      <li key={c.href}>
                        <Link to={c.href} className="block rounded-lg px-4 py-2.5 text-base text-[#333333] hover:bg-canvas hover:text-[#0D47A1]">
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
          <li>
            <a href={telHref(phone)} className={`flex items-center gap-1.5 whitespace-nowrap py-2 text-sm font-semibold transition-colors 2xl:text-base ${solid ? "text-[#ff8a80] hover:text-white" : "text-[#D32F2F] hover:text-[#0A2540]"}`}>
              <Phone className="h-4 w-4" /> Emergency
            </a>
          </li>
        </ul>

        <div className="flex flex-none items-center gap-1.5 sm:gap-2">
          <div className="hidden md:block">
            <LanguagePicker dark={solid} />
          </div>
          <button
            onClick={openCart}
            aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
            className={`relative rounded-full p-2.5 ${solid ? "text-white hover:bg-white/10" : "text-[#0A2540] hover:bg-black/5"}`}
          >
            <ShoppingBag className="h-6 w-6" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#D32F2F] px-1 text-xs font-bold text-white">{count}</span>
            )}
          </button>
          <Link to="/portal/login"
            className={`hidden items-center gap-2 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-semibold xl:flex 2xl:px-4 ${
              solid ? "border-white/30 text-white hover:border-gold hover:text-gold" : "border-[#0A2540]/30 text-[#0A2540] hover:border-[#0D47A1] hover:text-[#0D47A1]"
            }`}
          >
            <LogIn className="h-4 w-4" /> Staff Login
          </Link>
          <button
            className={`rounded-full p-2.5 xl:hidden ${solid ? "text-white hover:bg-white/10" : "text-[#0A2540] hover:bg-black/5"}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="mx-4 mb-4 max-h-[78vh] overflow-y-auto rounded-2xl bg-[#F8F9FA]/95 p-5 shadow-2xl backdrop-blur-md xl:hidden">
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.label}>
                <Link to={item.href} className="block rounded-lg px-3 py-3 text-lg font-semibold text-[#0A2540] hover:bg-white hover:text-[#0D47A1]">
                  {item.label}
                </Link>
                {item.children && (
                  <ul className="mb-1 ml-3 border-l-2 border-line pl-3">
                    {item.children.map((c) => (
                      <li key={c.href}>
                        <Link to={c.href} className="block rounded-lg px-3 py-2.5 text-base text-[#333333] hover:text-[#0D47A1]">
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            <li>
              <a href={telHref(phone)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-lg font-semibold text-[#D32F2F]">
                <Phone className="h-5 w-5" /> Emergency
              </a>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <LanguagePicker />
            <Link to="/portal/login" className="flex items-center gap-2 rounded-full border border-[#0A2540]/30 px-4 py-2 text-sm font-semibold text-[#0A2540]">
              <LogIn className="h-4 w-4" /> Staff Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
