import { useEffect, useState, type ReactNode } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  Facebook,
  Heart,
  Instagram,
  Maximize2,
  Menu,
  MessageCircle,
  ReceiptText,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EventCard } from "./memories.index";
import { listPublishedEvents } from "@/lib/gallery.functions";
import { siteSettingsQuery } from "@/lib/site.functions";
import { richText, type SiteSettings } from "@/lib/site-settings";
import { normalizeHome, type SectionKey } from "@/lib/site-homepage";

const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: () => listPublishedEvents(),
});

// Social pages shown in the footer.
const SOCIAL_LINKS = [
  {
    label: "Recibo Memorato on Facebook",
    href: "https://www.facebook.com/recibomemoratobybitsizesibs",
    icon: Facebook,
  },
  {
    label: "Recibo Memorato on Instagram",
    href: "https://www.instagram.com/recibomemorato2026",
    icon: Instagram,
  },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Recibo Memorato | Memories Need Proofs" },
      {
        name: "description",
        content:
          "Receipt photobooths, classic and high-angle photos, Sintra Board keepsakes, and Original Instax printing by Recibo Memorato.",
      },
      { property: "og:title", content: "Recibo Memorato | Memories Need Proofs" },
      {
        property: "og:description",
        content: "Turn your favorite moments into physical keepsakes you can hold, share, and keep.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(eventsQuery),
      context.queryClient.ensureQueryData(siteSettingsQuery),
    ]),
  component: Index,
});

const serviceVisuals = [
  { icon: ReceiptText, visual: "receipt" }, { icon: Camera, visual: "strip" },
  { icon: ArrowDown, visual: "angle" }, { icon: Maximize2, visual: "board" },
  { icon: Sparkles, visual: "instax" },
];

function Rich({ text }: { text: string }) {
  return (
    <>
      {richText(text).map((part, i) =>
        part.em ? <em key={i}>{part.part}</em> : <span key={i}>{part.part}</span>,
      )}
    </>
  );
}

function MessageButton({ url, label, light = false }: { url: string; label: string; light?: boolean }) {
  return (
    <Button asChild size="lg" variant={light ? "outline" : "default"}>
      <a href={url} target="_blank" rel="noreferrer">
        <MessageCircle aria-hidden="true" className="size-4" />
        {label}
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    </Button>
  );
}

function BrandMark({ s }: { s: SiteSettings }) {
  return (
    <a href="#top" className="brand-mark" aria-label={`${s.brandLine1} ${s.brandLine2} home`}>
      {s.homepage?.logoImage ? <img className="brand-logo-image" src={s.homepage.logoImage} alt={`${s.brandLine1} ${s.brandLine2}`} /> : null}
      <span>{s.brandLine1}</span>
      <span>{s.brandLine2}</span>
      <small>{s.brandSub}</small>
    </a>
  );
}

// Navigation: stays visible while scrolling, highlights the section being read,
// works on phones through a menu, and keeps "Contact" and the admin login one tap away.
const NAV_CSS = `
.nav-shell { position: fixed; z-index: 40; top: 0; left: 0; right: 0; transition: background .25s, box-shadow .25s; }
.nav-shell .site-header { position: relative; transition: padding .25s; }
.nav-shell.is-scrolled { background: color-mix(in oklab, var(--background) 94%, transparent); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); box-shadow: 0 1px 0 var(--border); }
.nav-shell.is-scrolled .site-header { padding-top: 12px; padding-bottom: 12px; }
.nav-shell .site-header nav a { padding: 8px 0; }
.nav-shell .site-header nav a.is-active { border-color: var(--primary); color: var(--primary); }
.nav-shell .site-header nav a.nav-admin { padding: 8px 14px; border: 1px solid var(--foreground); border-radius: 999px; }
.nav-shell .site-header nav a.nav-book { padding: 8px 14px; border: 1px solid var(--primary); border-radius: 999px; background: var(--primary); color: var(--primary-foreground); }
.nav-shell .site-header nav a.nav-book:hover { opacity: .88; }
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
@media (min-width: 768px) { .nav-toggle, .nav-panel { display: none; } }
`;

function SiteHeader({ s, hiddenSections }: { s: SiteSettings; hiddenSections: string[] }) {
  const [scrolled, setScrolled] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const hiddenKey = hiddenSections.join(",");

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      setShowTop(window.scrollY > 700);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Highlight the link for the section currently on screen.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = ["services", "story", "faqs", "contact"]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
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
  }, [hiddenKey]);

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
  const cls = (id: string) => (active === id ? "is-active" : undefined);

  return (
    <>
      <style>{NAV_CSS}</style>
      <div className={`nav-shell${scrolled || open ? " is-scrolled" : ""}`}>
        <header className="site-header">
          <BrandMark s={s} />
          <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
            {shown("services") ? <a href="#services" className={cls("services")}>Services</a> : null}
            <Link to="/memories">Memory archive</Link>
            {shown("story") ? <a href="#story" className={cls("story")}>Our story</a> : null}
            {shown("faqs") ? <a href="#faqs" className={cls("faqs")}>FAQs</a> : null}
            <a href="#contact" className={cls("contact")}>Contact</a>
            <Link to="/book" className="nav-book">Book now</Link>
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
            {shown("services") ? <a href="#services" onClick={close} className={cls("services")}>Services</a> : null}
            <Link to="/memories" onClick={close}>Memory archive</Link>
            {shown("story") ? <a href="#story" onClick={close} className={cls("story")}>Our story</a> : null}
            {shown("faqs") ? <a href="#faqs" onClick={close} className={cls("faqs")}>FAQs</a> : null}
            <a href="#contact" onClick={close} className={cls("contact")}>Contact</a>
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

function MemoryVisual({ type, label, image }: { type: string; label: string; image?: string }) {
  if (image) return <img className={`memory-visual memory-visual-${type}`} src={image} alt={label} loading="lazy" />;
  return (
    <div className={`memory-visual memory-visual-${type}`} aria-label={`${label} image placeholder`} role="img">
      <div className="memory-flash" />
      <div className="memory-figure memory-figure-one" />
      <div className="memory-figure memory-figure-two" />
      <div className="memory-grain" />
      <span className="memory-date">SEP 21 · 2026</span>
    </div>
  );
}

function Index() {
  const { data: events } = useSuspenseQuery(eventsQuery);
  const { data: s } = useSuspenseQuery(siteSettingsQuery);
  // Previously cached settings may predate the homepage-content field.
  const h = normalizeHome(s.homepage);
  const brand = `${s.brandLine1} ${s.brandLine2}`;
  const withBrand = (text: string | undefined) => (text ?? "").replaceAll("{brand}", brand);

  const sections: Record<SectionKey, ReactNode> = {
    hero: (
      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">{s.heroEyebrow}</p>
          <h1 id="hero-title">
            <Rich text={s.heroTitle} />
          </h1>
          <p className="hero-lead">{s.heroLead}</p>
          <p className="hero-description">{s.heroDescription}</p>
          <MessageButton url={s.messengerUrl} label={s.ctaLabel} />
        </div>

        <div className="hero-art" aria-label="A collage of physical memory keepsakes">
          <div className="hero-stamp">{h.heroStamp}</div>
          <div className="hero-card hero-card-back">
            <MemoryVisual type="instax" label="Instax keepsake" image={h.heroBackImage} />
            <p>{h.heroBackCaption}</p>
          </div>
          <div className="hero-receipt">
            <div className="receipt-brand">{s.brandLine1} {s.brandLine2}</div>
            <p>{h.heroReceiptNumber}</p>
            <MemoryVisual type="receipt" label="Receipt photo strip" image={h.heroReceiptImage} />
            <div className="receipt-total"><span>MEMORIES</span><span>PRICELESS</span></div>
            <div className="barcode" aria-hidden="true" />
            <small>{h.heroReceiptFooter}</small>
          </div>
          <div className="hero-card hero-card-front">
            <MemoryVisual type="strip" label="Photobooth keepsake" image={h.heroFrontImage} />
            <p>{h.heroFrontCaption}</p>
          </div>
        </div>

        <div className="hero-steps" aria-label="How it works">
          <span><Camera /> {h.heroSteps[0]}</span>
          <span><ReceiptText /> {h.heroSteps[1]}</span>
          <span><Heart /> {h.heroSteps[2]}</span>
        </div>
      </section>
    ),
    problem: (
      <section className="problem-section">
        <div className="section-number">01 / THE WHY</div>
        <div className="problem-copy">
          <h2><Rich text={h.problemHeading} /></h2>
          <div className="problem-body">
            <p>{h.problemParagraphs[0]}</p>
            <p>{h.problemParagraphs[1]}</p>
          </div>
          <blockquote>{h.problemQuote}</blockquote>
          <p className="problem-close">{withBrand(h.problemClosing)}</p>
        </div>
      </section>
    ),
    solution: (
      <section className="solution-band">
        <div className="solution-inner">
          <div>
            <p className="eyebrow">{h.solutionEyebrow}</p>
            <h2><Rich text={h.solutionHeading} /></h2>
          </div>
          <div className="solution-text">
            <p>{withBrand(h.solutionParagraphs[0])}</p>
            <p>{h.solutionParagraphs[1]}</p>
            <strong>{h.solutionClosing}</strong>
            <MessageButton url={s.messengerUrl} label={h.solutionButton} light />
          </div>
        </div>
      </section>
    ),
    services: (
      <section id="services" className="services-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{h.servicesEyebrow}</p>
            <h2><Rich text={h.servicesHeading} /></h2>
          </div>
          <p>{h.servicesIntro}</p>
        </div>
        <div className="services-grid">
          {h.services.map((service, index) => {
            const visual = serviceVisuals[index] ?? { icon: Camera, visual: "strip" };
            const Icon = visual.icon;
            return (
              <article className="service-card" key={service.title}>
                <MemoryVisual type={visual.visual} label={service.title} image={service.image} />
                <div className="service-content">
                  <div className="service-meta"><span>{String(index + 1).padStart(2, "0")}</span><Icon aria-hidden="true" /></div>
                  <h3>{service.title}</h3>
                  <strong>{service.tagline}</strong>
                  <p>{service.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    ),
    story: (
      <section id="story" className="story-section">
        <div className="founder-visual">
          <MemoryVisual type="founders" label="The siblings behind the brand" image={h.storyImage} />
          <span>{h.storyImageCaption}</span>
        </div>
        <div className="story-copy">
          <p className="eyebrow">{withBrand(h.storyEyebrow)}</p>
          <h2><Rich text={h.storyHeading} /></h2>
          <p>{h.storyLead}</p>
          <ul>
            {h.storyPoints.map((point, i) => <li key={i}>{point}</li>)}
          </ul>
          <p>{h.storyBody}</p>
          <strong>{h.storyClosing}</strong>
        </div>
      </section>
    ),
    proof: (
      <section className="proof-section">
        <div className="section-heading proof-heading">
          <div><p className="eyebrow">{h.proofEyebrow}</p><h2><Rich text={h.proofHeading} /></h2></div>
          <p>{h.proofIntro}</p>
        </div>
        <div className="proof-gallery" aria-label="Customer memory gallery">
          {h.proofImages.map((item, index) => (
            <figure key={index}>
              <MemoryVisual type={["receipt", "angle", "instax"][index] ?? "receipt"} label={`Customer memory ${index + 1}`} image={item.image} />
              <figcaption>{item.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    ),
    archive: (
      <section className="archive-teaser" id="archive">
        <p className="eyebrow">{h.archiveEyebrow}</p>
        <h2><Rich text={h.archiveHeading} /></h2>
        <p>{h.archiveIntro}</p>
        <div className="event-grid">
          {events.slice(0, 3).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        <Link to="/memories" className="teaser-link">
          {h.archiveLink} <ArrowUpRight aria-hidden="true" />
        </Link>
      </section>
    ),
    offer: (
      <section className="offer-section">
        <div className="offer-copy">
          <p className="eyebrow">{h.offerEyebrow}</p>
          <h2><Rich text={h.offerHeading} /></h2>
          <p>{withBrand(h.offerBody)}</p>
          <MessageButton url={s.messengerUrl} label={s.ctaLabel} />
        </div>
        <div className="offer-receipt">
          <header><span>{s.brandLine1} {s.brandLine2}</span><small>{h.offerReceiptHeading}</small></header>
          {h.services.map((service) => <div key={service.title}><Check aria-hidden="true" /><span>{service.title}</span></div>)}
          <footer><span>{s.finalTagline}</span><div className="barcode" /></footer>
        </div>
      </section>
    ),
    faqs: (
      <section id="faqs" className="faq-section">
        <div className="faq-intro"><p className="eyebrow">{h.faqEyebrow}</p><h2><Rich text={h.faqHeading} /></h2></div>
        <div className="faq-list">
          {h.faqs.map(({ question, answer }, index) => (
            <details key={question} open={index === 0}>
              <summary><span>{String(index + 1).padStart(2, "0")}</span>{question}<ChevronDown aria-hidden="true" /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    ),
    final: (
      <section className="final-section">
        <p className="eyebrow">{h.finalEyebrow}</p>
        <h2><Rich text={s.finalTitle} /></h2>
        <div className="final-lines">{h.finalLines.map((line, i) => <span key={i}>{line}</span>)}</div>
        <p className="final-tagline">{s.finalTagline}</p>
        <MessageButton url={s.messengerUrl} label={s.ctaLabel} />
        <small>{h.finalSmall}</small>
      </section>
    ),
  };

  return (
    <main id="top" className="overflow-hidden bg-background text-foreground">
      <SiteHeader s={s} hiddenSections={h.hiddenSections} />

      {h.sectionOrder.map((key) => h.hiddenSections.includes(key) ? null : <div className="contents" key={key}>{sections[key]}</div>)}

      <footer className="site-footer" id="contact">
        <BrandMark s={s} />
        <p>{h.footerDescription}</p>
        <nav aria-label="Footer navigation"><a href="#top">Home</a><a href="#services">Services</a><Link to="/memories">Memory archive</Link><a href="#faqs">FAQs</a><Link to="/book">Book now</Link><a href={s.messengerUrl} target="_blank" rel="noreferrer">Contact</a><Link to="/auth">Admin login</Link></nav>
        <div className="flex items-center gap-4">
          {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
            <a key={href} href={href} className="footer-social" target="_blank" rel="noreferrer" aria-label={label}>
              <Icon aria-hidden="true" />
            </a>
          ))}
        </div>
        <small>© 2026 {s.brandLine1} {s.brandLine2}. {h.footerClosing}</small>
      </footer>
    </main>
  );
}
