/**
 * Business and legal details shown on the About and legal pages.
 * Every value marked TODO must be filled in by the operator before launch -
 * they are deliberately left blank rather than guessed.
 */
export const SITE = {
  name: "Sponty",
  /** TODO: the person or company legally responsible for Sponty. */
  operator: "",
  /** TODO: a contact address for privacy, deletion, and support requests. */
  contactEmail: "",
  /** TODO: registered or mailing address, if required where you operate. */
  address: "",
  /** Country whose law governs the Terms. TODO: confirm. */
  jurisdiction: "the Philippines",
  /** Minimum age to use Sponty. 16 covers GDPR's strictest default; the Philippines' Data Privacy Act treats under-18s as minors. */
  minimumAge: 16,
  /** Date the legal pages were last changed. Update whenever their text changes. */
  legalUpdated: "2026-10-16",
} as const;

/** Text to show where a TODO value has not been filled in yet. */
export const missing = (value: string, label: string) => value || `[${label} not set yet]`;
