const mongoose = require('mongoose');

/** Locale map — Somali-first; empty strings mean "use client fallback". */
const localizedStringSchema = new mongoose.Schema(
  {
    so: { type: String, trim: true, default: '' },
    en: { type: String, trim: true, default: '' },
    ar: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const ctaSchema = new mongoose.Schema(
  {
    label: { type: localizedStringSchema, default: () => ({}) },
    href: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    role: { type: localizedStringSchema, default: () => ({}) },
    photoUrl: { type: String, trim: true, default: '' },
    bio: { type: localizedStringSchema, default: () => ({}) },
    focus: { type: localizedStringSchema, default: () => ({}) },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

/** Dynamic Trust Point item (Qodobbada Kalsoonida) */
const trustPointSchema = new mongoose.Schema(
  {
    title: { type: localizedStringSchema, default: () => ({}) },
    desc: { type: localizedStringSchema, default: () => ({}) },
    icon: { type: String, trim: true, default: 'check' },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

/** Dynamic How It Works Step item (Tallaabooyinka Sida Ay U Shaqeyso) */
const howStepSchema = new mongoose.Schema(
  {
    step: { type: String, trim: true, default: '1' },
    title: { type: localizedStringSchema, default: () => ({}) },
    desc: { type: localizedStringSchema, default: () => ({}) },
    icon: { type: String, trim: true, default: 'calendar' },
    photoUrl: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

/** Dynamic Feature / Solved Problem item (Astaamaha & Faa'iidooyinka) */
const featureSchema = new mongoose.Schema(
  {
    badge: { type: localizedStringSchema, default: () => ({}) },
    title: { type: localizedStringSchema, default: () => ({}) },
    desc: { type: localizedStringSchema, default: () => ({}) },
    icon: { type: String, trim: true, default: 'shield' },
    photoUrl: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

/** Dynamic FAQ item (Su'aalaha Badanaa La Isweydiiyo) */
const faqSchema = new mongoose.Schema(
  {
    question: { type: localizedStringSchema, default: () => ({}) },
    answer: { type: localizedStringSchema, default: () => ({}) },
    category: { type: String, trim: true, default: 'general' },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

/** Dynamic Testimonial item (Fikradaha Macaamiisha & Kabtanada) */
const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    role: { type: localizedStringSchema, default: () => ({}) },
    teamOrStadium: { type: String, trim: true, default: '' },
    quote: { type: localizedStringSchema, default: () => ({}) },
    photoUrl: { type: String, trim: true, default: '' },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

/** Dynamic Partner / Sponsor Logo item (Garoomada & Shuraakada) */
const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    logoUrl: { type: String, trim: true, default: '' },
    website: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: true }
);

/** Dynamic Social Link item (Baraha Bulshada) */
const socialLinkSchema = new mongoose.Schema(
  {
    platform: { type: String, trim: true, required: true },
    url: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
  },
  { _id: true }
);

const HERO_MEDIA_MODES = ['none', 'background_image', 'hero_image', 'background_video'];
const OVERLAY_STRENGTHS = ['light', 'medium', 'strong'];
const CTA_ALIGNS = ['start', 'center'];

/**
 * Singleton marketing / public UI content (key = "default").
 * 100% Super Admin editable and dynamic.
 */
const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    navbar: {
      tagline: { type: localizedStringSchema, default: () => ({}) },
      promoBanner: {
        enabled: { type: Boolean, default: false },
        text: { type: localizedStringSchema, default: () => ({}) },
        href: { type: String, trim: true, default: '' },
      },
    },
    hero: {
      mediaMode: {
        type: String,
        enum: HERO_MEDIA_MODES,
        default: 'none',
      },
      backgroundImageUrl: { type: String, trim: true, default: '' },
      heroImageUrl: { type: String, trim: true, default: '' },
      backgroundVideoUrl: { type: String, trim: true, default: '' },
      posterImageUrl: { type: String, trim: true, default: '' },
      overlayStrength: {
        type: String,
        enum: OVERLAY_STRENGTHS,
        default: 'medium',
      },
      brandLabel: { type: String, trim: true, default: 'E-Garoon' },
      badge: { type: localizedStringSchema, default: () => ({}) },
      title: { type: localizedStringSchema, default: () => ({}) },
      subtitle: { type: localizedStringSchema, default: () => ({}) },
      primaryCta: { type: ctaSchema, default: () => ({}) },
      secondaryCta: { type: ctaSchema, default: () => ({}) },
      ctaAlign: { type: String, enum: CTA_ALIGNS, default: 'start' },
      /** @deprecated — migrated to mediaMode + URL fields */
      mediaType: { type: String, enum: ['none', 'image', 'video'], default: 'none' },
      /** @deprecated — migrated to backgroundImageUrl / heroImageUrl / backgroundVideoUrl */
      mediaUrl: { type: String, trim: true, default: '' },
    },
    home: {
      // Dynamic arrays
      trustPoints: { type: [trustPointSchema], default: [] },
      howTitle: { type: localizedStringSchema, default: () => ({}) },
      howSteps: { type: [howStepSchema], default: [] },
      featuresTitle: { type: localizedStringSchema, default: () => ({}) },
      featuresSubtitle: { type: localizedStringSchema, default: () => ({}) },
      features: { type: [featureSchema], default: [] },
      faqsTitle: { type: localizedStringSchema, default: () => ({}) },
      faqs: { type: [faqSchema], default: [] },
      testimonialsTitle: { type: localizedStringSchema, default: () => ({}) },
      testimonials: { type: [testimonialSchema], default: [] },
      partnersTitle: { type: localizedStringSchema, default: () => ({}) },
      partners: { type: [partnerSchema], default: [] },
      ctaTitle: { type: localizedStringSchema, default: () => ({}) },
      ctaDesc: { type: localizedStringSchema, default: () => ({}) },
      ctaPrimaryBtn: { type: ctaSchema, default: () => ({}) },
      ctaSecondaryBtn: { type: ctaSchema, default: () => ({}) },

      // Legacy fallback fields for backward compatibility
      howStep1Title: { type: localizedStringSchema, default: () => ({}) },
      howStep1Desc: { type: localizedStringSchema, default: () => ({}) },
      howStep2Title: { type: localizedStringSchema, default: () => ({}) },
      howStep2Desc: { type: localizedStringSchema, default: () => ({}) },
      howStep3Title: { type: localizedStringSchema, default: () => ({}) },
      howStep3Desc: { type: localizedStringSchema, default: () => ({}) },
    },
    about: {
      badge: { type: localizedStringSchema, default: () => ({}) },
      title: { type: localizedStringSchema, default: () => ({}) },
      description: { type: localizedStringSchema, default: () => ({}) },
      visionTitle: { type: localizedStringSchema, default: () => ({}) },
      visionDesc: { type: localizedStringSchema, default: () => ({}) },
      teamTitle: { type: localizedStringSchema, default: () => ({}) },
      teamDesc: { type: localizedStringSchema, default: () => ({}) },
      team: { type: [teamMemberSchema], default: [] },
    },
    contact: {
      badge: { type: localizedStringSchema, default: () => ({}) },
      title: { type: localizedStringSchema, default: () => ({}) },
      subtitle: { type: localizedStringSchema, default: () => ({}) },
      supportBlurb: { type: localizedStringSchema, default: () => ({}) },
      phone: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, default: '' },
      whatsapp: { type: String, trim: true, default: '' },
      address: { type: localizedStringSchema, default: () => ({}) },
      hours: { type: localizedStringSchema, default: () => ({}) },
    },
    footer: {
      tagline: { type: localizedStringSchema, default: () => ({}) },
      copyrightText: { type: localizedStringSchema, default: () => ({}) },
      socialLinks: { type: [socialLinkSchema], default: [] },
    },
    /**
     * Legal / onboarding texts (Somali + English primary; AR optional).
     * Used on public pages and frozen into OwnerOnboarding agreement snapshots.
     */
    policies: {
      terms: { type: localizedStringSchema, default: () => ({}) },
      privacy: { type: localizedStringSchema, default: () => ({}) },
      ownerAgreement: { type: localizedStringSchema, default: () => ({}) },
      cancellationRefund: { type: localizedStringSchema, default: () => ({}) },
      disputePolicy: { type: localizedStringSchema, default: () => ({}) },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteContent', siteContentSchema);
module.exports.HERO_MEDIA_MODES = HERO_MEDIA_MODES;
module.exports.OVERLAY_STRENGTHS = OVERLAY_STRENGTHS;
module.exports.CTA_ALIGNS = CTA_ALIGNS;
