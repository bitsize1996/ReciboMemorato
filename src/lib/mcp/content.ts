export const brand = {
  name: "Recibo Memorato",
  by: "The Bitsize Sibs",
  tagline: "Because memories need proofs.",
  contactLabel: "Facebook Messenger",
  contactUrl: "https://m.me/",
};

export interface Service {
  number: string;
  title: string;
  tagline: string;
  body: string;
}

export const services: Service[] = [
  {
    number: "01",
    title: "Receipt Photobooth",
    tagline: "Your memories, printed like a receipt.",
    body: "A unique alternative to a conventional photobooth. The name comes from its distinctive receipt-style photo output, and the booth itself has a retro-inspired look, with the camera and monitor enclosed inside the photobooth box.",
  },
  {
    number: "02",
    title: "Standard Photobooth",
    tagline: "Classic photobooth fun, made tangible.",
    body: "Our conventional photobooth experience. Photos are printed in a 4×6 format using a non-ink printing process, designed for more durable, longer-lasting keepsakes compared with ink-printed photos.",
  },
  {
    number: "03",
    title: "High-Angle Photobooth",
    tagline: "See the moment from a different angle.",
    body: "Captures photos from a high/overhead angle for a different visual perspective. Because the camera is above you, it's a more private and comfortable experience — easier to relax, have fun, and pose without feeling shy in front of a camera.",
  },
  {
    number: "04",
    title: "Sintra Board Photo",
    tagline: "Turn a memory into something you can display.",
    body: "Your photo produced on Sintra board, available in A3 and A4 sizes — a physical keepsake you can put somewhere you'll actually see it.",
  },
  {
    number: "05",
    title: "Original Instax Photo Printing",
    tagline: "Instant memories. Literally.",
    body: "Physical photo prints made using original Instax materials — ready to hold, share, display, or keep in your memory box.",
  },
];

export const faqs: { question: string; answer: string }[] = [
  {
    question: "What photobooths do you have?",
    answer:
      "We offer five experiences: the Receipt Photobooth (receipt-style photo output with a retro booth), the Standard Photobooth (conventional booth with 4×6 prints), the High-Angle Photobooth (overhead camera perspective), Sintra Board Photos (A3 and A4), and Original Instax Photo Printing.",
  },
  {
    question: "What's the difference between the Receipt Photobooth and the Standard Photobooth?",
    answer:
      "The Receipt Photobooth is a unique alternative with a distinctive receipt-style photo output and a retro-inspired booth where the camera and monitor are enclosed inside the box. The Standard Photobooth is our conventional photobooth experience, printing 4×6 photos using a non-ink printing process designed for more durable, longer-lasting keepsakes.",
  },
  {
    question: "Why is it called the Receipt Photobooth?",
    answer:
      "Because of its distinctive receipt-style photo output — your memories come out printed like a receipt. The booth itself also has a retro-inspired look, with the camera and monitor enclosed inside the photobooth box.",
  },
  {
    question: "What size are your standard photobooth prints?",
    answer:
      "Our Standard Photobooth prints are 4×6. They're produced using a non-ink printing process rather than a conventional ink-based printer, designed for more durable, longer-lasting keepsakes.",
  },
  {
    question: "Are your prints printed with ink?",
    answer:
      "Our Standard Photobooth uses a non-ink printing process rather than a conventional ink-based printer. This method is designed to provide keepsakes that are more durable and longer-lasting compared with ink-printed photos.",
  },
  {
    question: "What is a High-Angle Photobooth?",
    answer:
      "It captures photos from a high/overhead angle, giving a different visual perspective. A key benefit is privacy and comfort — since the camera is above you, guests can pose and have fun without feeling as shy or self-conscious about facing a camera directly.",
  },
  {
    question: "Do you offer Sintra board photos? What sizes?",
    answer:
      "Yes! We produce photos on Sintra board, available in A3 and A4 sizes.",
  },
  {
    question: "Do you offer Instax printing?",
    answer:
      "Yes — we offer Original Instax photo printing: physical photo prints made using original Instax materials.",
  },
  {
    question: "What's the difference between Instax and your standard 4×6 print?",
    answer:
      "Original Instax printing gives you physical prints made with original Instax materials in that unmistakable Instax format. The Standard Photobooth produces 4×6 prints using a non-ink printing process designed for durable, long-lasting keepsakes. They're simply different formats — it depends on the look and feel you want.",
  },
  {
    question: "How do we book?",
    answer:
      "Simply send us a message with your event details (date, location, and the setup you're interested in). We'll guide you through the next steps and provide the details you need.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Pricing is shared on request — send us a message with your event details and we'll confirm the details for you.",
  },
];
