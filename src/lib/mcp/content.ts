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
    body: "A playful take on the ordinary receipt — except this one is worth keeping. Capture your moments and walk away with a physical reminder of the day.",
  },
  {
    number: "02",
    title: "Photobooth",
    tagline: "Classic photobooth fun, made tangible.",
    body: "Gather your people, strike your favorite poses, and create photos you'll actually want to keep.",
  },
  {
    number: "03",
    title: "High-Angle Photobooth",
    tagline: "See the moment from a different angle.",
    body: "A fun perspective that turns group moments, outfits, poses, and celebrations into something a little more memorable.",
  },
  {
    number: "04",
    title: "Photo Sintra Board",
    tagline: "Turn a memory into something you can display.",
    body: "Take a favorite photo beyond the photobooth strip and turn it into a physical keepsake you can put somewhere you'll actually see it.",
  },
  {
    number: "05",
    title: "Original Instax Printing",
    tagline: "Instant memories. Literally.",
    body: "Get your moments printed in that unmistakable Instax format — ready to hold, share, display, or keep in your memory box.",
  },
];

export const faqs: { question: string; answer: string }[] = [
  {
    question: "Do you only offer receipt-style photobooths?",
    answer:
      "No. Recibo Memorato also offers regular photobooth experiences, high-angle photobooth, Photo Sintra Board, and Original Instax Printing.",
  },
  {
    question: "What events can we book you for?",
    answer:
      "Recibo Memorato is designed for celebrations and moments worth keeping. Send us a message with your event details and we'll help you with the available setup.",
  },
  {
    question: "Can we get physical prints?",
    answer:
      "Yes. Physical keepsakes are at the heart of Recibo Memorato, with options including receipt-style prints, Sintra Board, and Original Instax prints.",
  },
  {
    question: "How do we book?",
    answer:
      "Simply send us a message. We'll guide you through the next steps and provide the details you need.",
  },
  {
    question: "What happens after I send a message?",
    answer:
      "You'll receive confirmation and be directed to Messenger for the next step in your inquiry.",
  },
];
