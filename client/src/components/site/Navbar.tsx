"use client";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogIn, Menu, Phone, ShoppingBag, X } from "lucide-react";
import { LanguagePicker } from "@/components/site/LanguagePicker";
import { useCart } from "@/components/site/CartProvider";
import { telHref } from "@/lib/utils";

type NavItem = { label: string; href: string; children?: { label: string; href: string }[] };

const NAV: NavItem[] = [
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
  { label: "Facilities", href: "/facilities" },
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
  { label: "Products", href: "/products" },
  { label: "Blogs", href: "/blogs" },
  { label: "Contact us", href: "/contact" },
];

export function Navbar({ brand, phone }: { brand: string; phone: string }) {
  const pathname = useLocation().pathname;
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const { count, open: openCart } = useCart();

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 60);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  // If the viewport grows to the desktop breakpoint while the drawer is open,
  // close it so the body scroll lock is released with it.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const onChange = () => desktop.matches && setOpen(false);
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  // Mobile menu: lock the page behind it, close on Escape, and hand focus back
  // to the trigger. Without this the page scrolls underneath the open panel.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    // Clicking the page around the dropdown closes it, except for the trigger
    // itself (its own click handler toggles the menu).
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuPanelRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.body.classList.add("nav-menu-open");
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("nav-menu-open");
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const solid = !isHome || scrolled;
  const linkCls = solid
    ? "text-white/90 hover:text-gold"
    : "text-[#333333] hover:text-[#0D47A1]";

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-colors ${solid ? "bg-navy shadow-lg shadow-navy/20 on-dark" : "bg-white/90 shadow-sm backdrop-blur-md"}`}>
      <nav className={`mx-auto max-w-[1440px] flex items-center justify-between gap-2 px-3 sm:px-5 lg:px-6 transition-all ${solid ? "py-2.5" : "py-3"}`} aria-label="Primary">
        <Link to="/" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5 xl:flex-none" aria-label={`${brand} — home`}>
          <img
            src="/logo.png"
            alt={`${brand} logo`}
            className="h-9 w-9 flex-none object-contain drop-shadow-sm transition-transform hover:scale-105"
          />
          {/* Below 400px the wordmark would crowd the three header controls on an
              iPhone SE. It returns as soon as there is room and truncates for long names. */}
          <span className={`hidden min-[400px]:inline-block min-w-0 truncate text-base sm:text-lg xl:max-w-[11.5rem] 2xl:max-w-[24rem] xl:text-xl font-bold tracking-tight transition-colors ${solid ? "text-white" : "text-[#0A2540]"}`} style={{ fontFamily: "var(--font-heading)" }}>
            {brand}
          </span>
        </Link>

        <ul className="hidden items-center gap-0.5 xl:gap-1 2xl:gap-2 xl:flex">
          {NAV.map((item) => (
            <li key={item.label} className="group relative">
              <Link
                to={item.href}
                className={`flex items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-1.5 text-[13.5px] 2xl:px-3 2xl:text-sm font-medium transition-all ${linkCls} ${
                  solid ? "hover:bg-white/10" : "hover:bg-black/5"
                }`}
              >
                {item.label}
                {item.children && <ChevronDown className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:rotate-180" />}
              </Link>
              {item.children && (
                <div className="invisible absolute left-1/2 top-full z-10 w-60 -translate-x-1/2 translate-y-2 pt-2 opacity-0 transition-all group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <ul className="rounded-xl border border-line bg-white p-2 shadow-2xl">
                    {item.children.map((c) => (
                      <li key={c.href}>
                        <Link to={c.href} className="block rounded-lg px-3.5 py-2 text-sm text-[#333333] hover:bg-canvas hover:text-[#0D47A1]">
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
            <a
              href={telHref(phone)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs 2xl:text-sm font-semibold transition-all ${
                solid
                  ? "text-[#ff8a80] hover:bg-white/10 hover:text-white"
                  : "text-[#D32F2F] hover:bg-red-50 hover:text-red-700"
              }`}
            >
              <Phone className="h-3.5 w-3.5" /> Emergency
            </a>
          </li>
        </ul>

        <div className="flex flex-none items-center gap-1.5 sm:gap-2.5">
          <div className="hidden md:block">
            <LanguagePicker dark={solid} />
          </div>
          <button
            onClick={openCart}
            aria-label={`Open cart, ${count} item${count === 1 ? "" : "s"}`}
            className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-all ${
              solid ? "text-white hover:bg-white/10" : "text-[#0A2540] hover:bg-black/5"
            }`}
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D32F2F] px-1 text-[10px] font-bold text-white shadow-sm">
                {count}
              </span>
            )}
          </button>
          <Link
            to="/portal/login"
            aria-label="Staff login"
            className={`flex h-11 min-w-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold shadow-sm transition-all sm:px-3.5 sm:text-sm ${
              solid
                ? "border-white/30 text-white hover:border-gold hover:text-gold hover:bg-white/5"
                : "border-[#0A2540]/30 text-[#0A2540] hover:border-[#0D47A1] hover:text-[#0D47A1] hover:bg-[#0D47A1]/5"
            }`}
          >
            <LogIn className="h-4 w-4 flex-none" />
            <span className="hidden sm:inline">Staff Login</span>
          </Link>
          <button
            ref={menuButtonRef}
            className={`flex h-11 w-11 items-center justify-center rounded-full transition-all xl:hidden ${
              solid ? "text-white hover:bg-white/10" : "text-[#0A2540] hover:bg-black/5"
            }`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {open && (
        <div
          id="mobile-nav"
          ref={menuPanelRef}
          className="mx-4 mb-4 max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain rounded-2xl bg-[#F8F9FA]/95 p-5 shadow-2xl backdrop-blur-md xl:hidden"
        >
          <ul className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {NAV.map((item) => (
              <li key={item.label}>
                <Link to={item.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-lg font-semibold text-[#0A2540] hover:bg-white hover:text-[#0D47A1]">
                  {item.label}
                </Link>
                {item.children && (
                  <ul className="mb-1 ml-3 border-l-2 border-line pl-3">
                    {item.children.map((c) => (
                      <li key={c.href}>
                        <Link to={c.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-base text-[#333333] hover:text-[#0D47A1]">
                          {c.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
            <li>
              <a href={telHref(phone)} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-3 text-lg font-semibold text-[#D32F2F]">
                <Phone className="h-5 w-5" /> Emergency
              </a>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <LanguagePicker />
            <Link to="/portal/login" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-full border border-[#0A2540]/30 px-4 py-2 text-sm font-semibold text-[#0A2540]">
              <LogIn className="h-4 w-4" /> Staff Login
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
