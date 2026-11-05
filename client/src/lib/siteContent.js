/** Empty locale map for forms / defaults. */
export function emptyLocale() {
  return { so: '', en: '', ar: '' };
}

export function emptyCta() {
  return { label: emptyLocale(), href: '' };
}

export function emptyTrustPoint() {
  return {
    title: emptyLocale(),
    desc: emptyLocale(),
    icon: 'shield',
    sortOrder: 0,
  };
}

export function emptyHowStep(step = '1') {
  return {
    step: String(step),
    title: emptyLocale(),
    desc: emptyLocale(),
    icon: 'calendar',
    photoUrl: '',
    sortOrder: 0,
  };
}

export function emptyFeature() {
  return {
    badge: emptyLocale(),
    title: emptyLocale(),
    desc: emptyLocale(),
    icon: 'shield',
    photoUrl: '',
    sortOrder: 0,
  };
}

export function emptyFaq() {
  return {
    question: emptyLocale(),
    answer: emptyLocale(),
    category: 'general',
    sortOrder: 0,
  };
}

export function emptyTestimonial() {
  return {
    name: '',
    role: emptyLocale(),
    teamOrStadium: '',
    quote: emptyLocale(),
    photoUrl: '',
    rating: 5,
    sortOrder: 0,
  };
}

export function emptyPartner() {
  return {
    name: '',
    logoUrl: '',
    website: '',
    sortOrder: 0,
  };
}

export function emptySocialLink(platform = 'facebook') {
  return {
    platform,
    url: '',
    active: true,
  };
}

export const HERO_MEDIA_MODES = [
  { value: 'none', label: 'None — gradient + optional right image' },
  { value: 'background_image', label: 'Background image + optional right image' },
  { value: 'hero_image', label: 'Right-side hero image only (gradient)' },
  { value: 'background_video', label: 'Background video + optional right image' },
];

export const OVERLAY_STRENGTHS = [
  { value: 'light', label: 'Light' },
  { value: 'medium', label: 'Medium' },
  { value: 'strong', label: 'Strong' },
];

/**
 * Resolve a CMS localized field for the active language.
 * Prefer current lang → so → en → ar → fallback string.
 */
export function pickLocale(field, lang = 'so', fallback = '') {
  if (field == null) return fallback;
  if (typeof field === 'string') {
    const s = field.trim();
    return s || fallback;
  }
  if (typeof field !== 'object') return fallback;
  const order = [lang, 'so', 'en', 'ar'];
  for (const code of order) {
    const v = field[code];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return fallback;
}

/** True if any locale has non-empty text. */
export function localeFilled(field) {
  if (!field || typeof field !== 'object') return false;
  return Boolean(field.so?.trim() || field.en?.trim() || field.ar?.trim());
}

export function emptySiteContent() {
  return {
    navbar: {
      tagline: emptyLocale(),
      promoBanner: { enabled: false, text: emptyLocale(), href: '' },
    },
    hero: {
      mediaMode: 'none',
      backgroundImageUrl: '',
      heroImageUrl: '',
      backgroundVideoUrl: '',
      posterImageUrl: '',
      overlayStrength: 'medium',
      brandLabel: 'E-Garoon',
      badge: emptyLocale(),
      title: emptyLocale(),
      subtitle: emptyLocale(),
      primaryCta: emptyCta(),
      secondaryCta: emptyCta(),
      ctaAlign: 'start',
    },
    home: {
      trustPoints: [],
      howTitle: emptyLocale(),
      howSteps: [],
      featuresTitle: emptyLocale(),
      featuresSubtitle: emptyLocale(),
      features: [],
      faqsTitle: emptyLocale(),
      faqs: [],
      testimonialsTitle: emptyLocale(),
      testimonials: [],
      partnersTitle: emptyLocale(),
      partners: [],
      ctaTitle: emptyLocale(),
      ctaDesc: emptyLocale(),
      ctaPrimaryBtn: emptyCta(),
      ctaSecondaryBtn: emptyCta(),
    },
    about: {
      badge: emptyLocale(),
      title: emptyLocale(),
      description: emptyLocale(),
      visionTitle: emptyLocale(),
      visionDesc: emptyLocale(),
      teamTitle: emptyLocale(),
      teamDesc: emptyLocale(),
      team: [],
    },
    contact: {
      badge: emptyLocale(),
      title: emptyLocale(),
      subtitle: emptyLocale(),
      supportBlurb: emptyLocale(),
      phone: '',
      email: '',
      whatsapp: '',
      address: emptyLocale(),
      hours: emptyLocale(),
    },
    footer: {
      tagline: emptyLocale(),
      copyrightText: emptyLocale(),
      socialLinks: [],
    },
    policies: {
      terms: emptyLocale(),
      privacy: emptyLocale(),
      ownerAgreement: emptyLocale(),
      cancellationRefund: emptyLocale(),
      disputePolicy: emptyLocale(),
    },
  };
}
