// import { useEffect, useState } from 'react';
// import { FiPhone, FiMail, FiMapPin, FiClock, FiMessageCircle } from 'react-icons/fi';
// import PageTransition from '../components/common/PageTransition';
// import Card from '../components/common/Card';
// import Input from '../components/common/Input';
// import { authApi } from '../api/authApi';
// import { useTranslation } from '../i18n/LanguageContext';
// import { useSiteContent } from '../i18n/SiteContentContext';
// import { SUPPORT, loadSupportContacts } from '../lib/support';

// export default function Contact() {
//   const { t } = useTranslation();
//   const { content, lc } = useSiteContent();
//   const contactCms = content?.contact || {};
//   const [city, setCity] = useState('');
//   const [data, setData] = useState({ default: SUPPORT, contacts: [] });

//   useEffect(() => {
//     loadSupportContacts().then(setData);
//   }, []);

//   useEffect(() => {
//     const tmr = setTimeout(() => {
//       authApi
//         .contacts({ city: city || undefined })
//         .then((res) => setData(res.data.data))
//         .catch(() => {});
//     }, 300);
//     return () => clearTimeout(tmr);
//   }, [city]);

//   const title = lc(contactCms.title, t('contact.title'));
//   const subtitle = lc(contactCms.subtitle, t('contact.subtitle'));
//   const supportBlurb = lc(contactCms.supportBlurb);

//   return (
//     <PageTransition>
//       <section>
//         <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
//           <div className="max-w-2xl">
//             <h1 className="font-display text-3xl font-bold text-charcoal sm:text-4xl dark:text-dark-text">
//               {title}
//             </h1>
//             <p className="mt-3 text-muted dark:text-dark-muted">{subtitle}</p>
//             {supportBlurb && (
//               <p className="mt-4 max-w-xl text-sm leading-relaxed text-charcoal dark:text-dark-text">
//                 {supportBlurb}
//               </p>
//             )}
//           </div>

//           <div className="mt-8 max-w-md">
//             <Input
//               label={t('contact.filterCity')}
//               icon={<FiMapPin />}
//               placeholder="Hargeisa"
//               value={city}
//               onChange={(e) => setCity(e.target.value)}
//             />
//           </div>

//           <div className="mt-10 grid gap-6 sm:grid-cols-2">
//             {(data.contacts || []).map((c) => (
//               <Card key={c.id || c.city} className="h-full p-5">
//                 <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">
//                   {c.city}
//                 </h3>
//                 <p className="mt-1 flex items-center gap-1.5 text-sm text-muted dark:text-dark-muted">
//                   <FiMapPin size={14} />
//                   {c.area}, {c.region}
//                 </p>
//                 <ul className="mt-4 space-y-2 text-sm">
//                   <li className="flex items-center gap-2">
//                     <FiPhone className="text-forest" />
//                     <a href={`tel:${c.phone}`} className="font-semibold hover:underline">
//                       {c.phone}
//                     </a>
//                   </li>
//                   <li className="flex items-center gap-2">
//                     <FiMail className="text-forest" />
//                     <a href={`mailto:${c.email}`} className="hover:underline">
//                       {c.email}
//                     </a>
//                   </li>
//                   <li className="flex items-center gap-2">
//                     <FiMessageCircle className="text-forest" />
//                     WhatsApp {c.whatsapp}
//                   </li>
//                   <li className="flex items-center gap-2 text-muted dark:text-dark-muted">
//                     <FiClock size={14} />
//                     {c.hours}
//                   </li>
//                 </ul>
//               </Card>
//             ))}
//           </div>

//           <p className="mt-10 text-sm text-muted dark:text-dark-muted">
//             {t('contact.fallback')}: {data.default?.phone} · {data.default?.email}
//           </p>
//         </div>
//       </section>
//     </PageTransition>
//   );
// }


import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Globe2,
  MapPin,
  MessageCircle,
  QrCode,
  ShieldCheck,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

import PageTransition from '../components/common/PageTransition';
import { useTranslation } from '../i18n/LanguageContext';

const ease = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 35,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.75,
      ease,
    },
  },
};

const fadeLeft = {
  hidden: {
    opacity: 0,
    x: -35,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.8,
      ease,
    },
  },
};

const fadeRight = {
  hidden: {
    opacity: 0,
    x: 35,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.8,
      ease,
    },
  },
};

const stagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
    },
  },
};

function SectionLabel({ children }) {
  return (
    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-forest dark:text-brand-green">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-green" />
      {children}
    </div>
  );
}

function MotionSection({ children, className = '', variants = fadeUp }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{
        once: true,
        amount: 0.15,
      }}
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function TeamMember({
  image,
  initials,
  name,
  role,
  description,
  index,
}) {
  const reduce = useReducedMotion();

  return (
    <motion.article
      variants={fadeUp}
      whileHover={reduce ? undefined : { y: -7 }}
      className="group overflow-hidden rounded-[2rem] border border-border bg-white transition-all duration-500 hover:shadow-2xl hover:shadow-black/[0.06] dark:border-dark-border dark:bg-dark-surface"
    >
      <div className="relative aspect-[1.05] overflow-hidden bg-gradient-to-br from-brand-green/15 via-brand-blue/10 to-brand-navy/10">
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex h-28 w-28 items-center justify-center rounded-full bg-brand-green text-3xl font-black text-white shadow-xl">
              {initials}
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />

        <div className="absolute bottom-5 start-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-xs font-black text-charcoal shadow-lg">
          0{index}
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-xl font-black tracking-tight text-charcoal dark:text-dark-text">
          {name}
        </h3>

        <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-green">
          {role}
        </p>

        <p className="mt-4 text-sm leading-7 text-muted dark:text-dark-muted">
          {description}
        </p>
      </div>
    </motion.article>
  );
}

export default function About() {
  const { t, isRtl } = useTranslation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const arrow = isRtl ? 'rotate-180' : '';

  const goContact = useCallback(() => {
    navigate('/contact');
  }, [navigate]);

  const goBooking = useCallback(() => {
    navigate('/search-fields');
  }, [navigate]);

  const floatAnimation = reduce
    ? undefined
    : {
        y: [0, -8, 0],
      };

  return (
    <PageTransition>
      <main className="overflow-hidden bg-warmwhite text-charcoal dark:bg-dark-bg dark:text-dark-text">

        {/* =========================================================
            HERO
        ========================================================== */}
        <section className="relative isolate overflow-hidden">
          {/* Background glow */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -start-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-green/15 blur-[120px]" />
            <div className="absolute -end-40 top-20 h-[500px] w-[500px] rounded-full bg-brand-blue/10 blur-[120px]" />
          </div>

          <div className="mx-auto grid min-h-[760px] max-w-7xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 lg:py-24">

            {/* Copy */}
            <motion.div
              initial={
                reduce
                  ? false
                  : {
                      opacity: 0,
                      x: isRtl ? 35 : -35,
                    }
              }
              animate={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                duration: 0.85,
                ease,
              }}
              className="relative z-10"
            >
              <SectionLabel>
                E-GAROON
              </SectionLabel>

              <h1 className="max-w-2xl font-display text-5xl font-black leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-[5.4rem]">
                Ciyaartu ha noqoto
                <span className="text-brand-green"> waxa ugu muhiimsan.</span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-8 text-muted sm:text-lg dark:text-dark-muted">
                Waxaan fududaynaynaa ballansiga garoonada Soomaaliyeed:
                lacag ammaan ah, waqti cad, iyo kabtanno isku dhow.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <motion.button
                  type="button"
                  onClick={goBooking}
                  whileHover={reduce ? undefined : { y: -3 }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  className="group inline-flex items-center gap-3 rounded-full bg-brand-green px-6 py-4 text-sm font-extrabold text-white shadow-[0_18px_45px_-18px_rgba(16,185,129,0.95)] transition hover:bg-forest-dark"
                >
                  Ballanso garoon

                  <ArrowRight
                    size={17}
                    className={`transition duration-300 group-hover:translate-x-1 ${arrow}`}
                  />
                </motion.button>

                <motion.button
                  type="button"
                  onClick={goContact}
                  whileHover={reduce ? undefined : { y: -3 }}
                  whileTap={reduce ? undefined : { scale: 0.98 }}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-6 py-4 text-sm font-extrabold text-charcoal transition hover:border-brand-green dark:border-dark-border dark:bg-dark-surface dark:text-dark-text"
                >
                  Nala soo xiriir
                </motion.button>
              </div>

              {/* Trust indicators */}
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-muted dark:text-dark-muted">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck size={16} className="text-brand-green" />
                  Lacag ammaan ah
                </span>

                <span className="inline-flex items-center gap-2">
                  <Clock3 size={16} className="text-brand-green" />
                  Waqti cad
                </span>

                <span className="inline-flex items-center gap-2">
                  <Users size={16} className="text-brand-green" />
                  Kooxo isku dhow
                </span>
              </div>
            </motion.div>

            {/* Hero visual */}
            <motion.div
              initial={
                reduce
                  ? false
                  : {
                      opacity: 0,
                      scale: 0.94,
                      y: 25,
                    }
              }
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              transition={{
                duration: 0.9,
                delay: 0.1,
                ease,
              }}
              className="relative mx-auto w-full max-w-[620px]"
            >
              <div className="relative aspect-[0.92]">

                {/* Main photography */}
                <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-green/20 via-brand-blue/10 to-brand-navy/20 shadow-2xl shadow-black/10">
                  <img
                    src="/images/about/kulansiiye-football.jpg"
                    alt="Football players celebrating together"
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/5" />
                </div>

                {/* Decorative border */}
                <div className="pointer-events-none absolute -bottom-5 -start-5 -z-10 h-40 w-40 rounded-[2rem] border-2 border-brand-green/25" />

                {/* Match status */}
                <motion.div
                  animate={floatAnimation}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute -bottom-5 -start-4 rounded-3xl border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-dark-border dark:bg-dark-surface/95 sm:-start-8"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-green text-white">
                      <CheckCircle2 size={21} />
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted dark:text-dark-muted">
                        E-GAROON
                      </p>
                      <p className="mt-0.5 text-sm font-black text-charcoal dark:text-dark-text">
                        Ciyaartu way bilaabatay
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Booking floating card */}
                <motion.div
                  animate={
                    reduce
                      ? undefined
                      : {
                          y: [0, 7, 0],
                        }
                  }
                  transition={{
                    duration: 4.5,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: 0.6,
                  }}
                  className="absolute -end-3 top-8 rounded-3xl border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl dark:border-dark-border dark:bg-dark-surface/95 sm:-end-8"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                      <CalendarCheck size={19} />
                    </div>

                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted dark:text-dark-muted">
                        Booking
                      </p>

                      <p className="text-sm font-black text-charcoal dark:text-dark-text">
                        La xaqiijiyey
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* =========================================================
            PROBLEM
        ========================================================== */}
        <section className="border-y border-border/70 bg-white dark:border-dark-border/70 dark:bg-dark-surface">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-10 lg:py-28">

            <MotionSection className="max-w-3xl">
              <SectionLabel>
                Dhibaatadii hore
              </SectionLabel>

              <h2 className="font-display text-4xl font-black leading-tight tracking-tight sm:text-5xl">
                Garoon heliddu ma ahayn inay
                <span className="text-brand-green"> sidan u adkaato.</span>
              </h2>

              <p className="mt-6 max-w-2xl text-base leading-8 text-muted dark:text-dark-muted sm:text-lg">
                Ballamo aan la hubin, waqtiyo is-qabsada iyo lacag aan
                caddayn lahayn waxay ciyaarta ka dhigaan mid adag ka hor
                inta aysan bilaaban.
              </p>
            </MotionSection>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
                amount: 0.15,
              }}
              variants={stagger}
              className="mt-16 grid gap-6 lg:grid-cols-3"
            >
              {/* Problem 1 */}
              <motion.article
                variants={fadeUp}
                className="group rounded-[2rem] border border-border p-7 transition duration-500 hover:-translate-y-1 hover:border-red-200 hover:shadow-xl hover:shadow-black/[0.04] dark:border-dark-border"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
                  <Clock3 size={22} />
                </div>

                <h3 className="mt-6 text-xl font-black">
                  Waqti aan caddayn
                </h3>

                <p className="mt-3 text-sm leading-7 text-muted dark:text-dark-muted">
                  Ballamo afka ah iyo “waqti la kiraystay” oo aan la ogayn
                  waxay abuuraan jahawareer iyo isku dhacyo.
                </p>
              </motion.article>

              {/* Problem 2 */}
              <motion.article
                variants={fadeUp}
                className="group rounded-[2rem] border border-border p-7 transition duration-500 hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl hover:shadow-black/[0.04] dark:border-dark-border"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500">
                  <WalletCards size={22} />
                </div>

                <h3 className="mt-6 text-xl font-black">
                  Lacag aan nidaamsanayn
                </h3>

                <p className="mt-3 text-sm leading-7 text-muted dark:text-dark-muted">
                  Lacag gacan iyo heshiisyo aan la diiwaangelin waxay
                  dhaawacaan kalsoonida labada dhinac.
                </p>
              </motion.article>

              {/* Problem 3 */}
              <motion.article
                variants={fadeUp}
                className="group rounded-[2rem] border border-border p-7 transition duration-500 hover:-translate-y-1 hover:border-brand-blue/30 hover:shadow-xl hover:shadow-black/[0.04] dark:border-dark-border"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue/10 text-brand-blue">
                  <MapPin size={22} />
                </div>

                <h3 className="mt-6 text-xl font-black">
                  Kooxo aan isku dhowayn
                </h3>

                <p className="mt-3 text-sm leading-7 text-muted dark:text-dark-muted">
                  Ciyaar maxalli ah waxay u baahan tahay kooxo iyo ciyaartoy
                  si macquul ah isugu dhow.
                </p>
              </motion.article>
            </motion.div>
          </div>
        </section>

        {/* =========================================================
            SOLUTION
        ========================================================== */}
        <section className="relative overflow-hidden py-24 sm:py-32">
          <div className="pointer-events-none absolute -end-40 top-20 h-96 w-96 rounded-full bg-brand-green/10 blur-[120px]" />

          <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">

            <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">

              {/* Image */}
              <MotionSection variants={fadeLeft}>
                <div className="relative aspect-[0.9] overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-green/20 to-brand-blue/10">
                  <img
                    src="/images/about/team-playing.jpg"
                    alt="Football team playing together"
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

                  <div className="absolute bottom-6 start-6 end-6">
                    <div className="rounded-3xl border border-white/20 bg-black/25 p-5 text-white backdrop-blur-xl">
                      <p className="text-xs font-bold uppercase tracking-wider text-white/60">
                        E-GAROON WAY
                      </p>

                      <p className="mt-2 text-lg font-black">
                        Ciyaarta waxaan ka bilownay meel ka horreysa garoonka.
                      </p>
                    </div>
                  </div>
                </div>
              </MotionSection>

              {/* Solution */}
              <MotionSection variants={fadeRight}>
                <SectionLabel>
                  Xalka E-GAROON
                </SectionLabel>

                <h2 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
                  Wax walba meel.
                  <br />
                  <span className="text-brand-green">
                    Ciyaartu si fudud.
                  </span>
                </h2>

                <p className="mt-6 max-w-xl text-base leading-8 text-muted dark:text-dark-muted">
                  E-GAROON wuxuu isku keenaa waqtiga, garoonka, lacagta iyo
                  kooxda si kabtanku ugu mashquulo waxa run ahaantii muhiimka
                  ah — ciyaarta.
                </p>

                <div className="mt-9 space-y-6">

                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                      <CalendarCheck size={20} />
                    </div>

                    <div>
                      <h3 className="font-black">
                        Waqti cad
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-muted dark:text-dark-muted">
                        Arag slots-ka bannaan oo qorshee ciyaartaada adigoon
                        wicin ama qiyaasin.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                      <ShieldCheck size={20} />
                    </div>

                    <div>
                      <h3 className="font-black">
                        Lacag ammaan ah
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-muted dark:text-dark-muted">
                        Lacagta waxaa loo maamulaa si nidaamsan iyadoo la
                        ilaalinayo labada dhinac.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                      <Users size={20} />
                    </div>

                    <div>
                      <h3 className="font-black">
                        Kooxo isku dhow
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-muted dark:text-dark-muted">
                        Ku dhis ciyaartaada meel iyo koox ku habboon.
                      </p>
                    </div>
                  </div>
                </div>
              </MotionSection>
            </div>
          </div>
        </section>

        {/* =========================================================
            HUMAN SECTION
        ========================================================== */}
        <section className="relative overflow-hidden bg-charcoal py-24 text-white dark:bg-[#10151f] sm:py-32">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -start-40 top-0 h-96 w-96 rounded-full bg-brand-green/20 blur-[120px]" />
            <div className="absolute -end-40 bottom-0 h-96 w-96 rounded-full bg-brand-blue/15 blur-[120px]" />
          </div>

          <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-10">

            <MotionSection variants={fadeLeft}>
              <SectionLabel>
                Dadka
              </SectionLabel>

              <h2 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
                Football is
                <br />
                <span className="text-brand-green">
                  better together.
                </span>
              </h2>

              <p className="mt-6 max-w-xl text-base leading-8 text-white/60 sm:text-lg">
                E-GAROON waxaa dhisaya dad fahmaya waxa ka dambeeya
                ciyaar kasta — kabtanka kooxda, milkiilaha garoonka,
                ciyaartoyda iyo bulshada.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {[
                  'Kabtan',
                  'Ciyaaryahan',
                  'Milkiile',
                  'Bulsho',
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/75 backdrop-blur"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </MotionSection>

            <MotionSection variants={fadeRight}>
              <div className="relative aspect-[1.25] overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/5">
                <img
                  src="/images/about/football-community.jpg"
                  alt="Football community celebrating together"
                  loading="lazy"
                  className="h-full w-full object-cover"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                <div className="absolute bottom-6 start-6 max-w-sm">
                  <p className="text-2xl font-black leading-tight">
                    “Ciyaartu waxay isku keentaa dadka.”
                  </p>

                  <p className="mt-2 text-sm text-white/60">
                    Taasi waa sababta aan E-GAROON u dhisnay.
                  </p>
                </div>
              </div>
            </MotionSection>
          </div>
        </section>

        {/* =========================================================
            TRUST
        ========================================================== */}
        <section className="border-b border-border/70 bg-white py-24 dark:border-dark-border/70 dark:bg-dark-surface sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">

            <MotionSection className="max-w-2xl">
              <SectionLabel>
                Aaminaad
              </SectionLabel>

              <h2 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
                Marka lacag iyo waqti
                <span className="text-brand-green"> ku lug leeyihiin,</span>
                <br />
                kalsooni ayaa muhiim ah.
              </h2>
            </MotionSection>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
                amount: 0.15,
              }}
              variants={stagger}
              className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {[
                {
                  icon: ShieldCheck,
                  title: 'OTP',
                  text: 'Aqoonsi iyo xaqiijin.',
                },
                {
                  icon: WalletCards,
                  title: 'Escrow',
                  text: 'Lacag si nidaamsan loo ilaaliyo.',
                },
                {
                  icon: QrCode,
                  title: 'QR Check-in',
                  text: 'Xaqiijin fudud maalinta ciyaarta.',
                },
                {
                  icon: MessageCircle,
                  title: 'Dispute',
                  text: 'Hab cad marka dhibaato timaado.',
                },
              ].map(({ icon: Icon, title, text }) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  className="rounded-[2rem] border border-border p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-dark-border"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                    <Icon size={20} />
                  </div>

                  <h3 className="mt-5 font-black">
                    {title}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-muted dark:text-dark-muted">
                    {text}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* =========================================================
            FAIRNESS
        ========================================================== */}
        <section className="py-24 sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">

            <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">

              <MotionSection variants={fadeLeft}>
                <SectionLabel>
                  Cadaalad
                </SectionLabel>

                <h2 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
                  Nidaam qof walba
                  <br />
                  <span className="text-brand-green">
                    u shaqeeya.
                  </span>
                </h2>

                <p className="mt-6 max-w-xl text-base leading-8 text-muted dark:text-dark-muted">
                  Waxaan rabnaa in kabtanka, kooxda iyo milkiilaha garoonku
                  ay ogaadaan waxa dhacaya — qiimaha, waqtiga iyo lacagta.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    'Qiimo cad',
                    'Commission 4%',
                    'Lacagta milkiilaha kadib ciyaarta',
                    'Xeerar booking oo cad',
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-3 text-sm font-bold"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green/10 text-brand-green">
                        <Check size={14} strokeWidth={3} />
                      </div>

                      {item}
                    </div>
                  ))}
                </div>
              </MotionSection>

              <MotionSection variants={fadeRight}>
                <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-green to-forest-dark p-8 text-white shadow-2xl shadow-brand-green/20 sm:p-10">

                  <div className="absolute -end-20 -top-20 h-56 w-56 rounded-full border border-white/10" />
                  <div className="absolute -bottom-24 -start-16 h-64 w-64 rounded-full border border-white/10" />

                  <div className="relative">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                      <CircleDollarSign size={27} />
                    </div>

                    <p className="mt-8 text-sm font-bold text-white/60">
                      E-GAROON
                    </p>

                    <p className="mt-2 text-5xl font-black tracking-tight">
                      4%
                    </p>

                    <p className="mt-3 max-w-xs text-sm leading-6 text-white/65">
                      Commission cad oo aan qarinayn kharashyo lama filaan ah.
                    </p>

                    <div className="mt-8 border-t border-white/15 pt-6">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 size={19} />

                        <span className="text-sm font-bold">
                          Hufnaan iyo cadaalad
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </MotionSection>
            </div>
          </div>
        </section>

        {/* =========================================================
            TEAM
        ========================================================== */}
        <section className="border-y border-border/70 bg-white py-24 dark:border-dark-border/70 dark:bg-dark-surface sm:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">

            <MotionSection className="max-w-2xl">
              <SectionLabel>
                Kooxda E-Garoon
              </SectionLabel>

              <h2 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
                Dadka ka dambeeya
                <span className="text-brand-green">
                  {' '}ciyaarta.
                </span>
              </h2>

              <p className="mt-5 text-base leading-8 text-muted dark:text-dark-muted">
                Dadka dhisaya khibradda, nidaamka iyo taageerada ka dambeeya
                E-GAROON.
              </p>
            </MotionSection>

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{
                once: true,
                amount: 0.1,
              }}
              variants={stagger}
              className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              <TeamMember
                index="1"
                initials="AY"
                name="Amina Yusuf"
                role="CEO · Product"
                description="Captain experience iyo jihada product-ka."
                image="/images/team/amina.jpg"
              />

              <TeamMember
                index="2"
                initials="KH"
                name="Khalid Hassan"
                role="CTO · Platform"
                description="Payments, slots iyo infrastructure-ka platform-ka."
                image="/images/team/khalid.jpg"
              />

              <TeamMember
                index="3"
                initials="HA"
                name="Hodan Ali"
                role="Ops · Somalia"
                description="Stadiums, operations iyo taageerada bulshada."
                image="/images/team/hodan.jpg"
              />

              <TeamMember
                index="4"
                initials="YO"
                name="Yasin Omar"
                role="Growth"
                description="Cities, leagues iyo kobaca E-GAROON."
                image="/images/team/yasin.jpg"
              />
            </motion.div>
          </div>
        </section>

        {/* =========================================================
            VISION / GROWTH
        ========================================================== */}
        <section className="relative overflow-hidden py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">

            <MotionSection className="mx-auto max-w-3xl text-center">
              <SectionLabel>
                Himilada
              </SectionLabel>

              <h2 className="font-display text-4xl font-black tracking-tight sm:text-5xl">
                Laga bilaabo
                <span className="text-brand-green"> xaafadda</span>
                <br />
                ilaa tartamada waaweyn.
              </h2>

              <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-muted dark:text-dark-muted">
                E-GAROON wuxuu bilaabmayaa meel fudud — inuu dadka u
                fududeeyo inay ciyaaraan. Laakiin himiladu way ka weyn tahay
                hal booking.
              </p>
            </MotionSection>

            {/* Growth line */}
            <div className="relative mt-20">

              <div className="absolute start-[8%] end-[8%] top-8 hidden h-px bg-border lg:block dark:bg-dark-border" />

              <motion.div
                initial="hidden"
                whileInView="visible"
                viewport={{
                  once: true,
                  amount: 0.2,
                }}
                variants={stagger}
                className="grid gap-10 lg:grid-cols-4"
              >
                {[
                  {
                    icon: MapPin,
                    number: '01',
                    title: 'Xaafad',
                    text: 'Ciyaaro maxalli ah oo si fudud loo abaabulo.',
                  },
                  {
                    icon: Globe2,
                    number: '02',
                    title: 'Magaalo',
                    text: 'Kooxo iyo stadiums badan oo isku xiran.',
                  },
                  {
                    icon: Trophy,
                    number: '03',
                    title: 'League',
                    text: 'Tartamo, jadwal iyo kooxo si nidaamsan loo maamulo.',
                  },
                  {
                    icon: Zap,
                    number: '04',
                    title: 'Ecosystem',
                    text: 'Kaabayaal dhijitaal ah oo kubadda cagta kobciya.',
                  },
                ].map(({ icon: Icon, number, title, text }) => (
                  <motion.div
                    key={number}
                    variants={fadeUp}
                    className="relative text-center"
                  >
                    <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-warmwhite bg-brand-green text-white shadow-lg dark:border-dark-bg">
                      <Icon size={22} />
                    </div>

                    <span className="mt-5 block text-xs font-black tracking-[0.15em] text-brand-green">
                      {number}
                    </span>

                    <h3 className="mt-2 text-xl font-black">
                      {title}
                    </h3>

                    <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-muted dark:text-dark-muted">
                      {text}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* =========================================================
            FINAL CTA
        ========================================================== */}
        <section className="px-5 pb-20 sm:px-8 sm:pb-28">
          <MotionSection>
            <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-charcoal px-7 py-16 text-center text-white dark:bg-[#10151f] sm:px-12 sm:py-24">

              <div className="pointer-events-none absolute -start-32 -top-32 h-72 w-72 rounded-full bg-brand-green/20 blur-[90px]" />
              <div className="pointer-events-none absolute -end-32 -bottom-32 h-72 w-72 rounded-full bg-brand-blue/15 blur-[90px]" />

              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-green text-white shadow-xl shadow-brand-green/20">
                  <Trophy size={28} />
                </div>

                <h2 className="mx-auto mt-7 max-w-3xl font-display text-4xl font-black tracking-tight sm:text-6xl">
                  Ciyaartaada xigta
                  <br />
                  <span className="text-brand-green">
                    halkaan ayay ka bilaabataa.
                  </span>
                </h2>

                <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-white/55 sm:text-lg">
                  Hel garoonkaaga. Keen kooxdaada. Ciyaarta bilow.
                </p>

                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <motion.button
                    type="button"
                    onClick={goBooking}
                    whileHover={reduce ? undefined : { y: -3 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    className="group inline-flex items-center gap-3 rounded-full bg-brand-green px-7 py-4 text-sm font-extrabold text-white shadow-[0_18px_45px_-18px_rgba(16,185,129,0.95)] transition hover:bg-forest-dark"
                  >
                    Ballanso garoon

                    <ArrowRight
                      size={17}
                      className={`transition duration-300 group-hover:translate-x-1 ${arrow}`}
                    />
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={goContact}
                    whileHover={reduce ? undefined : { y: -3 }}
                    whileTap={reduce ? undefined : { scale: 0.98 }}
                    className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/5 px-7 py-4 text-sm font-extrabold text-white backdrop-blur transition hover:bg-white/10"
                  >
                    Nala soo xiriir

                    <ArrowUpRight size={17} />
                  </motion.button>
                </div>
              </div>
            </div>
          </MotionSection>
        </section>

      </main>
    </PageTransition>
  );
}