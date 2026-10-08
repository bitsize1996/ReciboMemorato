export interface PublicTestimonial {
  id: string;
  name: string;
  label: string | null;
  quote: string;
  rating: number;
  imageUrl: string | null;
  source: string | null;
  featured: boolean;
}

export const REVIEW_SOURCES = ["Facebook", "Google", "Messenger", "Instagram", "In person"];

/** "★★★★☆" for a rating from 1 to 5. */
export const stars = (rating: number) => "★".repeat(Math.max(0, Math.min(5, rating))) + "☆".repeat(5 - Math.max(0, Math.min(5, rating)));
