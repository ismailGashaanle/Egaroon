import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiSave,
  FiImage,
  FiType,
  FiHome,
  FiUsers,
  FiPhone,
  FiLayout,
  FiPlus,
  FiTrash2,
  FiFlag,
  FiFileText,
  FiCheckCircle,
  FiList,
  FiBriefcase,
  FiHelpCircle,
  FiStar,
  FiShield,
  FiShare2,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardTitle } from '../../components/common/Card';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import MediaUpload from '../../components/common/MediaUpload';
import LocaleFields from '../../components/common/LocaleFields';
import { FullPageSpinner } from '../../components/common/Spinner';
import { adminApi } from '../../api/adminApi';
import {
  emptyLocale,
  emptySiteContent,
  emptyTrustPoint,
  emptyHowStep,
  emptyFeature,
  emptyFaq,
  emptyTestimonial,
  emptyPartner,
  emptySocialLink,
  HERO_MEDIA_MODES,
  OVERLAY_STRENGTHS,
} from '../../lib/siteContent';
import { toastApiError } from '../../lib/support';

const MODE_HINTS = {
  none: 'Layout: left copy/CTAs + optional right-side hero image over the forest gradient.',
  background_image:
    'Layout: full-bleed background image + left copy/CTAs + optional right-side hero image. Mobile stacks text then image.',
  hero_image:
    'Layout: forest gradient + left copy/CTAs + right-side hero image (no full-bleed background media).',
  background_video:
    'Layout: muted looping video background + left copy/CTAs + optional right-side hero image. Poster used while loading / reduced-motion.',
};

const TABS = [
  { id: 'hero', label: 'Hero & Media', icon: FiImage },
  { id: 'trust', label: 'Trust Points', icon: FiCheckCircle },
  { id: 'how', label: 'How It Works', icon: FiList },
  { id: 'features', label: 'Features', icon: FiBriefcase },
  { id: 'faqs', label: 'FAQs', icon: FiHelpCircle },
  { id: 'testimonials', label: 'Reviews', icon: FiStar },
  { id: 'partners', label: 'Partners', icon: FiShield },
  { id: 'navbar', label: 'Navbar & Promo', icon: FiFlag },
  { id: 'about', label: 'About & Team', icon: FiUsers },
  { id: 'contact', label: 'Contact', icon: FiPhone },
  { id: 'footer', label: 'Footer & Social', icon: FiLayout },
  { id: 'policies', label: 'Policies', icon: FiFileText },
];

const ICON_OPTIONS = [
  { value: 'shield', label: 'Shield (Ammaan / Badbaado)' },
  { value: 'zap', label: 'Lightning (Degdeg / Xawaare)' },
  { value: 'dollar-sign', label: 'Dollar (Lacag-bixin)' },
  { value: 'check-circle', label: 'Check Circle (Xaqiijin)' },
  { value: 'clock', label: 'Clock (24/7 / Waqti)' },
  { value: 'calendar', label: 'Calendar (Ballansho)' },
  { value: 'users', label: 'Users (Kooxo / Ciyaartoy)' },
  { value: 'award', label: 'Award (Tayada Sare)' },
  { value: 'star', label: 'Star (Xiddig)' },
  { value: 'phone', label: 'Phone (Taageero)' },
  { value: 'map-pin', label: 'Map Pin (Goobta Garoonka)' },
];

const SOCIAL_PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'linkedin', label: 'LinkedIn' },
];

function emptyMember() {
  return {
    name: '',
    role: emptyLocale(),
    photoUrl: '',
    bio: emptyLocale(),
    focus: emptyLocale(),
    sortOrder: 0,
  };
}

export default function SiteContentEditor() {
  const [form, setForm] = useState(emptySiteContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('hero');
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await adminApi.getSiteContent();
        const c = data.data?.content || {};
        const empty = emptySiteContent();
        setForm({
          ...empty,
          ...c,
          hero: { ...empty.hero, ...(c.hero || {}) },
          navbar: { ...empty.navbar, ...(c.navbar || {}) },
          home: {
            ...empty.home,
            ...(c.home || {}),
            trustPoints: Array.isArray(c.home?.trustPoints) ? c.home.trustPoints : [],
            howSteps: Array.isArray(c.home?.howSteps) ? c.home.howSteps : [],
            features: Array.isArray(c.home?.features) ? c.home.features : [],
            faqs: Array.isArray(c.home?.faqs) ? c.home.faqs : [],
            testimonials: Array.isArray(c.home?.testimonials) ? c.home.testimonials : [],
            partners: Array.isArray(c.home?.partners) ? c.home.partners : [],
          },
          about: {
            ...empty.about,
            ...(c.about || {}),
            team: Array.isArray(c.about?.team) ? c.about.team : [],
          },
          contact: { ...empty.contact, ...(c.contact || {}) },
          footer: {
            ...empty.footer,
            ...(c.footer || {}),
            socialLinks: Array.isArray(c.footer?.socialLinks) ? c.footer.socialLinks : [],
          },
          policies: { ...empty.policies, ...(c.policies || {}) },
        });
        setUpdatedAt(c.updatedAt || null);
      } catch (err) {
        toastApiError(err, 'Failed to load site content');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const patch = (section, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const patchNested = (section, nestedKey, key, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [nestedKey]: { ...(prev[section]?.[nestedKey] || {}), [key]: value },
      },
    }));
  };

  // --- Dynamic Array Helpers for Home ---
  const updateHomeArrayItem = (arrayKey, index, field, value) => {
    setForm((prev) => {
      const arr = [...(prev.home?.[arrayKey] || [])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, home: { ...prev.home, [arrayKey]: arr } };
    });
  };

  const addHomeArrayItem = (arrayKey, factoryFn) => {
    setForm((prev) => {
      const arr = [...(prev.home?.[arrayKey] || [])];
      return {
        ...prev,
        home: {
          ...prev.home,
          [arrayKey]: [...arr, { ...factoryFn(), sortOrder: arr.length }],
        },
      };
    });
  };

  const removeHomeArrayItem = (arrayKey, index) => {
    setForm((prev) => ({
      ...prev,
      home: {
        ...prev.home,
        [arrayKey]: (prev.home?.[arrayKey] || []).filter((_, i) => i !== index),
      },
    }));
  };

  // --- Dynamic Array Helpers for Footer Social Links ---
  const updateSocialLink = (index, field, value) => {
    setForm((prev) => {
      const links = [...(prev.footer?.socialLinks || [])];
      links[index] = { ...links[index], [field]: value };
      return { ...prev, footer: { ...prev.footer, socialLinks: links } };
    });
  };

  const addSocialLink = () => {
    setForm((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        socialLinks: [...(prev.footer?.socialLinks || []), emptySocialLink('facebook')],
      },
    }));
  };

  const removeSocialLink = (index) => {
    setForm((prev) => ({
      ...prev,
      footer: {
        ...prev.footer,
        socialLinks: (prev.footer?.socialLinks || []).filter((_, i) => i !== index),
      },
    }));
  };

  // --- Team Member Helpers ---
  const updateMember = (index, key, value) => {
    setForm((prev) => {
      const team = [...(prev.about?.team || [])];
      team[index] = { ...team[index], [key]: value };
      return { ...prev, about: { ...prev.about, team } };
    });
  };

  const addMember = () => {
    setForm((prev) => ({
      ...prev,
      about: {
        ...prev.about,
        team: [...(prev.about?.team || []), { ...emptyMember(), sortOrder: (prev.about?.team || []).length }],
      },
    }));
  };

  const removeMember = (index) => {
    setForm((prev) => ({
      ...prev,
      about: {
        ...prev.about,
        team: (prev.about?.team || []).filter((_, i) => i !== index),
      },
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await adminApi.updateSiteContent({
        navbar: form.navbar,
        hero: form.hero,
        home: form.home,
        about: form.about,
        contact: form.contact,
        footer: form.footer,
        policies: form.policies,
      });
      const c = data.data.content;
      const empty = emptySiteContent();
      setForm({
        ...empty,
        ...c,
        hero: { ...empty.hero, ...(c.hero || {}) },
        navbar: { ...empty.navbar, ...(c.navbar || {}) },
        home: {
          ...empty.home,
          ...(c.home || {}),
          trustPoints: Array.isArray(c.home?.trustPoints) ? c.home.trustPoints : [],
          howSteps: Array.isArray(c.home?.howSteps) ? c.home.howSteps : [],
          features: Array.isArray(c.home?.features) ? c.home.features : [],
          faqs: Array.isArray(c.home?.faqs) ? c.home.faqs : [],
          testimonials: Array.isArray(c.home?.testimonials) ? c.home.testimonials : [],
          partners: Array.isArray(c.home?.partners) ? c.home.partners : [],
        },
        about: {
          ...empty.about,
          ...(c.about || {}),
          team: Array.isArray(c.about?.team) ? c.about.team : [],
        },
        contact: { ...empty.contact, ...(c.contact || {}) },
        footer: {
          ...empty.footer,
          ...(c.footer || {}),
          socialLinks: Array.isArray(c.footer?.socialLinks) ? c.footer.socialLinks : [],
        },
        policies: { ...empty.policies, ...(c.policies || {}) },
      });
      setUpdatedAt(c.updatedAt);
      toast.success('Site content saved — updates published instantly across all devices');
      window.dispatchEvent(new Event('kulansiiye:site-content'));
    } catch (err) {
      toastApiError(err, 'Could not save site content');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FullPageSpinner />;

  const hero = form.hero || {};
  const navbar = form.navbar || {};
  const home = form.home || {};
  const about = form.about || {};
  const contact = form.contact || {};
  const footer = form.footer || {};
  const policies = form.policies || {};

  return (
    <PageTransition className="max-w-5xl">
      <PageHeader
        title="Site content & CMS"
       // description="Super Admin — Maamul dhammaan waxyaabaha ku jira website-ka si toos ah oo dynamic ah (Hero, Trust Points, How It Works, Features, FAQs, Reviews, Partners, About, Contact, Footer, iyo Policies). Wax walba oo aad beddesho ama ku darto waxay toos uga muuqanayaan web-ka iyo mobile-ka."
      />

      {/* Cloudflare R2 & MongoDB Storage Status Card */}
      {/* <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-900 shadow-sm dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white font-bold text-[10px]">
            ☁️
          </span>
          <span>
            <strong>Cloudflare R2 & MongoDB:</strong> Dhammaan sawirrada, fiidyowyada, iyo faylasha waxaad toos ugu shubaysaa Cloudflare Object Storage waxaana xogtooda lagu keydinayaa MongoDB.
          </span>
        </div>
        <span className="rounded-md bg-white/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-charcoal shadow-sm dark:bg-dark-surface dark:text-white">
          Active: Cloudflare R2
        </span>
      </div> */}

      {/* Tabs Bar */}
      <div className="mt-4 flex flex-wrap gap-1.5 border-b border-border pb-3 dark:border-dark-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all ${
              tab === id
                ? 'bg-forest text-white shadow-sm ring-1 ring-forest/50'
                : 'bg-white text-muted hover:bg-surface-inset hover:text-charcoal dark:bg-dark-surface dark:hover:text-dark-text'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={save} className="mt-5 space-y-6">
        {/* ===================== HERO TAB ===================== */}
        {tab === 'hero' && (
          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-muted">
              <FiImage />
              <CardTitle>Hero Section & Media</CardTitle>
            </div>

            <div className="rounded-xl border border-forest/20 bg-forest/5 px-4 py-3 text-sm text-forest dark:border-dark-primary/30 dark:bg-dark-primary/10 dark:text-dark-primary">
              {MODE_HINTS[hero.mediaMode] || MODE_HINTS.none}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Brand label"
                value={hero.brandLabel || ''}
                onChange={(e) => patch('hero', 'brandLabel', e.target.value)}
                hint="Default: E-Garoon — displayed large in hero"
              />
              <Select
                label="Hero media mode"
                value={hero.mediaMode || 'none'}
                onChange={(e) => patch('hero', 'mediaMode', e.target.value)}
              >
                {HERO_MEDIA_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            <LocaleFields
              label="Badge / eyebrow"
              value={hero.badge || emptyLocale()}
              onChange={(v) => patch('hero', 'badge', v)}
              hint="Tusaale: 'Nidaamka #1 ee Garoomada Soomaaliya'"
            />
            <LocaleFields
              label="Headline / Title"
              value={hero.title || emptyLocale()}
              onChange={(v) => patch('hero', 'title', v)}
              hint="Tusaale: 'Ballanso garoonkaada kubadda cagta daqiiqado gudahood'"
            />
            <LocaleFields
              label="Description / Subtitle"
              value={hero.subtitle || emptyLocale()}
              onChange={(v) => patch('hero', 'subtitle', v)}
              multiline
              rows={3}
            />

            {(hero.mediaMode === 'background_image' || hero.mediaMode === 'background_video') && (
              <div className="space-y-2 rounded-xl border border-border p-4 bg-surface-inset dark:border-dark-border">
                <MediaUpload
                  folder="site"
                  accept="image/*"
                  value={hero.backgroundImageUrl || ''}
                  onChange={(url) => patch('hero', 'backgroundImageUrl', url)}
                  label="Full-bleed background image"
                 // hint="Stored in Cloudflare R2 / MongoDB. High resolution landscape image (1920x1080)."
                />
                {hero.backgroundImageUrl ? (
                  <div className="overflow-hidden rounded-xl border border-border p-2">
                    <img
                      src={hero.backgroundImageUrl}
                      alt="Background Preview"
                      className="h-32 w-full rounded-lg object-cover"
                    />
                  </div>
                ) : null}
              </div>
            )}

            {hero.mediaMode === 'background_video' && (
              <div className="space-y-3 rounded-xl border border-border p-4 bg-surface-inset dark:border-dark-border">
                <MediaUpload
                  folder="site"
                  accept="video/mp4,video/webm"
                  value={hero.backgroundVideoUrl || ''}
                  onChange={(url) => patch('hero', 'backgroundVideoUrl', url)}
                  label="Background video URL (MP4 / WebM)"
                 // hint="Cloudflare R2 storage — muted looping background video."
                />
                {hero.backgroundVideoUrl ? (
                  <div className="overflow-hidden rounded-xl border border-border p-2">
                    <video
                      src={hero.backgroundVideoUrl}
                      controls
                      className="h-36 w-full rounded-lg object-cover"
                    />
                  </div>
                ) : null}

                <MediaUpload
                  folder="site"
                  accept="image/*"
                  value={hero.posterImageUrl || ''}
                  onChange={(url) => patch('hero', 'posterImageUrl', url)}
                  label="Video poster image (optional)"
                  hint="Shown before video loads or on low-power / reduced-motion devices."
                />
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-border p-4 dark:border-dark-border">
              <MediaUpload
                folder="site"
                accept="image/*"
                value={hero.heroImageUrl || ''}
                onChange={(url) => patch('hero', 'heroImageUrl', url)}
                label="Right-side hero image (optional)"
                //hint="Large football photo beside copy on desktop — Cloudflare R2"
              />
              {hero.heroImageUrl ? (
                <div className="overflow-hidden rounded-xl border border-border p-2 bg-surface-inset flex items-center justify-center">
                  <img
                    src={hero.heroImageUrl}
                    alt="Hero Graphic Preview"
                    className="max-h-48 rounded-lg object-contain"
                  />
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Overlay strength"
                value={hero.overlayStrength || 'medium'}
                onChange={(e) => patch('hero', 'overlayStrength', e.target.value)}
              >
                {OVERLAY_STRENGTHS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>

              <Select
                label="CTA alignment"
                value={hero.ctaAlign || 'start'}
                onChange={(e) => patch('hero', 'ctaAlign', e.target.value)}
              >
                <option value="start">Start (left / RTL start)</option>
                <option value="center">Center</option>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-border p-4 dark:border-dark-border">
                <p className="text-sm font-semibold text-charcoal dark:text-dark-text">Primary CTA</p>
                <LocaleFields
                  label="Label"
                  value={hero.primaryCta?.label || emptyLocale()}
                  onChange={(v) => patchNested('hero', 'primaryCta', 'label', v)}
                />
                <Input
                  label="Link"
                  value={hero.primaryCta?.href || ''}
                  onChange={(e) => patchNested('hero', 'primaryCta', 'href', e.target.value)}
                  placeholder="/search-fields"
                />
              </div>
              <div className="space-y-2 rounded-xl border border-border p-4 dark:border-dark-border">
                <p className="text-sm font-semibold text-charcoal dark:text-dark-text">Secondary CTA</p>
                <LocaleFields
                  label="Label"
                  value={hero.secondaryCta?.label || emptyLocale()}
                  onChange={(v) => patchNested('hero', 'secondaryCta', 'label', v)}
                />
                <Input
                  label="Link"
                  value={hero.secondaryCta?.href || ''}
                  onChange={(e) => patchNested('hero', 'secondaryCta', 'href', e.target.value)}
                  placeholder="/about"
                />
              </div>
            </div>
          </Card>
        )}

        {/* ===================== TRUST POINTS TAB ===================== */}
        {tab === 'trust' && (
          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Qodobbada Kalsoonida (Trust Points)</CardTitle>
                <p className="mt-1 text-xs text-muted">
                  Qodobbada kalsoonida ee ka hooseeya Hero-ga (tusaale: Xaqiijin degdeg ah, Lacag-bixin ammaan ah, 24/7 Taageero). Waad dari kartaa, tiri kartaa, ama badeli kartaa markasta.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<FiPlus />}
                onClick={() => addHomeArrayItem('trustPoints', emptyTrustPoint)}
              >
                Ku dar qodob
              </Button>
            </div>

            {(home.trustPoints || []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Qodob kalsooni laguma darin weli. Guji "Ku dar qodob" si aad mid cusub ugu darto.
              </p>
            )}

            <div className="space-y-4">
              {(home.trustPoints || []).map((tp, index) => (
                <div
                  key={tp._id || index}
                  className="relative space-y-3 rounded-xl border border-border bg-surface-inset p-4 dark:border-dark-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => removeHomeArrayItem('trustPoints', index)}
                      title="Tir qodobkan"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="Icon"
                      value={tp.icon || 'shield'}
                      onChange={(e) => updateHomeArrayItem('trustPoints', index, 'icon', e.target.value)}
                    >
                      {ICON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Kala horreynta (Sort Order)"
                      type="number"
                      value={tp.sortOrder ?? index}
                      onChange={(e) => updateHomeArrayItem('trustPoints', index, 'sortOrder', Number(e.target.value))}
                    />
                  </div>

                  <LocaleFields
                    label="Cinwaanka (Title)"
                    value={tp.title || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('trustPoints', index, 'title', v)}
                    hint="Tusaale: 'Xaqiijin Degdeg Ah'"
                  />
                  <LocaleFields
                    label="Sharaxaadda (Description)"
                    value={tp.desc || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('trustPoints', index, 'desc', v)}
                    multiline
                    rows={2}
                    hint="Tusaale: 'Ballankaagu si toos ah ayuu u xaqiijismaa isla marka lacagta la bixiyo.'"
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ===================== HOW IT WORKS TAB ===================== */}
        {tab === 'how' && (
          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Sidee U Shaqeysaa (How It Works Steps)</CardTitle>
                {/* <p className="mt-1 text-xs text-muted">
                  Tallaabooyinka ballanshada (Tallaabada 1, 2, 3, iwm). Waxaad ku dari kartaa sawirro Cloudflare R2 ah iyo qoraallo Soomaali/English ah.
                </p> */}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<FiPlus />}
                onClick={() => addHomeArrayItem('howSteps', () => emptyHowStep((home.howSteps || []).length + 1))}
              >
                Ku dar tallaabo
              </Button>
            </div>

            <LocaleFields
              label="Cinwaanka Guud ee Qaybta (Section Title)"
              value={home.howTitle || emptyLocale()}
              onChange={(v) => patch('home', 'howTitle', v)}
              hint="Tusaale: 'Sidee E-Garoon U Shaqeeyaa?'"
            />

            {(home.howSteps || []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Tallaabo laguma darin weli. Guji "Ku dar tallaabo" si aad u abuurto.
              </p>
            )}

            <div className="space-y-4">
              {(home.howSteps || []).map((step, index) => (
                <div
                  key={step._id || index}
                  className="space-y-3 rounded-xl border border-border bg-surface-inset p-4 dark:border-dark-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy font-bold text-xs text-white">
                      {step.step || index + 1}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => removeHomeArrayItem('howSteps', index)}
                      title="Tir tallaabadan"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      label="Lambarka Tallaabada"
                      value={step.step || String(index + 1)}
                      onChange={(e) => updateHomeArrayItem('howSteps', index, 'step', e.target.value)}
                    />
                    <Select
                      label="Icon"
                      value={step.icon || 'calendar'}
                      onChange={(e) => updateHomeArrayItem('howSteps', index, 'icon', e.target.value)}
                    >
                      {ICON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Kala horreynta (Sort Order)"
                      type="number"
                      value={step.sortOrder ?? index}
                      onChange={(e) => updateHomeArrayItem('howSteps', index, 'sortOrder', Number(e.target.value))}
                    />
                  </div>

                  <LocaleFields
                    label="Cinwaanka Tallaabada"
                    value={step.title || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('howSteps', index, 'title', v)}
                    hint="Tusaale: 'Raadi & Dooro Garoonka'"
                  />
                  <LocaleFields
                    label="Faahfaahinta Tallaabada"
                    value={step.desc || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('howSteps', index, 'desc', v)}
                    multiline
                    rows={2}
                    hint="Tusaale: 'Baadh garoomada kuugu dhow, eeg saacadaha banaan iyo qiimaha.'"
                  />

                  <MediaUpload
                    folder="steps"
                    accept="image/*"
                    value={step.photoUrl || ''}
                    onChange={(url) => updateHomeArrayItem('howSteps', index, 'photoUrl', url)}
                    //label="Sawirka Tallaabada (Optional - Cloudflare R2)"
                  />
                  {step.photoUrl ? (
                    <div className="overflow-hidden rounded-lg border border-border p-1 max-w-xs">
                      <img src={step.photoUrl} alt="Step preview" className="h-24 w-full object-cover rounded" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ===================== FEATURES TAB ===================== */}
        {tab === 'features' && (
          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Adeegyada & Faa'iidooyinka (Features & Benefits)</CardTitle>
                <p className="mt-1 text-xs text-muted">
                  Qaybaha muujinaya sababta E-Garoon loogu kalsoonaan karo (Xisaabinta USD & Shilling, Qaybsiga lacagta, USSD degdeg ah).
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<FiPlus />}
                onClick={() => addHomeArrayItem('features', emptyFeature)}
              >
                Ku dar Feature
              </Button>
            </div>

            <div className="space-y-3 rounded-xl border border-border p-4 bg-surface-inset dark:border-dark-border">
              <LocaleFields
                label="Cinwaanka Guud ee Qaybta Features"
                value={home.featuresTitle || emptyLocale()}
                onChange={(v) => patch('home', 'featuresTitle', v)}
                hint="Default: 'Maxaa E-Garoon Uga Duwan Yahay Nidaamyada Kale?'"
              />
              <LocaleFields
                label="Sharaxaadda Guud ee Qaybta Features"
                value={home.featuresSubtitle || emptyLocale()}
                onChange={(v) => patch('home', 'featuresSubtitle', v)}
                multiline
                rows={2}
              />
            </div>

            {(home.features || []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Feature laguma darin weli. Guji "Ku dar Feature" si aad u abuurto.
              </p>
            )}

            <div className="space-y-4">
              {(home.features || []).map((feat, index) => (
                <div
                  key={feat._id || index}
                  className="space-y-3 rounded-xl border border-border bg-surface-inset p-4 dark:border-dark-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => removeHomeArrayItem('features', index)}
                      title="Tir feature-kan"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="Icon"
                      value={feat.icon || 'shield'}
                      onChange={(e) => updateHomeArrayItem('features', index, 'icon', e.target.value)}
                    >
                      {ICON_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label="Kala horreynta (Sort Order)"
                      type="number"
                      value={feat.sortOrder ?? index}
                      onChange={(e) => updateHomeArrayItem('features', index, 'sortOrder', Number(e.target.value))}
                    />
                  </div>

                  <LocaleFields
                    label="Badge / Calaamad yar"
                    value={feat.badge || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('features', index, 'badge', v)}
                    hint="Tusaale: 'Dual Currency' ama 'Split Payment'"
                  />
                  <LocaleFields
                    label="Cinwaanka (Title)"
                    value={feat.title || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('features', index, 'title', v)}
                  />
                  <LocaleFields
                    label="Sharaxaadda (Description)"
                    value={feat.desc || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('features', index, 'desc', v)}
                    multiline
                    rows={2}
                  />

                  <MediaUpload
                    folder="features"
                    accept="image/*"
                    value={feat.photoUrl || ''}
                    onChange={(url) => updateHomeArrayItem('features', index, 'photoUrl', url)}
                   // label="Sawirka Feature-ka (Optional - Cloudflare R2)"
                  />
                  {feat.photoUrl ? (
                    <div className="overflow-hidden rounded-lg border border-border p-1 max-w-xs">
                      <img src={feat.photoUrl} alt="Feature preview" className="h-24 w-full object-cover rounded" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ===================== FAQS TAB ===================== */}
        {tab === 'faqs' && (
          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Su'aalaha Badanaa La Isweydiiyo (FAQs)</CardTitle>
                <p className="mt-1 text-xs text-muted">
                  Maamul su'aalaha iyo jawaabaha ay isticmaalayaashu, kabtanada, iyo milkiilayaasha garoomadu u baahan yihiin.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<FiPlus />}
                onClick={() => addHomeArrayItem('faqs', emptyFaq)}
              >
                Ku dar Su'aal (FAQ)
              </Button>
            </div>

            <div className="space-y-2 rounded-xl border border-border p-4 bg-surface-inset dark:border-dark-border">
              <LocaleFields
                label="Cinwaanka Guud ee Qaybta FAQs"
                value={home.faqsTitle || emptyLocale()}
                onChange={(v) => patch('home', 'faqsTitle', v)}
                hint="Default: 'Su'aalaha Badanaa La Isweydiiyo'"
              />
            </div>

            {(home.faqs || []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Su'aalo laguma darin weli. Guji "Ku dar Su'aal" si aad u abuurto.
              </p>
            )}

            <div className="space-y-4">
              {(home.faqs || []).map((faq, index) => (
                <div
                  key={faq._id || index}
                  className="space-y-3 rounded-xl border border-border bg-surface-inset p-4 dark:border-dark-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => removeHomeArrayItem('faqs', index)}
                      title="Tir su'aashan"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="Qaybta (Category)"
                      value={faq.category || 'general'}
                      onChange={(e) => updateHomeArrayItem('faqs', index, 'category', e.target.value)}
                    >
                      <option value="general">Guud (General)</option>
                      <option value="booking">Ballanshada (Bookings)</option>
                      <option value="payment">Lacag-bixinta (Payments & Currency)</option>
                      <option value="stadium">Garoomada (Stadium Owners)</option>
                    </Select>
                    <Input
                      label="Kala horreynta (Sort Order)"
                      type="number"
                      value={faq.sortOrder ?? index}
                      onChange={(e) => updateHomeArrayItem('faqs', index, 'sortOrder', Number(e.target.value))}
                    />
                  </div>

                  <LocaleFields
                    label="Su'aasha (Question)"
                    value={faq.question || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('faqs', index, 'question', v)}
                    hint="Tusaale: 'Sidee laba kooxood u qaybsan karaan lacagta ballanka?'"
                  />
                  <LocaleFields
                    label="Jawaabta (Answer)"
                    value={faq.answer || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('faqs', index, 'answer', v)}
                    multiline
                    rows={3}
                    hint="Tusaale: 'Kabtanka hore ayaa bixin kara 50% qaybtiisa, wuxuuna link casuumaad ah u dirayaa kabtanka labaad...'"
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ===================== TESTIMONIALS TAB ===================== */}
        {tab === 'testimonials' && (
          <Card className="space-y-5 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Aragtida Macaamiisha (Reviews & Testimonials)</CardTitle>
                {/* <p className="mt-1 text-xs text-muted">
                  Fikradaha kabtanada iyo milkiilayaasha garoomada. Waxaad ku dari kartaa sawirka ciyaartooyga oo Cloudflare R2 lagu keydiyo iyo qiimeynta xiddigaha (1-5).
                </p> */}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<FiPlus />}
                onClick={() => addHomeArrayItem('testimonials', emptyTestimonial)}
              >
                Ku dar Review
              </Button>
            </div>

            <div className="space-y-2 rounded-xl border border-border p-4 bg-surface-inset dark:border-dark-border">
              <LocaleFields
                label="Cinwaanka Guud ee Qaybta Reviews"
                value={home.testimonialsTitle || emptyLocale()}
                onChange={(v) => patch('home', 'testimonialsTitle', v)}
                hint="Default: 'Aragtida Kabtanada & Milkiilayaasha'"
              />
            </div>

            {(home.testimonials || []).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Review laguma darin weli. Guji "Ku dar Review" si aad u abuurto.
              </p>
            )}

            <div className="space-y-4">
              {(home.testimonials || []).map((tst, index) => (
                <div
                  key={tst._id || index}
                  className="space-y-3 rounded-xl border border-border bg-surface-inset p-4 dark:border-dark-border"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => removeHomeArrayItem('testimonials', index)}
                      title="Tir aragtidan"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      label="Magaca Qofka"
                      value={tst.name || ''}
                      onChange={(e) => updateHomeArrayItem('testimonials', index, 'name', e.target.value)}
                      required
                    />
                    <Input
                      label="Kooxda / Garoonka"
                      value={tst.teamOrStadium || ''}
                      onChange={(e) => updateHomeArrayItem('testimonials', index, 'teamOrStadium', e.target.value)}
                      placeholder="FC Hilaac ama Garoonka Stadium"
                    />
                    <Select
                      label="Qiimeynta (Rating)"
                      value={tst.rating ?? 5}
                      onChange={(e) => updateHomeArrayItem('testimonials', index, 'rating', Number(e.target.value))}
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (5 Xiddig)</option>
                      <option value={4}>⭐⭐⭐⭐ (4 Xiddig)</option>
                      <option value={3}>⭐⭐⭐ (3 Xiddig)</option>
                    </Select>
                  </div>

                  <LocaleFields
                    label="Doorka / Jagada (Role)"
                    value={tst.role || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('testimonials', index, 'role', v)}
                    hint="Tusaale: 'Kabtanka Kooxda' ama 'Milkiilaha Garoonka'"
                  />

                  <LocaleFields
                    label="Fikradiisa / Qoraalka (Quote)"
                    value={tst.quote || emptyLocale()}
                    onChange={(v) => updateHomeArrayItem('testimonials', index, 'quote', v)}
                    multiline
                    rows={3}
                  />

                  <MediaUpload
                    folder="testimonials"
                    accept="image/*"
                    value={tst.photoUrl || ''}
                    onChange={(url) => updateHomeArrayItem('testimonials', index, 'photoUrl', url)}
                   // label="Sawirka Qofka (Avatar - Cloudflare R2)"
                  />
                  {tst.photoUrl ? (
                    <div className="h-16 w-16 overflow-hidden rounded-full border border-border">
                      <img src={tst.photoUrl} alt="Avatar" className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ===================== PARTNERS TAB ===================== */}
        {tab === 'partners' && (
          <div className="space-y-5">
            <Card className="space-y-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Garoomada Isbahaysiga ah (Partners & Stadiums)</CardTitle>
                  <p className="mt-1 text-xs text-muted">
                    Logo-yada garoomada iyo shirkadaha isbahaysiga la ah E-Garoon ee ka muuqanaya bogga hore.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  icon={<FiPlus />}
                  onClick={() => addHomeArrayItem('partners', emptyPartner)}
                >
                  Ku dar Isbahaysi
                </Button>
              </div>

              <div className="space-y-2 rounded-xl border border-border p-4 bg-surface-inset dark:border-dark-border">
                <LocaleFields
                  label="Cinwaanka Guud ee Qaybta Isbahaysiga (Partners Title)"
                  value={home.partnersTitle || emptyLocale()}
                  onChange={(v) => patch('home', 'partnersTitle', v)}
                  hint="Default: 'Garoomada & Isbahaysiga la Shaqeeya E-Garoon'"
                />
              </div>

              {(home.partners || []).length === 0 && (
                <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                  Isbahaysi laguma darin weli. Guji "Ku dar Isbahaysi" si aad u abuurto.
                </p>
              )}

              <div className="space-y-4">
                {(home.partners || []).map((partner, index) => (
                  <div
                    key={partner._id || index}
                    className="space-y-3 rounded-xl border border-border bg-surface-inset p-4 dark:border-dark-border"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                        onClick={() => removeHomeArrayItem('partners', index)}
                        title="Tir isbahaysigan"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label="Magaca Garoonka / Shirkadda"
                        value={partner.name || ''}
                        onChange={(e) => updateHomeArrayItem('partners', index, 'name', e.target.value)}
                        required
                      />
                      <Input
                        label="Website / Link (Optional)"
                        value={partner.website || ''}
                        onChange={(e) => updateHomeArrayItem('partners', index, 'website', e.target.value)}
                        placeholder="https://..."
                      />
                    </div>

                    <MediaUpload
                      folder="partners"
                      accept="image/*"
                      value={partner.logoUrl || ''}
                      onChange={(url) => updateHomeArrayItem('partners', index, 'logoUrl', url)}
                      //label="Logo-da (Cloudflare R2)"
                    />
                    {partner.logoUrl ? (
                      <div className="h-16 w-36 overflow-hidden rounded border border-border bg-white p-1">
                        <img src={partner.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>

            {/* Bottom CTA Banner */}
            <Card className="space-y-4 p-6">
              <CardTitle>Banner-ka Hoose ee Bogga Hore (Bottom Call-to-Action)</CardTitle>
              <p className="text-xs text-muted">
                Banner-ka cagaaran ee ku yaal gunta hoose ee bogga hore ee ku dhiirrigeliya isticmaalaha inuu is-diiwaangeliyo ama nala soo xiriiro.
              </p>
              <LocaleFields
                label="Cinwaanka Banner-ka Hoose (CTA Title)"
                value={home.ctaTitle || emptyLocale()}
                onChange={(v) => patch('home', 'ctaTitle', v)}
              />
              <LocaleFields
                label="Sharaxaadda Banner-ka Hoose (CTA Description)"
                value={home.ctaDesc || emptyLocale()}
                onChange={(v) => patch('home', 'ctaDesc', v)}
                multiline
                rows={2}
              />
            </Card>
          </div>
        )}

        {/* ===================== NAVBAR & PROMO TAB ===================== */}
        {tab === 'navbar' && (
          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-muted">
              <FiType />
              <CardTitle>Navbar & Promo Banner</CardTitle>
            </div>
            <LocaleFields
              label="Hal-ku-dhigga Brand-ka (Tagline - optional)"
              value={navbar.tagline || emptyLocale()}
              onChange={(v) => patch('navbar', 'tagline', v)}
              hint="Waxaa lagu muujinayaa logo-da hoosteeda shaashadaha waaweyn"
            />
            <label className="flex items-center gap-2 text-sm text-charcoal dark:text-dark-text font-medium cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-forest focus:ring-forest"
                checked={Boolean(navbar.promoBanner?.enabled)}
                onChange={(e) =>
                  patch('navbar', 'promoBanner', {
                    ...(navbar.promoBanner || {}),
                    enabled: e.target.checked,
                  })
                }
              />
              Daar Banner-ka wargalinta ee sare (Promo Banner)
            </label>
            <LocaleFields
              label="Qoraalka Banner-ka"
              value={navbar.promoBanner?.text || emptyLocale()}
              onChange={(v) =>
                patch('navbar', 'promoBanner', { ...(navbar.promoBanner || {}), text: v })
              }
            />
            <Input
              label="Link-ga Banner-ka"
              value={navbar.promoBanner?.href || ''}
              onChange={(e) =>
                patch('navbar', 'promoBanner', {
                  ...(navbar.promoBanner || {}),
                  href: e.target.value,
                })
              }
              placeholder="/search-fields"
            />
          </Card>
        )}

        {/* ===================== ABOUT & TEAM TAB ===================== */}
        {tab === 'about' && (
          <div className="space-y-5">
            <Card className="space-y-4 p-6">
              <div className="flex items-center gap-2 text-muted">
                <FiUsers />
                <CardTitle>About Us Page Details</CardTitle>
              </div>
              <LocaleFields
                label="Badge"
                value={about.badge || emptyLocale()}
                onChange={(v) => patch('about', 'badge', v)}
              />
              <LocaleFields
                label="Cinwaanka (Title)"
                value={about.title || emptyLocale()}
                onChange={(v) => patch('about', 'title', v)}
              />
              <LocaleFields
                label="Sharaxaadda Guud (Description)"
                value={about.description || emptyLocale()}
                onChange={(v) => patch('about', 'description', v)}
                multiline
                rows={4}
              />
              <LocaleFields
                label="Cinwaanka Qaybta Kooxda (Team Section Title)"
                value={about.teamTitle || emptyLocale()}
                onChange={(v) => patch('about', 'teamTitle', v)}
              />
              <LocaleFields
                label="Sharaxaadda Qaybta Kooxda"
                value={about.teamDesc || emptyLocale()}
                onChange={(v) => patch('about', 'teamDesc', v)}
                multiline
              />
            </Card>

            <Card className="space-y-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Xubnaha Kooxda Nidaamka (Team Members)</CardTitle>
                <Button type="button" size="sm" variant="outline" icon={<FiPlus />} onClick={addMember}>
                  Ku dar xubin
                </Button>
              </div>
              {(about.team || []).length === 0 && (
                <p className="text-sm text-muted">Xubin laguma darin weli — guji "Ku dar xubin".</p>
              )}
              {(about.team || []).map((member, index) => (
                <div
                  key={member._id || index}
                  className="space-y-3 rounded-xl border border-border bg-surface-inset p-4 dark:border-dark-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-charcoal dark:text-dark-text">
                      Xubinta {index + 1}
                    </p>
                    <button
                      type="button"
                      className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => removeMember(index)}
                      aria-label="Remove member"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                  <Input
                    label="Magaca"
                    value={member.name || ''}
                    onChange={(e) => updateMember(index, 'name', e.target.value)}
                    required
                  />
                  <LocaleFields
                    label="Doorka / Xilka"
                    value={member.role || emptyLocale()}
                    onChange={(v) => updateMember(index, 'role', v)}
                  />
                  <MediaUpload
                    folder="team"
                    accept="image/*"
                    value={member.photoUrl || ''}
                    onChange={(url) => updateMember(index, 'photoUrl', url)}
                   // label="Sawirka Xubinta (Cloudflare R2)"
                  />
                  {member.photoUrl ? (
                    <div className="h-16 w-16 overflow-hidden rounded-full border border-border">
                      <img src={member.photoUrl} alt="Photo" className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                  <LocaleFields
                    label="Bio / Faahfaahin"
                    value={member.bio || emptyLocale()}
                    onChange={(v) => updateMember(index, 'bio', v)}
                    multiline
                    rows={2}
                  />
                  <Input
                    label="Kala horreynta (Sort Order)"
                    type="number"
                    value={member.sortOrder ?? index}
                    onChange={(e) => updateMember(index, 'sortOrder', Number(e.target.value))}
                  />
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ===================== CONTACT TAB ===================== */}
        {tab === 'contact' && (
          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-2 text-muted">
              <FiPhone />
              <CardTitle>Xiriirka & Taageerada (Contact Details)</CardTitle>
            </div>
            <p className="text-xs text-muted">
              Telefoonnada, WhatsApp, Email-ka, iyo ciwaanka rasmiga ah ee nidaamka.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Telefoonka Rasmiga ah"
                value={contact.phone || ''}
                onChange={(e) => patch('contact', 'phone', e.target.value)}
                placeholder="0637856383"
              />
              <Input
                label="Email-ka Taageerada"
                value={contact.email || ''}
                onChange={(e) => patch('contact', 'email', e.target.value)}
                placeholder="support@egaroon.com"
              />
              <Input
                label="WhatsApp Number (with country code)"
                value={contact.whatsapp || ''}
                onChange={(e) => patch('contact', 'whatsapp', e.target.value)}
                placeholder="+252637856383"
              />
            </div>

            <LocaleFields
              label="Xafiiska / Goobta (Address)"
              value={contact.address || emptyLocale()}
              onChange={(v) => patch('contact', 'address', v)}
              hint="Tusaale: 'Hargeysa'"
            />
            <LocaleFields
              label="Saacadaha Shaqada (Hours)"
              value={contact.hours || emptyLocale()}
              onChange={(v) => patch('contact', 'hours', v)}
              hint="Tusaale: 'Furanyahay 24 Saac / 7 Maalmood'"
            />

            <div className="border-t border-border pt-4 mt-2">
              <p className="text-sm font-semibold text-charcoal dark:text-dark-text mb-3">Header-ka Bogga Xiriirka</p>
              <LocaleFields
                label="Badge"
                value={contact.badge || emptyLocale()}
                onChange={(v) => patch('contact', 'badge', v)}
              />
              <LocaleFields
                label="Cinwaanka (Title)"
                value={contact.title || emptyLocale()}
                onChange={(v) => patch('contact', 'title', v)}
              />
              <LocaleFields
                label="Sharaxaadda (Subtitle)"
                value={contact.subtitle || emptyLocale()}
                onChange={(v) => patch('contact', 'subtitle', v)}
                multiline
              />
              <LocaleFields
                label="Qoraalka Taageerada (Support blurb)"
                value={contact.supportBlurb || emptyLocale()}
                onChange={(v) => patch('contact', 'supportBlurb', v)}
                multiline
              />
            </div>
          </Card>
        )}

        {/* ===================== FOOTER & SOCIAL TAB ===================== */}
        {tab === 'footer' && (
          <Card className="space-y-5 p-6">
            <div className="flex items-center gap-2 text-muted">
              <FiLayout />
              <CardTitle>Footer & Baraha Bulshada (Social Links)</CardTitle>
            </div>

            <LocaleFields
              label="Hal-ku-dhigga Footer-ka (Tagline)"
              value={footer.tagline || emptyLocale()}
              onChange={(v) => patch('footer', 'tagline', v)}
              multiline
              rows={2}
            />

            <LocaleFields
              label="Xuquuqda Qoraalka (Copyright Text)"
              value={footer.copyrightText || emptyLocale()}
              onChange={(v) => patch('footer', 'copyrightText', v)}
            />

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FiShare2 size={16} /> Baraha Bulshada (Social Links)
                </CardTitle>
                <Button type="button" size="sm" variant="outline" icon={<FiPlus />} onClick={addSocialLink}>
                  Ku dar Social Link
                </Button>
              </div>

              {(footer.socialLinks || []).length === 0 && (
                <p className="text-sm text-muted">Link laguma darin weli.</p>
              )}

              <div className="space-y-3">
                {(footer.socialLinks || []).map((link, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-inset p-3 dark:border-dark-border"
                  >
                    <Select
                      className="w-40"
                      value={link.platform || 'facebook'}
                      onChange={(e) => updateSocialLink(index, 'platform', e.target.value)}
                    >
                      {SOCIAL_PLATFORMS.map((sp) => (
                        <option key={sp.value} value={sp.value}>
                          {sp.label}
                        </option>
                      ))}
                    </Select>
                    <Input
                      className="flex-1 min-w-[200px]"
                      placeholder="https://..."
                      value={link.url || ''}
                      onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
                    />
                    <label className="flex items-center gap-1.5 text-xs text-charcoal font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={link.active !== false}
                        onChange={(e) => updateSocialLink(index, 'active', e.target.checked)}
                      />
                      Active
                    </label>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => removeSocialLink(index)}
                      title="Tir link-gan"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* ===================== POLICIES TAB ===================== */}
        {tab === 'policies' && (
          <Card className="space-y-6 p-6">
            <div className="flex items-center gap-2 text-muted">
              <FiFileText />
              <CardTitle>Xeerarka, Shuruudaha & Heshiisyada (Legal & Policies)</CardTitle>
            </div>
            <p className="text-xs text-muted dark:text-dark-muted">
              Qoraalladani waxay toos uga muuqanayaan bogagga shuruudaha, heshiisyada milkiilayaasha garoomada (Agreement PDF & snapshots), iyo sharciyada lacag-celinta.
            </p>

            <LocaleFields
              label="Shuruudaha Isticmaalka (Terms of Service / Rules)"
              value={policies.terms || emptyLocale()}
              onChange={(v) => patch('policies', 'terms', v)}
              multiline
              rows={8}
            />
            <LocaleFields
              label="Ilaalinta Xogta Gaarka Ah (Privacy Policy)"
              value={policies.privacy || emptyLocale()}
              onChange={(v) => patch('policies', 'privacy', v)}
              multiline
              rows={8}
            />
            <LocaleFields
              label="Heshiiska Milkiilayaasha Garoomada (Stadium Owner Agreement)"
              value={policies.ownerAgreement || emptyLocale()}
              onChange={(v) => patch('policies', 'ownerAgreement', v)}
              multiline
              rows={8}
            />
            <LocaleFields
              label="Xeerka Joojinta & Lacag-celinta (Cancellation & Refund Policy)"
              value={policies.cancellationRefund || emptyLocale()}
              onChange={(v) => patch('policies', 'cancellationRefund', v)}
              multiline
              rows={8}
            />
            <LocaleFields
              label="Xeerka Xallinta Khilaafaadka (Dispute Resolution Policy)"
              value={policies.disputePolicy || emptyLocale()}
              onChange={(v) => patch('policies', 'disputePolicy', v)}
              multiline
              rows={8}
            />
          </Card>
        )}

        {updatedAt && (
          <p className="text-xs text-muted">Keydintii ugu dambaysay: {new Date(updatedAt).toLocaleString()}</p>
        )}

        <Button type="submit" icon={<FiSave />} loading={saving} className="w-full" size="lg">
          Keydi dhammaan isbeddellada (Save Site Content)
        </Button>
      </form>
    </PageTransition>
  );
}
