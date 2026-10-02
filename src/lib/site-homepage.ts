/** Public landing-page content. Missing stored keys fall back to these originals. */
export const SECTION_LABELS = {
  hero: "Opening", problem: "The why", solution: "Our approach", services: "Services",
  story: "Our story", proof: "Photo moments", archive: "Memory archive",
  offer: "Invitation", faqs: "Questions & answers", final: "Closing invitation",
} as const;
export type SectionKey = keyof typeof SECTION_LABELS;
export const SECTION_KEYS = Object.keys(SECTION_LABELS) as SectionKey[];

export const DEFAULT_HOME = {
  sectionOrder: [...SECTION_KEYS],
  hiddenSections: [] as SectionKey[],
  logoImage: "",
  heroBackImage: "", heroReceiptImage: "", heroFrontImage: "",
  heroStamp: "KEEP THIS MOMENT", heroBackCaption: "the good days", heroReceiptNumber: "MEMORY PROOF #0921", heroReceiptFooter: "THANK YOU FOR REMEMBERING", heroFrontCaption: "proof we were here ♡",
  heroSteps: ["Take the photo.", "Get the proof.", "Keep the memory."],
  problemHeading: "Because screenshots aren't the same as *keepsakes.*",
  problemParagraphs: ["We take hundreds of photos. We save them in our phones. We tell ourselves we'll look at them again someday.", "But some memories deserve more than being buried in your camera roll."],
  problemQuote: "“I was there. This happened.\nAnd it meant something.”",
  problemClosing: "That's what {brand} is for.",
  solutionEyebrow: "A little souvenir from a big moment",
  solutionHeading: "A photobooth experience made for memories worth keeping.",
  solutionParagraphs: ["{brand} brings together the fun of a photobooth with the feeling of receiving a little souvenir from a moment you never want to forget.", "Whether it's a birthday, celebration, event, hangout, or simply a day worth remembering, we turn your moments into physical keepsakes."],
  solutionClosing: "Not just photos. Proofs of the moments you lived.",
  solutionButton: "I want my memory proof",
  servicesEyebrow: "What you get", servicesHeading: "Choose your way of keeping the memory.", servicesIntro: "Five ways to make a moment physical — each one designed to be held, shared, displayed, and found again.",
  services: [
    { title: "Receipt Photobooth", tagline: "Your memories, printed like a receipt.", body: "A unique alternative to a conventional photobooth — named for its distinctive receipt-style photo output, with a retro-inspired booth where the camera and monitor are enclosed inside the box.", image: "" },
    { title: "Standard Photobooth", tagline: "Classic photobooth fun, made tangible.", body: "Our conventional photobooth experience. Photos are printed in 4×6 using a non-ink printing process, designed for more durable, longer-lasting keepsakes.", image: "" },
    { title: "High-Angle Photobooth", tagline: "See the moment from a different angle.", body: "Photos captured from a high/overhead angle — a more private, comfortable experience that helps guests relax, have fun, and pose without feeling shy in front of a camera.", image: "" },
    { title: "Sintra Board Photo", tagline: "Turn a memory into something you can display.", body: "Your photo produced on Sintra board, available in A3 and A4 sizes — a physical keepsake you can put somewhere you'll actually see it.", image: "" },
    { title: "Original Instax Printing", tagline: "Instant memories. Literally.", body: "Physical photo prints made using original Instax materials — ready to hold, share, display, or keep in your memory box.", image: "" },
  ],
  storyImage: "", storyEyebrow: "Why {brand}?", storyHeading: "We believe memories shouldn't disappear into your gallery.", storyLead: "There's something different about holding a photo in your hands.",
  storyPoints: ["Stick it on your wall.", "Put it inside your wallet.", "Keep it in your journal.", "Give it to someone you love."],
  storyBody: "Years from now, you can find it again and remember exactly how that moment felt.", storyClosing: "That's the little magic we're trying to keep.", storyImageCaption: "THE BITSIZE SIBS",
  proofEyebrow: "Real moments, real keepsakes", proofHeading: "Proof that the memories were worth keeping.", proofIntro: "Customer moments, event snaps, and keepsakes — shared as they really happened.",
  proofImages: [{ image: "", caption: "Held onto" }, { image: "", caption: "From above" }, { image: "", caption: "Made to keep" }],
  archiveEyebrow: "Memory archive", archiveHeading: "Receipts from moments that happened.", archiveIntro: "Browse memories from our past events — from printed keepsakes to digital photos, GIFs, and singles.", archiveLink: "Open the memory archive",
  offerEyebrow: "Your next memory", offerHeading: "Make it one you can actually keep.", offerBody: "Whether you're celebrating with friends, marking a milestone, or simply creating memories together, {brand} gives you something to take home.", offerReceiptHeading: "YOUR EXPERIENCE CAN INCLUDE",
  faqEyebrow: "Good to know", faqHeading: "Frequently asked questions.",
  faqs: [
    { question: "What services do you offer?", answer: "We offer three main services: photobooths, photo Sintra board printing, and Instax printing. Under photobooths, we have three options: the Receipt Photobooth (receipt-style prints, retro booth), the Standard Photobooth (4×6 prints), and the High-Angle Photobooth (overhead perspective)." },
    { question: "What's the difference between the Receipt Photobooth and the Standard Photobooth?", answer: "The Receipt Photobooth is a unique alternative with a distinctive receipt-style photo output and a retro-inspired booth. The Standard Photobooth is our conventional experience, printing 4×6 photos with a non-ink printing process designed for more durable, longer-lasting keepsakes." },
    { question: "Are your prints printed with ink?", answer: "Our Standard Photobooth uses a non-ink printing process rather than a conventional ink-based printer — designed to give you keepsakes that are more durable and longer-lasting." },
    { question: "What is a High-Angle Photobooth?", answer: "It captures photos from a high/overhead angle for a different perspective. Because the camera is above you, it's a more private and comfortable experience — easier to relax and have fun without feeling shy." },
    { question: "Do you offer Sintra board photos and Instax printing?", answer: "Yes! Sintra board photos are available in A3 and A4 sizes, and we offer Original Instax photo printing using original Instax materials." },
    { question: "How do we book?", answer: "Simply send us a message with your event details (date, location, and the setup you're interested in). We'll guide you through the next steps — pricing is shared on request." },
  ],
  finalEyebrow: "One last reminder", finalLines: ["Print the laugh.", "Keep the pose.", "Save the little moment.", "Take home the proof."], finalSmall: "Let's make something worth keeping.",
  footerDescription: "Photobooth · Receipt Photobooth · High Angle · Sintra Board · Original Instax Printing",
  footerClosing: "Made for moments worth keeping.",
};
export type HomeContent = typeof DEFAULT_HOME;

export function normalizeHome(raw: unknown): HomeContent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return structuredClone(DEFAULT_HOME);
  const input = raw as Partial<HomeContent>;
  const order = Array.isArray(input.sectionOrder) ? input.sectionOrder.filter((key): key is SectionKey => typeof key === "string" && SECTION_KEYS.includes(key as SectionKey)) : [];
  return {
    ...DEFAULT_HOME, ...input,
    sectionOrder: [...new Set([...order, ...SECTION_KEYS])],
    hiddenSections: Array.isArray(input.hiddenSections) ? input.hiddenSections.filter((key): key is SectionKey => typeof key === "string" && SECTION_KEYS.includes(key as SectionKey)) : [],
    services: DEFAULT_HOME.services.map((item, i) => ({ ...item, ...(input.services?.[i] ?? {}) })),
    proofImages: DEFAULT_HOME.proofImages.map((item, i) => ({ ...item, ...(input.proofImages?.[i] ?? {}) })),
    faqs: Array.isArray(input.faqs) ? input.faqs : DEFAULT_HOME.faqs,
  };
}
