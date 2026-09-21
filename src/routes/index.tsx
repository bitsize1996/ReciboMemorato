import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUpRight,
  Camera,
  Check,
  ChevronDown,
  Heart,
  Instagram,
  Maximize2,
  MessageCircle,
  ReceiptText,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EventCard } from "./memories.index";
import { listPublishedEvents } from "@/lib/gallery.functions";

const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: () => listPublishedEvents(),
});

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
  loader: ({ context }) => context.queryClient.ensureQueryData(eventsQuery),
  component: Index,
});

const messengerUrl = "https://m.me/";

const services = [
  {
    number: "01",
    icon: ReceiptText,
    title: "Receipt Photobooth",
    tagline: "Your memories, printed like a receipt.",
    body: "A playful take on the ordinary receipt — except this one is worth keeping. Capture your moments and walk away with a physical reminder of the day.",
    visual: "receipt",
  },
  {
    number: "02",
    icon: Camera,
    title: "Photobooth",
    tagline: "Classic photobooth fun, made tangible.",
    body: "Gather your people, strike your favorite poses, and create photos you'll actually want to keep.",
    visual: "strip",
  },
  {
    number: "03",
    icon: ArrowDown,
    title: "High-Angle Photobooth",
    tagline: "See the moment from a different angle.",
    body: "A fun perspective that turns group moments, outfits, poses, and celebrations into something a little more memorable.",
    visual: "angle",
  },
  {
    number: "04",
    icon: Maximize2,
    title: "Photo Sintra Board",
    tagline: "Turn a memory into something you can display.",
    body: "Take a favorite photo beyond the photobooth strip and turn it into a physical keepsake you can put somewhere you'll actually see it.",
    visual: "board",
  },
  {
    number: "05",
    icon: Sparkles,
    title: "Original Instax Printing",
    tagline: "Instant memories. Literally.",
    body: "Get your moments printed in that unmistakable Instax format — ready to hold, share, display, or keep in your memory box.",
    visual: "instax",
  },
];

const faqs = [
  [
    "Do you only offer receipt-style photobooths?",
    "No. Recibo Memorato also offers regular photobooth experiences, high-angle photobooth, Photo Sintra Board, and Original Instax Printing.",
  ],
  [
    "What events can we book you for?",
    "Recibo Memorato is designed for celebrations and moments worth keeping. Send us a message with your event details and we'll help you with the available setup.",
  ],
  [
    "Can we get physical prints?",
    "Yes. Physical keepsakes are at the heart of Recibo Memorato, with options including receipt-style prints, Sintra Board, and Original Instax prints.",
  ],
  [
    "How do we book?",
    "Simply send us a message. We'll guide you through the next steps and provide the details you need.",
  ],
  [
    "What happens after I send a message?",
    "You'll receive confirmation and be directed to Messenger for the next step in your inquiry.",
  ],
];

function MessageButton({ label = "Send us a message", light = false }: { label?: string; light?: boolean }) {
  return (
    <Button asChild size="lg" variant={light ? "outline" : "default"}>
      <a href={messengerUrl} target="_blank" rel="noreferrer">
        <MessageCircle aria-hidden="true" className="size-4" />
        {label}
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </a>
    </Button>
  );
}

function BrandMark() {
  return (
    <a href="#top" className="brand-mark" aria-label="Recibo Memorato home">
      <span>RECIBO</span>
      <span>MEMORATO</span>
      <small>by the bitsize sibs</small>
    </a>
  );
}

function MemoryVisual({ type, label }: { type: string; label: string }) {
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

  return (
    <main id="top" className="overflow-hidden bg-background text-foreground">
      <header className="site-header">
        <BrandMark />
        <nav aria-label="Main navigation" className="hidden items-center gap-8 md:flex">
          <a href="#services">Services</a>
          <Link to="/memories">Memory archive</Link>
          <a href="#story">Our story</a>
          <a href="#faqs">FAQs</a>
        </nav>
        <a className="header-message" href={messengerUrl} target="_blank" rel="noreferrer" aria-label="Message Recibo Memorato">
          <MessageCircle className="size-5" aria-hidden="true" />
        </a>
      </header>

      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Photobooth &amp; keepsakes</p>
          <h1 id="hero-title">
            Your memories deserve more than a <em>camera roll.</em>
          </h1>
          <p className="hero-lead">Turn your favorite moments into something you can actually keep.</p>
          <p className="hero-description">
            From receipt-inspired photobooths to high-angle shots, Sintra Board prints, and Original Instax prints — Recibo Memorato makes memories tangible.
          </p>
          <MessageButton />
        </div>

        <div className="hero-art" aria-label="A collage of physical memory keepsakes">
          <div className="hero-stamp">KEEP<br />THIS<br />MOMENT</div>
          <div className="hero-card hero-card-back">
            <MemoryVisual type="instax" label="Instax keepsake" />
            <p>the good days</p>
          </div>
          <div className="hero-receipt">
            <div className="receipt-brand">RECIBO MEMORATO</div>
            <p>MEMORY PROOF #0921</p>
            <MemoryVisual type="receipt" label="Receipt photo strip" />
            <div className="receipt-total"><span>MEMORIES</span><span>PRICELESS</span></div>
            <div className="barcode" aria-hidden="true" />
            <small>THANK YOU FOR REMEMBERING</small>
          </div>
          <div className="hero-card hero-card-front">
            <MemoryVisual type="strip" label="Photobooth keepsake" />
            <p>proof we were here ♡</p>
          </div>
        </div>

        <div className="hero-steps" aria-label="How it works">
          <span><Camera /> Take the photo.</span>
          <span><ReceiptText /> Get the proof.</span>
          <span><Heart /> Keep the memory.</span>
        </div>
      </section>

      <section className="problem-section">
        <div className="section-number">01 / THE WHY</div>
        <div className="problem-copy">
          <h2>Because screenshots aren't the same as <em>keepsakes.</em></h2>
          <div className="problem-body">
            <p>We take hundreds of photos. We save them in our phones. We tell ourselves we'll look at them again someday.</p>
            <p>But some memories deserve more than being buried in your camera roll.</p>
          </div>
          <blockquote>“I was there. This happened.<br />And it meant something.”</blockquote>
          <p className="problem-close">That's what Recibo Memorato is for.</p>
        </div>
      </section>

      <section className="solution-band">
        <div className="solution-inner">
          <div>
            <p className="eyebrow">A little souvenir from a big moment</p>
            <h2>A photobooth experience made for memories worth keeping.</h2>
          </div>
          <div className="solution-text">
            <p>Recibo Memorato brings together the fun of a photobooth with the feeling of receiving a little souvenir from a moment you never want to forget.</p>
            <p>Whether it's a birthday, celebration, event, hangout, or simply a day worth remembering, we turn your moments into physical keepsakes.</p>
            <strong>Not just photos. Proofs of the moments you lived.</strong>
            <MessageButton label="I want my memory proof" light />
          </div>
        </div>
      </section>

      <section id="services" className="services-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">What you get</p>
            <h2>Choose your way of keeping the memory.</h2>
          </div>
          <p>Five ways to make a moment physical — each one designed to be held, shared, displayed, and found again.</p>
        </div>
        <div className="services-grid">
          {services.map((service) => {
            const Icon = service.icon;
            return (
              <article className="service-card" key={service.title}>
                <MemoryVisual type={service.visual} label={service.title} />
                <div className="service-content">
                  <div className="service-meta"><span>{service.number}</span><Icon aria-hidden="true" /></div>
                  <h3>{service.title}</h3>
                  <strong>{service.tagline}</strong>
                  <p>{service.body}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="story" className="story-section">
        <div className="founder-visual">
          <MemoryVisual type="founders" label="The siblings behind Recibo Memorato" />
          <span>THE BITSIZE SIBS</span>
        </div>
        <div className="story-copy">
          <p className="eyebrow">Why Recibo Memorato?</p>
          <h2>We believe memories shouldn't disappear into your gallery.</h2>
          <p>There's something different about holding a photo in your hands.</p>
          <ul>
            <li>Stick it on your wall.</li>
            <li>Put it inside your wallet.</li>
            <li>Keep it in your journal.</li>
            <li>Give it to someone you love.</li>
          </ul>
          <p>Years from now, you can find it again and remember exactly how that moment felt.</p>
          <strong>That's the little magic we're trying to keep.</strong>
        </div>
      </section>

      <section className="proof-section">
        <div className="section-heading proof-heading">
          <div><p className="eyebrow">Real moments, real keepsakes</p><h2>Proof that the memories were worth keeping.</h2></div>
          <p>Customer moments, event snaps, and keepsakes — shared as they really happened.</p>
        </div>
        <div className="proof-gallery" aria-label="Customer memory gallery">
          {["receipt", "angle", "instax"].map((type, index) => (
            <figure key={type}>
              <MemoryVisual type={type} label={`Customer memory ${index + 1}`} />
              <figcaption>{["Held onto", "From above", "Made to keep"][index]}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="archive-teaser" id="archive">
        <p className="eyebrow">Memory archive</p>
        <h2>Receipts from moments that happened.</h2>
        <p>
          Browse memories from our past events — from printed keepsakes to digital photos, GIFs, and
          singles.
        </p>
        <div className="event-grid">
          {events.slice(0, 3).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
        <Link to="/memories" className="teaser-link">
          Open the memory archive <ArrowUpRight aria-hidden="true" />
        </Link>
      </section>

      <section className="offer-section">
        <div className="offer-copy">
          <p className="eyebrow">Your next memory</p>
          <h2>Make it one you can actually keep.</h2>
          <p>Whether you're celebrating with friends, marking a milestone, or simply creating memories together, Recibo Memorato gives you something to take home.</p>
          <MessageButton />
        </div>
        <div className="offer-receipt">
          <header><span>RECIBO MEMORATO</span><small>YOUR EXPERIENCE CAN INCLUDE</small></header>
          {services.map((service) => <div key={service.title}><Check aria-hidden="true" /><span>{service.title}</span></div>)}
          <footer><span>Because memories need proofs.</span><div className="barcode" /></footer>
        </div>
      </section>

      <section id="faqs" className="faq-section">
        <div className="faq-intro"><p className="eyebrow">Good to know</p><h2>Frequently asked questions.</h2></div>
        <div className="faq-list">
          {faqs.map(([question, answer], index) => (
            <details key={question} open={index === 0}>
              <summary><span>{String(index + 1).padStart(2, "0")}</span>{question}<ChevronDown aria-hidden="true" /></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-section">
        <p className="eyebrow">One last reminder</p>
        <h2>Don't let your favorite moments live only in your camera roll.</h2>
        <div className="final-lines"><span>Print the laugh.</span><span>Keep the pose.</span><span>Save the little moment.</span><span>Take home the proof.</span></div>
        <p className="final-tagline">Because memories need proofs.</p>
        <MessageButton />
        <small>Let's make something worth keeping.</small>
      </section>

      <footer className="site-footer" id="contact">
        <BrandMark />
        <p>Photobooth · Receipt Photobooth · High Angle · Sintra Board · Original Instax Printing</p>
        <nav aria-label="Footer navigation"><a href="#top">Home</a><a href="#services">Services</a><a href="#faqs">FAQs</a><a href={messengerUrl} target="_blank" rel="noreferrer">Contact</a></nav>
        <a href={messengerUrl} className="footer-social" target="_blank" rel="noreferrer" aria-label="Find Recibo Memorato on social media"><Instagram aria-hidden="true" /></a>
        <small>© 2026 Recibo Memorato. Made for moments worth keeping.</small>
      </footer>
    </main>
  );
}