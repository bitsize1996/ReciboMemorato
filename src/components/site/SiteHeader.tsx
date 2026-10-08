import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { ArrowUp, Menu, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

import { siteSettingsQuery } from "@/lib/site.functions";
import { normalizeHome } from "@/lib/site-homepage";

// The top menu shared by every public page: it stays visible while scrolling,
// works on phones through a menu, and keeps Contact and the admin login one tap away.
const NAV_CSS = `
.nav-shell { position: fixed; z-index: 40; top: 0; left: 0; right: 0; transition: background .25s, box-shadow .25s; }
.nav-shell .site-header { position: relative; transition: padding .25s; }
.nav-shell.is-scrolled, .nav-shell.is-solid { background: color-mix(in oklab, var(--background) 94%, transparent); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); box-shadow: 0 1px 0 var(--border); }
.nav-shell.is-scrolled .site-header { padding-top: 12px; padding-bottom: 12px; }
.nav-shell .site-header nav a { padding: 8px 0; }
.nav-shell .site-header nav a.is-active { border-color: var(--primary); color: var(--primary); }
.nav-shell .site-header nav a.nav-book { padding: 8px 14px; border: 1px solid var(--primary); border-radius: 999px; background: var(--primary); color: var(--primary-foreground); }
.nav-shell .site-header nav a.nav-book:hover { opacity: .88; }
.nav-shell .site-header nav a.nav-admin { padding: 8px 14px; border: 1px solid var(--foreground); border-radius: 999px; }
.nav-shell .site-header nav a.nav-admin:hover { background: var(--foreground); color: var(--background); }
.nav-actions { display: flex; align-items: center; gap: 10px; }
.nav-toggle { display: grid; place-items: center; width: 44px; height: 44px; border: 1px solid var(--foreground); border-radius: 50%; background: transparent; color: inherit; cursor: pointer; }
.nav-panel { display: grid; max-height: calc(100svh - 76px); overflow-y: auto; padding: 4px clamp(20px, 5vw, 76px) 22px; border-top: 1px solid var(--border); background: var(--background); font-family: var(--font-mono); font-size: 13px; text-transform: uppercase; }
.nav-panel a { padding: 17px 4px; border-bottom: 1px dashed var(--border); }
.nav-panel a.is-active { color: var(--primary); }
.nav-panel a.nav-book { margin-top: 14px; border: 1px solid var(--primary); border-radius: 999px; background: var(--primary); color: var(--primary-foreground); text-align: center; }
.nav-panel a.nav-admin { margin-top: 14px; border: 1px solid var(--foreground); border-radius: 999px; text-align: center; }
.to-top { position: fixed; z-index: 40; right: 16px; bottom: 16px; display: grid; place-items: center; width: 48px; height: 48px; border: 1px solid var(--foreground); border-radius: 50%; background: var(--background); color: var(--foreground); box-shadow: 0 8px 24px color-mix(in oklab, var(--foreground) 20%, transparent); opacity: 0; transform: translateY(10px); pointer-events: none; cursor: pointer; transition: opacity .2s, transform .2s; }
.to-top.is-visible { opacity: 1; transform: none; pointer-events: auto; }
section[id], footer[id] { scroll-margin-top: 76px; }
.faq-intro { top: 100px; }
.has-site-chrome { padding-top: 84px; }
.has-site-chrome .archive-head .brand-mark { display: none; }
@media (min-width: 768px) { .nav-shell .site-header nav { gap: 16px; } .nav-toggle, .nav-panel { display: none; } }
@media (min-width: 1100px) { .nav-shell .site-header nav { gap: 28px; } }
`;

const SECTION_IDS = ["services", "story", "faqs", "contact"];

export function SiteHeader() {
  const { data: s } = useSuspenseQuery(siteSettingsQuery);
  const { pathname } = useLocation();
  const onHome = pathname === "/";
  const hiddenSections = normalizeHome(s.homepage).hiddenSections as string[];
  const hiddenKey = hiddenSections.join(",");

  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      setShowTop(window.scrollY > 700);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the phone menu whenever the page changes.
  useEffect(() => setOpen(false), [pathname]);

  // On the homepage, highlight the link for the section currently on screen.
  useEffect(() => {
    setActive(null);
    if (!onHome || typeof IntersectionObserver === "undefined") return;
    const targets = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => Boolean(el),
    );
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id;
          if (entry.isIntersecting) setActive(id);
          else setActive((current) => (current === id ? null : current));
        }
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [onHome, hiddenKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const shown = (key: string) => !hiddenSections.includes(key);
  const close = () => setOpen(false);
  const hashActive = (id: string) => (onHome && active === id ? "is-active" : undefined);
  const pageActive = (prefix: string) => (pathname.startsWith(prefix) ? "is-active" : undefined);

  const links = (onClick?: () => void) => (
    <>
      {shown("services") ? (
        <Link to="/" hash="services" onClick={onClick} className={hashActive("services")}>Services</Link>
      ) : null}
      <Link to="/packages" onClick={onClick} className={pageActive("/packages")}>Packages</Link>
      <Link to="/memories" onClick={onClick} className={pageActive("/memories")}>Memory archive</Link>
      <Link to="/proofs" onClick={onClick} className={pageActive("/proofs")}>Proof of orders</Link>
      <Link to="/reviews" onClick={onClick} className={pageActive("/reviews")}>Reviews</Link>
      {shown("story") ? (
        <Link to="/" hash="story" onClick={onClick} className={hashActive("story")}>Our story</Link>
      ) : null}
      {shown("faqs") ? (
        <Link to="/" hash="faqs" onClick={onClick} className={hashActive("faqs")}>FAQs</Link>
      ) : null}
      <Link to="/" hash="contact" onClick={onClick} className={hashActive("contact")}>Contact</Link>
    </>
  );

  return (
    <>
      <style>{NAV_CSS}</style>
      <div className={`nav-shell${scrolled ? " is-scrolled" : ""}${open || !onHome ? " is-solid" : ""}`}>
        <header className="site-header">
          <Link
            to="/"
            className="brand-mark"
            aria-label={`${s.brandLine1} ${s.brandLine2} home`}
            onClick={() => onHome && window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            {s.homepage?.logoImage ? (
              <img className="brand-logo-image" src={s.homepage.logoImage} alt={`${s.brandLine1} ${s.brandLine2}`} />
            ) : null}
            <span>{s.brandLine1}</span>
            <span>{s.brandLine2}</span>
            <small>{s.brandSub}</small>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
            {links()}
            <Link to="/book" className={`nav-book${pathname.startsWith("/book") ? " is-active" : ""}`}>Book now</Link>
            <Link to="/auth" className="nav-admin">Admin login</Link>
          </nav>
          <div className="nav-actions">
            <a
              className="header-message"
              href={s.messengerUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Message ${s.brandLine1} ${s.brandLine2}`}
            >
              <MessageCircle className="size-5" aria-hidden="true" />
            </a>
            <button
              type="button"
              className="nav-toggle"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
            </button>
          </div>
        </header>
        {open ? (
          <nav id="mobile-nav" className="nav-panel" aria-label="Mobile navigation">
            {links(close)}
            <a href={s.messengerUrl} target="_blank" rel="noreferrer" onClick={close}>Message us on Messenger</a>
            <Link to="/book" onClick={close} className="nav-book">Book now</Link>
            <Link to="/auth" onClick={close} className="nav-admin">Admin login</Link>
          </nav>
        ) : null}
      </div>
      <button
        type="button"
        className={`to-top${showTop ? " is-visible" : ""}`}
        aria-label="Back to top"
        tabIndex={showTop ? 0 : -1}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        <ArrowUp className="size-5" aria-hidden="true" />
      </button>
    </>
  );
}
