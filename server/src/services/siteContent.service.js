const SiteContent = require('../models/SiteContent');
const ApiError = require('../utils/ApiError');

const HERO_MEDIA_MODES = ['none', 'background_image', 'hero_image', 'background_video'];
const OVERLAY_STRENGTHS = ['light', 'medium', 'strong'];
const CTA_ALIGNS = ['start', 'center'];

let cache = null;

const EMPTY_LOCALE = () => ({ so: '', en: '', ar: '' });

function loc(so, en = '', ar = '') {
  return { so: String(so || ''), en: String(en || so || ''), ar: String(ar || '') };
}

function emptyCta() {
  return { label: EMPTY_LOCALE(), href: '' };
}

function defaults() {
  return {
    key: 'default',
    navbar: {
      tagline: loc('Nidaamka Ballanshada Garoomada & Ciyaaraha', 'Stadium Booking & Sports Platform'),
      promoBanner: { enabled: false, text: EMPTY_LOCALE(), href: '' },
    },
    hero: {
      mediaMode: 'none',
      backgroundImageUrl: '',
      heroImageUrl: '',
      backgroundVideoUrl: '',
      posterImageUrl: '',
      overlayStrength: 'medium',
      brandLabel: 'E-Garoon',
      badge: loc('Ballan fudud · Lacag-bixin toos ah', 'Easy booking · Instant mobile payment'),
      title: loc('Ballanso Garoonka Ugu Dhow, Bixi Mobile Money', 'Book the Best Pitches, Pay with Mobile Money'),
      subtitle: loc(
        'Ku biir kumanaan cayaartooy iyo garoomo ku xiran E-Garoon. Raadi boos banaan, bixi nuskaaga, oo u dir code-ka kooxda kaa soo horjeeda.',
        'Join thousands of players and stadiums. Find open slots, pay your team share, and invite your opponents seamlessly.'
      ),
      primaryCta: { label: loc('Ballanso Garoon', 'Book a Pitch'), href: '/search-fields' },
      secondaryCta: { label: loc('Wax Ka Baro', 'Learn More'), href: '/about' },
      ctaAlign: 'start',
      mediaType: 'none',
      mediaUrl: '',
    },
    home: {
      trustPoints: [
        {
          title: loc('Kalsooni & Boos Sugan', 'Guaranteed Booking'),
          desc: loc('Booska aad ballansato adigaa iska leh, dib u dhac iyo qabsasho ma dhacayso.', 'Your booked slot is locked and confirmed instantly.'),
          icon: 'shield',
          sortOrder: 0,
        },
        {
          title: loc('Bixi Mobile Money (USD ama SlSh)', 'Mobile Money (USD & SlSh)'),
          desc: loc('Ku bixi Waafi, Zaad, eDahab, ama Sahal si degdeg ah.', 'Pay seamlessly via Waafi, Zaad, eDahab, or Sahal.'),
          icon: 'phone',
          sortOrder: 1,
        },
        {
          title: loc('Qaybsiga Lacagta Kooxaha', 'Split Payment with Opponent'),
          desc: loc('Koox kasta waxay bixin kartaa nuskeeda ama kabtanka A ayaa wada bixin kara.', 'Each team pays their share or Team A can cover the full match.'),
          icon: 'users',
          sortOrder: 2,
        },
      ],
      howTitle: loc('Sida Ay U Shaqeyso E-Garoon', 'How E-Garoon Works'),
      howSteps: [
        {
          step: '1',
          title: loc('Dooro Garoonka & Waqtiga', 'Choose Stadium & Slot'),
          desc: loc('Ka raadi garoomada magaaladaada kuugu dhow, fiiri xilliyada bannaan iyo qiimaha.', 'Search local pitches by city, inspect available hours and prices.'),
          icon: 'calendar',
          photoUrl: '',
          sortOrder: 0,
        },
        {
          step: '2',
          title: loc('Bixi Qaybtaada (Mobile Money)', 'Pay Your Share'),
          desc: loc('Geli taleefankaaga oo xaqiiji nuskaaga adigoo isticmaalaya Zaad, Waafi, ama eDahab.', 'Confirm with your mobile money PIN to instantly hold the match.'),
          icon: 'credit-card',
          photoUrl: '',
          sortOrder: 1,
        },
        {
          step: '3',
          title: loc('U Dir Match Code Kooxda B', 'Invite Team B with Match Code'),
          desc: loc('La wadaag lambarka sirta ah kabtanka kale si ay u bixiyaan nuska kale una soo galaan.', 'Share the Match Code on WhatsApp so opponent confirms their half.'),
          icon: 'send',
          photoUrl: '',
          sortOrder: 2,
        },
      ],
      featuresTitle: loc('Maxaa E-Garoon Ugu Wanaagsan Yahay?', 'Why Choose E-Garoon?'),
      featuresSubtitle: loc('Waxaan xallinnay dhammaan dhibaatooyinkii haystay garoomada iyo kooxaha ciyaara.', 'Built specifically to eliminate booking conflicts, no-shows, and cash chaos.'),
      features: [
        {
          badge: loc('Bilaa Muran', 'Zero Conflicts'),
          title: loc('Jadwal Toos ah oo Hufan', 'Live Conflict-Free Slots'),
          desc: loc('Marna ma dhacayso laba koox oo isku qabsata hal garoon sababtoo ah booska isla markiiba waa la xiraa.', 'Smart holds lock slots in real-time preventing double bookings.'),
          icon: 'check-circle',
          photoUrl: '',
          sortOrder: 0,
        },
        {
          badge: loc('Dhaqaale Hufan', 'Transparent Finance'),
          title: loc('Maamul Dakhli oo Hufan', 'Clear Stadium Accounting'),
          desc: loc('Milkiilayaasha garoomadu waxay si toos ah ula socon karaan dakhligooda USD iyo SlSh maalin kasta.', 'Stadium owners track every dollar and shilling with automated reports.'),
          icon: 'pie-chart',
          photoUrl: '',
          sortOrder: 1,
        },
        {
          badge: loc('Ciyaaro Tartan', 'Tournaments & Matches'),
          title: loc('Tartamo & Horyaallo', 'Tournaments & Leagues'),
          desc: loc('Ka qaybgal koobabka maxalliga ah ama samee tartan kooxeed oo sharaf leh.', 'Organize and join local cup competitions with automated schedules.'),
          icon: 'trophy',
          photoUrl: '',
          sortOrder: 2,
        },
      ],
      faqsTitle: loc("Su'aalaha Badanaa La Isweydiiyo", 'Frequently Asked Questions'),
      faqs: [
        {
          question: loc('Sideen ku ballansan karaa garoon?', 'How do I book a football pitch?'),
          answer: loc('Dooro garoonka aad rabto, dooro waqtiga bannaan, ka dibna bixi qaybta kooxdaada adoo isticmaalaya taleefankaaga gacanta.', 'Select your desired pitch, pick a free slot, and approve the payment with your mobile money PIN.'),
          category: 'booking',
          sortOrder: 0,
        },
        {
          question: loc('Ma bixin karaa labada kooxba kharashkooda?', 'Can I pay for both teams?'),
          answer: loc('Haa, kabtanka kooxda A wuxuu awoodaa inuu doorto "Bixi Dhammaan Ciyaarta (Full match)" si kooxda B aysan lacag uga baahan.', 'Yes, Team A captain can choose "Pay Full Match" so the entire slot is confirmed immediately.'),
          category: 'payment',
          sortOrder: 1,
        },
        {
          question: loc('Lacagta SlSh (Shilin Somaliland) ma lagu bixin karaa?', 'Can I pay in Somaliland Shillings?'),
          answer: loc('Haa, nidaamku wuxuu si buuxda u taageeraa USD iyo Somaliland Shilling isagoo isticmaalaya sarifka maalinlaha ah ee tooska ah.', 'Yes, our platform supports both USD and Somaliland Shillings with live dynamic exchange rates.'),
          category: 'payment',
          sortOrder: 2,
        },
      ],
      testimonialsTitle: loc('Maxay Yiraahdeen Macaamiisheennu?', 'What Our Users Say'),
      testimonials: [
        {
          name: 'Ismaaciil Jaamac',
          role: loc('Kabtanka FC Hargeysa', 'Team Captain'),
          teamOrStadium: 'Hargeysa Stars',
          quote: loc('E-Garoon wuxuu naga xalliyay dhibaatadii ugu weyneyd ee ahayd inaan garoon raadinno ama wakhtigu naga dhaafo.', 'E-Garoon made finding and booking pitches effortless for our team.'),
          photoUrl: '',
          rating: 5,
          sortOrder: 0,
        },
        {
          name: 'Cali Gadhle',
          role: loc('Milkiilaha Garoonka', 'Stadium Owner'),
          teamOrStadium: 'Ali Gadhle Stadium',
          quote: loc('Nidaamkani wuxuu noo fududeeyay maamulka lacagta iyo soo xaraynta dakhliga oo hufan maalin kasta.', 'Automated mobile money booking transformed our daily stadium revenue management.'),
          photoUrl: '',
          rating: 5,
          sortOrder: 1,
        },
      ],
      partnersTitle: loc('Garoomada & Shuraakada Noo Diiwaangashan', 'Our Stadium Partners'),
      partners: [],
      ctaTitle: loc('Diyaar Ma U Tahay Inaad Ciyaarto?', 'Ready to Play?'),
      ctaDesc: loc('Ku biir maanta oo hel garoomada ugu fiican deegaankaaga daqiiqado gudahood.', 'Join today and secure the best pitches in your city in minutes.'),
      ctaPrimaryBtn: { label: loc('Raadi Garoon Hadda', 'Search Pitches Now'), href: '/search-fields' },
      ctaSecondaryBtn: { label: loc('Diiwaangeli Garoonkaaga', 'List Your Stadium'), href: '/register' },
      howStep1Title: EMPTY_LOCALE(),
      howStep1Desc: EMPTY_LOCALE(),
      howStep2Title: EMPTY_LOCALE(),
      howStep2Desc: EMPTY_LOCALE(),
      howStep3Title: EMPTY_LOCALE(),
      howStep3Desc: EMPTY_LOCALE(),
    },
    about: {
      badge: loc('Nagu Saabsan', 'About Us'),
      title: loc('Hadafkeenna E-Garoon', 'Our Mission at E-Garoon'),
      description: loc(
        'Waxaan nahay nidaamka koowaad ee casriga ah ee isku xira garoomada kubbadda cagta iyo kooxaha ciyaartooyda ee Geeska Afrika.',
        'We are the premier sports infrastructure platform connecting sports venues and football teams across the region.'
      ),
      visionTitle: loc('Aragtidayada', 'Our Vision'),
      visionDesc: loc(
        'In cayaaraha iyo garoomada la gaarsiiyo heer caalami ah oo casri ah.',
        'To elevate grassroots sports infrastructure to modern world-class digital standards.'
      ),
      teamTitle: loc('Kooxda Nidaamka Horumarisay', 'Meet Our Leadership Team'),
      teamDesc: loc('Khubaro u heellan horumarinta ciyaaraha iyo tignoolajiyada.', 'Passionate technologists and sports innovators dedicated to community sports.'),
      team: [],
    },
    contact: {
      badge: loc('Nala Soo Xiriir', 'Contact Us'),
      title: loc('Wax Su’aal Ah Ma Qabtaa?', 'Have Any Questions?'),
      subtitle: loc('Kooxdayada taageeradu waxay diyaar kuu tahay 24/7.', 'Our dedicated support team is available 24/7 to assist you.'),
      supportBlurb: loc('Nala soo xiriir xilli kasta si aan kuu caawinno.', 'Reach out anytime via phone, WhatsApp, or email.'),
      phone: '0637856383',
      email: 'support@egaroon.com',
      whatsapp: '+252637856383',
      address: loc('Hargeysa', 'Hargeisa'),
      hours: loc('Furanyahay 24 Saac', 'Available 24/7'),
    },
    footer: {
      tagline: loc('Nidaamka rasmiga ah ee ballanshada garoomada iyo kooxaha.', 'The premier stadium booking and sports management platform.'),
      copyrightText: loc(`© ${new Date().getFullYear()} E-Garoon. Dhammaan xuquuqda way dhowran yihiin.`, `© ${new Date().getFullYear()} E-Garoon. All rights reserved.`),
      socialLinks: [
        { platform: 'facebook', url: 'https://facebook.com', active: true },
        { platform: 'instagram', url: 'https://instagram.com', active: true },
        { platform: 'whatsapp', url: 'https://wa.me/252637856383', active: true },
        { platform: 'twitter', url: 'https://x.com', active: true },
      ],
    },
    policies: {
      terms: loc('Shuruudaha Isticmaalka Nidaamka E-Garoon...', 'Terms of Service...'),
      privacy: loc('Ilaalinta Xogta Gaarka Ah (Privacy Policy)...', 'Privacy Policy...'),
      ownerAgreement: loc('Heshiiska Milkiilayaasha Garoomada...', 'Stadium Owner Agreement...'),
      cancellationRefund: loc('Xeerka Joojinta Ballanka iyo Lacag-celinta...', 'Cancellation & Refund Policy...'),
      disputePolicy: loc('Xeerka Xallinta Khilaafaadka Ciyaaraha...', 'Dispute Resolution Policy...'),
    },
  };
}

function normalizeLocale(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return EMPTY_LOCALE();
  }
  return {
    so: String(value.so || '').trim(),
    en: String(value.en || '').trim(),
    ar: String(value.ar || '').trim(),
  };
}

function normalizeCta(value) {
  if (!value || typeof value !== 'object') return emptyCta();
  return {
    label: normalizeLocale(value.label),
    href: String(value.href || '').trim(),
  };
}

function normalizeTeamMember(m, index = 0) {
  if (!m || typeof m !== 'object') return null;
  const name = String(m.name || '').trim();
  if (!name) return null;
  return {
    ...(m._id ? { _id: m._id } : {}),
    name,
    role: normalizeLocale(m.role),
    photoUrl: String(m.photoUrl || '').trim(),
    bio: normalizeLocale(m.bio),
    focus: normalizeLocale(m.focus),
    sortOrder: Number.isFinite(Number(m.sortOrder)) ? Number(m.sortOrder) : index,
  };
}

function normalizeTrustPoint(t, index = 0) {
  if (!t || typeof t !== 'object') return null;
  return {
    ...(t._id ? { _id: t._id } : {}),
    title: normalizeLocale(t.title),
    desc: normalizeLocale(t.desc),
    icon: String(t.icon || 'shield').trim(),
    sortOrder: Number.isFinite(Number(t.sortOrder)) ? Number(t.sortOrder) : index,
  };
}

function normalizeHowStep(s, index = 0) {
  if (!s || typeof s !== 'object') return null;
  return {
    ...(s._id ? { _id: s._id } : {}),
    step: String(s.step || String(index + 1)).trim(),
    title: normalizeLocale(s.title),
    desc: normalizeLocale(s.desc),
    icon: String(s.icon || 'calendar').trim(),
    photoUrl: String(s.photoUrl || '').trim(),
    sortOrder: Number.isFinite(Number(s.sortOrder)) ? Number(s.sortOrder) : index,
  };
}

function normalizeFeature(f, index = 0) {
  if (!f || typeof f !== 'object') return null;
  return {
    ...(f._id ? { _id: f._id } : {}),
    badge: normalizeLocale(f.badge),
    title: normalizeLocale(f.title),
    desc: normalizeLocale(f.desc),
    icon: String(f.icon || 'shield').trim(),
    photoUrl: String(f.photoUrl || '').trim(),
    sortOrder: Number.isFinite(Number(f.sortOrder)) ? Number(f.sortOrder) : index,
  };
}

function normalizeFaq(q, index = 0) {
  if (!q || typeof q !== 'object') return null;
  return {
    ...(q._id ? { _id: q._id } : {}),
    question: normalizeLocale(q.question),
    answer: normalizeLocale(q.answer),
    category: String(q.category || 'general').trim(),
    sortOrder: Number.isFinite(Number(q.sortOrder)) ? Number(q.sortOrder) : index,
  };
}

function normalizeTestimonial(t, index = 0) {
  if (!t || typeof t !== 'object') return null;
  const name = String(t.name || '').trim();
  if (!name) return null;
  return {
    ...(t._id ? { _id: t._id } : {}),
    name,
    role: normalizeLocale(t.role),
    teamOrStadium: String(t.teamOrStadium || '').trim(),
    quote: normalizeLocale(t.quote),
    photoUrl: String(t.photoUrl || '').trim(),
    rating: Number(t.rating) >= 1 && Number(t.rating) <= 5 ? Number(t.rating) : 5,
    sortOrder: Number.isFinite(Number(t.sortOrder)) ? Number(t.sortOrder) : index,
  };
}

function normalizePartner(p, index = 0) {
  if (!p || typeof p !== 'object') return null;
  const name = String(p.name || '').trim();
  if (!name) return null;
  return {
    ...(p._id ? { _id: p._id } : {}),
    name,
    logoUrl: String(p.logoUrl || '').trim(),
    website: String(p.website || '').trim(),
    sortOrder: Number.isFinite(Number(p.sortOrder)) ? Number(p.sortOrder) : index,
  };
}

function normalizeSocialLink(s) {
  if (!s || typeof s !== 'object') return null;
  const platform = String(s.platform || '').trim();
  if (!platform) return null;
  return {
    ...(s._id ? { _id: s._id } : {}),
    platform,
    url: String(s.url || '').trim(),
    active: s.active !== false,
  };
}

function isVideoUrl(url) {
  const u = String(url || '');
  return /\.(mp4|webm|mov)(\?|$)/i.test(u) || u.includes('/video/upload/');
}

function resolveHeroMedia(hero = {}) {
  const legacyUrl = String(hero.mediaUrl || '').trim();
  const legacyType = hero.mediaType;

  let backgroundImageUrl = String(hero.backgroundImageUrl || '').trim();
  let heroImageUrl = String(hero.heroImageUrl || '').trim();
  let backgroundVideoUrl = String(hero.backgroundVideoUrl || '').trim();
  let posterImageUrl = String(hero.posterImageUrl || '').trim();

  const hasNewUrls = Boolean(backgroundImageUrl || heroImageUrl || backgroundVideoUrl || posterImageUrl);
  let mediaMode = HERO_MEDIA_MODES.includes(hero.mediaMode) ? hero.mediaMode : null;

  if (!mediaMode || (!hasNewUrls && legacyUrl && mediaMode === 'none')) {
    if (legacyType === 'video' || (legacyUrl && isVideoUrl(legacyUrl))) {
      mediaMode = 'background_video';
    } else if (legacyType === 'image' || legacyUrl) {
      mediaMode = 'background_image';
    } else {
      mediaMode = mediaMode || 'none';
    }
  }

  if (legacyUrl && !hasNewUrls) {
    if (mediaMode === 'background_video') backgroundVideoUrl = legacyUrl;
    else if (mediaMode === 'hero_image') heroImageUrl = legacyUrl;
    else if (mediaMode === 'background_image') backgroundImageUrl = legacyUrl;
  }

  const overlayStrength = OVERLAY_STRENGTHS.includes(hero.overlayStrength)
    ? hero.overlayStrength
    : 'medium';
  const ctaAlign = CTA_ALIGNS.includes(hero.ctaAlign) ? hero.ctaAlign : 'start';

  return {
    mediaMode,
    backgroundImageUrl,
    heroImageUrl,
    backgroundVideoUrl,
    posterImageUrl,
    overlayStrength,
    ctaAlign,
  };
}

function toPublic(doc) {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  const d = defaults();
  const media = resolveHeroMedia(o.hero || {});

  return {
    navbar: {
      tagline: normalizeLocale(o.navbar?.tagline || d.navbar.tagline),
      promoBanner: {
        enabled: Boolean(o.navbar?.promoBanner?.enabled),
        text: normalizeLocale(o.navbar?.promoBanner?.text),
        href: String(o.navbar?.promoBanner?.href || '').trim(),
      },
    },
    hero: {
      mediaMode: media.mediaMode,
      backgroundImageUrl: media.backgroundImageUrl,
      heroImageUrl: media.heroImageUrl,
      backgroundVideoUrl: media.backgroundVideoUrl,
      posterImageUrl: media.posterImageUrl,
      overlayStrength: media.overlayStrength,
      brandLabel: String(o.hero?.brandLabel || d.hero.brandLabel).trim() || 'E-Garoon',
      badge: normalizeLocale(o.hero?.badge || d.hero.badge),
      title: normalizeLocale(o.hero?.title || d.hero.title),
      subtitle: normalizeLocale(o.hero?.subtitle || d.hero.subtitle),
      primaryCta: normalizeCta(o.hero?.primaryCta || d.hero.primaryCta),
      secondaryCta: normalizeCta(o.hero?.secondaryCta || d.hero.secondaryCta),
      ctaAlign: media.ctaAlign,
    },
    home: {
      trustPoints: o.home?.trustPoints !== undefined && Array.isArray(o.home.trustPoints)
        ? o.home.trustPoints.map((t, i) => normalizeTrustPoint(t, i)).filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder)
        : d.home.trustPoints,
      howTitle: normalizeLocale(o.home?.howTitle || d.home.howTitle),
      howSteps: o.home?.howSteps !== undefined && Array.isArray(o.home.howSteps)
        ? o.home.howSteps.map((s, i) => normalizeHowStep(s, i)).filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder)
        : d.home.howSteps,
      featuresTitle: normalizeLocale(o.home?.featuresTitle || d.home.featuresTitle),
      featuresSubtitle: normalizeLocale(o.home?.featuresSubtitle || d.home.featuresSubtitle),
      features: o.home?.features !== undefined && Array.isArray(o.home.features)
        ? o.home.features.map((f, i) => normalizeFeature(f, i)).filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder)
        : d.home.features,
      faqsTitle: normalizeLocale(o.home?.faqsTitle || d.home.faqsTitle),
      faqs: o.home?.faqs !== undefined && Array.isArray(o.home.faqs)
        ? o.home.faqs.map((q, i) => normalizeFaq(q, i)).filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder)
        : d.home.faqs,
      testimonialsTitle: normalizeLocale(o.home?.testimonialsTitle || d.home.testimonialsTitle),
      testimonials: o.home?.testimonials !== undefined && Array.isArray(o.home.testimonials)
        ? o.home.testimonials.map((t, i) => normalizeTestimonial(t, i)).filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder)
        : d.home.testimonials,
      partnersTitle: normalizeLocale(o.home?.partnersTitle || d.home.partnersTitle),
      partners: Array.isArray(o.home?.partners)
        ? o.home.partners.map((p, i) => normalizePartner(p, i)).filter(Boolean).sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
      ctaTitle: normalizeLocale(o.home?.ctaTitle || d.home.ctaTitle),
      ctaDesc: normalizeLocale(o.home?.ctaDesc || d.home.ctaDesc),
      ctaPrimaryBtn: normalizeCta(o.home?.ctaPrimaryBtn || d.home.ctaPrimaryBtn),
      ctaSecondaryBtn: normalizeCta(o.home?.ctaSecondaryBtn || d.home.ctaSecondaryBtn),
    },
    about: {
      badge: normalizeLocale(o.about?.badge || d.about.badge),
      title: normalizeLocale(o.about?.title || d.about.title),
      description: normalizeLocale(o.about?.description || d.about.description),
      visionTitle: normalizeLocale(o.about?.visionTitle || d.about.visionTitle),
      visionDesc: normalizeLocale(o.about?.visionDesc || d.about.visionDesc),
      teamTitle: normalizeLocale(o.about?.teamTitle || d.about.teamTitle),
      teamDesc: normalizeLocale(o.about?.teamDesc || d.about.teamDesc),
      team: Array.isArray(o.about?.team)
        ? o.about.team
            .map((m, i) => normalizeTeamMember(m, i))
            .filter(Boolean)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    },
    contact: {
      badge: normalizeLocale(o.contact?.badge || d.contact.badge),
      title: normalizeLocale(o.contact?.title || d.contact.title),
      subtitle: normalizeLocale(o.contact?.subtitle || d.contact.subtitle),
      supportBlurb: normalizeLocale(o.contact?.supportBlurb || d.contact.supportBlurb),
      phone: String(o.contact?.phone || d.contact.phone).trim(),
      email: String(o.contact?.email || d.contact.email).trim(),
      whatsapp: String(o.contact?.whatsapp || d.contact.whatsapp).trim(),
      address: normalizeLocale(o.contact?.address || d.contact.address),
      hours: normalizeLocale(o.contact?.hours || d.contact.hours),
    },
    footer: {
      tagline: normalizeLocale(o.footer?.tagline || d.footer.tagline),
      copyrightText: normalizeLocale(o.footer?.copyrightText || d.footer.copyrightText),
      socialLinks: o.footer?.socialLinks !== undefined && Array.isArray(o.footer.socialLinks)
        ? o.footer.socialLinks.map(normalizeSocialLink).filter(Boolean)
        : d.footer.socialLinks,
    },
    policies: {
      terms: normalizeLocale(o.policies?.terms || d.policies.terms),
      privacy: normalizeLocale(o.policies?.privacy || d.policies.privacy),
      ownerAgreement: normalizeLocale(o.policies?.ownerAgreement || d.policies.ownerAgreement),
      cancellationRefund: normalizeLocale(o.policies?.cancellationRefund || d.policies.cancellationRefund),
      disputePolicy: normalizeLocale(o.policies?.disputePolicy || d.policies.disputePolicy),
    },
    updatedAt: o.updatedAt || null,
    updatedBy: o.updatedBy || null,
  };
}

async function hydrate() {
  let doc = await SiteContent.findOne({ key: 'default' });
  if (!doc) {
    doc = await SiteContent.create(defaults());
  }
  cache = doc.toObject();
  return toPublic(doc);
}

async function getContent() {
  if (!cache) await hydrate();
  const doc = await SiteContent.findOne({ key: 'default' });
  return toPublic(doc || cache || defaults());
}

function pickSection(patch, key) {
  if (patch[key] === undefined || patch[key] === null) return undefined;
  if (typeof patch[key] !== 'object' || Array.isArray(patch[key])) {
    throw ApiError.badRequest(`Invalid ${key} payload`);
  }
  return patch[key];
}

async function updateContent(patch, userId) {
  if (!patch || typeof patch !== 'object') {
    throw ApiError.badRequest('No content provided');
  }

  const updates = {};

  const navbar = pickSection(patch, 'navbar');
  if (navbar) {
    if (navbar.tagline !== undefined) updates['navbar.tagline'] = normalizeLocale(navbar.tagline);
    if (navbar.promoBanner !== undefined) {
      updates['navbar.promoBanner'] = {
        enabled: Boolean(navbar.promoBanner?.enabled),
        text: normalizeLocale(navbar.promoBanner?.text),
        href: String(navbar.promoBanner?.href || '').trim(),
      };
    }
  }

  const hero = pickSection(patch, 'hero');
  if (hero) {
    if (hero.mediaMode !== undefined) {
      if (!HERO_MEDIA_MODES.includes(hero.mediaMode)) {
        throw ApiError.badRequest(`Invalid hero.mediaMode`);
      }
      updates['hero.mediaMode'] = hero.mediaMode;
    }
    if (hero.backgroundImageUrl !== undefined) updates['hero.backgroundImageUrl'] = String(hero.backgroundImageUrl || '').trim();
    if (hero.heroImageUrl !== undefined) updates['hero.heroImageUrl'] = String(hero.heroImageUrl || '').trim();
    if (hero.backgroundVideoUrl !== undefined) updates['hero.backgroundVideoUrl'] = String(hero.backgroundVideoUrl || '').trim();
    if (hero.posterImageUrl !== undefined) updates['hero.posterImageUrl'] = String(hero.posterImageUrl || '').trim();
    if (hero.overlayStrength !== undefined) {
      if (!OVERLAY_STRENGTHS.includes(hero.overlayStrength)) {
        throw ApiError.badRequest(`Invalid hero.overlayStrength`);
      }
      updates['hero.overlayStrength'] = hero.overlayStrength;
    }
    if (hero.brandLabel !== undefined) updates['hero.brandLabel'] = String(hero.brandLabel || '').trim();
    if (hero.badge !== undefined) updates['hero.badge'] = normalizeLocale(hero.badge);
    if (hero.title !== undefined) updates['hero.title'] = normalizeLocale(hero.title);
    if (hero.subtitle !== undefined) updates['hero.subtitle'] = normalizeLocale(hero.subtitle);
    if (hero.primaryCta !== undefined) updates['hero.primaryCta'] = normalizeCta(hero.primaryCta);
    if (hero.secondaryCta !== undefined) updates['hero.secondaryCta'] = normalizeCta(hero.secondaryCta);
    if (hero.ctaAlign !== undefined) {
      if (!CTA_ALIGNS.includes(hero.ctaAlign)) {
        throw ApiError.badRequest(`Invalid hero.ctaAlign`);
      }
      updates['hero.ctaAlign'] = hero.ctaAlign;
    }
  }

  const home = pickSection(patch, 'home');
  if (home) {
    if (home.trustPoints !== undefined && Array.isArray(home.trustPoints)) {
      updates['home.trustPoints'] = home.trustPoints.map((t, i) => normalizeTrustPoint(t, i)).filter(Boolean);
    }
    if (home.howTitle !== undefined) updates['home.howTitle'] = normalizeLocale(home.howTitle);
    if (home.howSteps !== undefined && Array.isArray(home.howSteps)) {
      updates['home.howSteps'] = home.howSteps.map((s, i) => normalizeHowStep(s, i)).filter(Boolean);
    }
    if (home.featuresTitle !== undefined) updates['home.featuresTitle'] = normalizeLocale(home.featuresTitle);
    if (home.featuresSubtitle !== undefined) updates['home.featuresSubtitle'] = normalizeLocale(home.featuresSubtitle);
    if (home.features !== undefined && Array.isArray(home.features)) {
      updates['home.features'] = home.features.map((f, i) => normalizeFeature(f, i)).filter(Boolean);
    }
    if (home.faqsTitle !== undefined) updates['home.faqsTitle'] = normalizeLocale(home.faqsTitle);
    if (home.faqs !== undefined && Array.isArray(home.faqs)) {
      updates['home.faqs'] = home.faqs.map((q, i) => normalizeFaq(q, i)).filter(Boolean);
    }
    if (home.testimonialsTitle !== undefined) updates['home.testimonialsTitle'] = normalizeLocale(home.testimonialsTitle);
    if (home.testimonials !== undefined && Array.isArray(home.testimonials)) {
      updates['home.testimonials'] = home.testimonials.map((t, i) => normalizeTestimonial(t, i)).filter(Boolean);
    }
    if (home.partnersTitle !== undefined) updates['home.partnersTitle'] = normalizeLocale(home.partnersTitle);
    if (home.partners !== undefined && Array.isArray(home.partners)) {
      updates['home.partners'] = home.partners.map((p, i) => normalizePartner(p, i)).filter(Boolean);
    }
    if (home.ctaTitle !== undefined) updates['home.ctaTitle'] = normalizeLocale(home.ctaTitle);
    if (home.ctaDesc !== undefined) updates['home.ctaDesc'] = normalizeLocale(home.ctaDesc);
    if (home.ctaPrimaryBtn !== undefined) updates['home.ctaPrimaryBtn'] = normalizeCta(home.ctaPrimaryBtn);
    if (home.ctaSecondaryBtn !== undefined) updates['home.ctaSecondaryBtn'] = normalizeCta(home.ctaSecondaryBtn);
  }

  const about = pickSection(patch, 'about');
  if (about) {
    if (about.badge !== undefined) updates['about.badge'] = normalizeLocale(about.badge);
    if (about.title !== undefined) updates['about.title'] = normalizeLocale(about.title);
    if (about.description !== undefined) updates['about.description'] = normalizeLocale(about.description);
    if (about.visionTitle !== undefined) updates['about.visionTitle'] = normalizeLocale(about.visionTitle);
    if (about.visionDesc !== undefined) updates['about.visionDesc'] = normalizeLocale(about.visionDesc);
    if (about.teamTitle !== undefined) updates['about.teamTitle'] = normalizeLocale(about.teamTitle);
    if (about.teamDesc !== undefined) updates['about.teamDesc'] = normalizeLocale(about.teamDesc);
    if (about.team !== undefined && Array.isArray(about.team)) {
      updates['about.team'] = about.team.map((m, i) => normalizeTeamMember(m, i)).filter(Boolean);
    }
  }

  const contact = pickSection(patch, 'contact');
  if (contact) {
    if (contact.badge !== undefined) updates['contact.badge'] = normalizeLocale(contact.badge);
    if (contact.title !== undefined) updates['contact.title'] = normalizeLocale(contact.title);
    if (contact.subtitle !== undefined) updates['contact.subtitle'] = normalizeLocale(contact.subtitle);
    if (contact.supportBlurb !== undefined) updates['contact.supportBlurb'] = normalizeLocale(contact.supportBlurb);
    if (contact.phone !== undefined) updates['contact.phone'] = String(contact.phone || '').trim();
    if (contact.email !== undefined) updates['contact.email'] = String(contact.email || '').trim();
    if (contact.whatsapp !== undefined) updates['contact.whatsapp'] = String(contact.whatsapp || '').trim();
    if (contact.address !== undefined) updates['contact.address'] = normalizeLocale(contact.address);
    if (contact.hours !== undefined) updates['contact.hours'] = normalizeLocale(contact.hours);
  }

  const footer = pickSection(patch, 'footer');
  if (footer) {
    if (footer.tagline !== undefined) updates['footer.tagline'] = normalizeLocale(footer.tagline);
    if (footer.copyrightText !== undefined) updates['footer.copyrightText'] = normalizeLocale(footer.copyrightText);
    if (footer.socialLinks !== undefined && Array.isArray(footer.socialLinks)) {
      updates['footer.socialLinks'] = footer.socialLinks.map(normalizeSocialLink).filter(Boolean);
    }
  }

  const policies = pickSection(patch, 'policies');
  if (policies) {
    if (policies.terms !== undefined) updates['policies.terms'] = normalizeLocale(policies.terms);
    if (policies.privacy !== undefined) updates['policies.privacy'] = normalizeLocale(policies.privacy);
    if (policies.ownerAgreement !== undefined) updates['policies.ownerAgreement'] = normalizeLocale(policies.ownerAgreement);
    if (policies.cancellationRefund !== undefined) updates['policies.cancellationRefund'] = normalizeLocale(policies.cancellationRefund);
    if (policies.disputePolicy !== undefined) updates['policies.disputePolicy'] = normalizeLocale(policies.disputePolicy);
  }

  if (userId) updates.updatedBy = userId;

  const doc = await SiteContent.findOneAndUpdate(
    { key: 'default' },
    { $set: updates },
    { returnDocument: 'after', upsert: true, runValidators: true }
  );

  cache = doc.toObject();
  return toPublic(doc);
}

module.exports = {
  HERO_MEDIA_MODES,
  hydrate,
  OVERLAY_STRENGTHS,
  CTA_ALIGNS,
  getContent,
  updateContent,
  defaults,
};
