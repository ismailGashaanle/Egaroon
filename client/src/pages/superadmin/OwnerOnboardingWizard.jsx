import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiCopy,
  FiDownload,
  FiPlus,
  FiPrinter,
  FiTrash2,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardTitle } from '../../components/common/Card';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import MediaUpload from '../../components/common/MediaUpload';
import SomaliPhoneInput from '../../components/common/SomaliPhoneInput';
import SignaturePad from '../../components/common/SignaturePad';
import { FullPageSpinner } from '../../components/common/Spinner';
import { adminApi } from '../../api/adminApi';
import { FIELD_TYPES, capacityForType } from '../../lib/fieldFormats';
import { SO_CARRIERS, buildPhoneFromPrefix, digitsOnly, detectCarrier } from '../../lib/somaliPhone';
import { pickLocale } from '../../lib/siteContent';
import { toastApiError } from '../../lib/support';

const STEPS = [
  { id: 'owner', label: 'Owner' },
  { id: 'stadium', label: 'Stadium' },
  { id: 'fields', label: 'Fields' },
  { id: 'agreement', label: 'Agreement' },
  { id: 'signatures', label: 'Signatures' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'credentials', label: 'Credentials' },
];

function emptyField() {
  return {
    name: '',
    type: '7v7',
    pricingMode: 'per_player',
    pricePerPlayer: 1,
    fixedPrice: '',
    images: [],
    openingTime: '06:00',
    closingTime: '23:00',
    slotDurationMinutes: 60,
  };
}

function phonePartsFromNormalized(phone) {
  const carrier = detectCarrier(phone);
  const n = digitsOnly(phone);
  if (!carrier || !n.startsWith('252') || n.length < 12) {
    return { carrierId: 'hormuud', localNumber: '' };
  }
  // National: 9 digits after 252; carrier prefix is 3 digits starting with 0 in UI (061…)
  const national = n.slice(3); // 9 digits e.g. 615551234
  return {
    carrierId: carrier.id,
    localNumber: national.slice(2), // drop leading 61/63/65/90 → rest of number
  };
}

async function downloadBlobResponse(response, fallbackName) {
  const blob = response.data;
  const disposition = response.headers?.['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function printPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) {
    URL.revokeObjectURL(url);
    throw new Error('Popup blocked — allow popups to print');
  }
  const revoke = () => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  };
  win.addEventListener('load', () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* viewer may not support auto-print */
    }
  });
  setTimeout(revoke, 60_000);
}

export default function OwnerOnboardingWizard() {
  const { onboardingId } = useParams();
  const isNew = !onboardingId || onboardingId === 'new';
  const navigate = useNavigate();

  /** New onboardings start on agreement preview before the registration form. */
  const [phase, setPhase] = useState(isNew ? 'preview' : 'form');
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [onboarding, setOnboarding] = useState(null);
  const [credentials, setCredentials] = useState(null);

  const [owner, setOwner] = useState({
    name: '',
    email: '',
    avatarUrl: '',
  });
  const [carrierId, setCarrierId] = useState('hormuud');
  const [localNumber, setLocalNumber] = useState('');
  const [stadium, setStadium] = useState({
    name: '',
    description: '',
    city: '',
    region: '',
    area: '',
    address: '',
    lat: '',
    lng: '',
    images: [],
    facilities: '',
    openingTime: '06:00',
    closingTime: '23:00',
  });
  const [fields, setFields] = useState([emptyField()]);
  const [subscription, setSubscription] = useState({
    amountPerField: 7,
    currency: 'USD',
    monthsPaid: 1,
    collectionMethod: 'manual',
    notes: '',
  });
  const [saSig, setSaSig] = useState('');
  const [ownerSig, setOwnerSig] = useState('');
  const [policyLang, setPolicyLang] = useState('so');
  const [livePolicies, setLivePolicies] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(isNew);

  const status = onboarding?.status || 'draft';
  const phone = useMemo(
    () => buildPhoneFromPrefix(SO_CARRIERS.find((c) => c.id === carrierId)?.prefix || '061', localNumber),
    [carrierId, localNumber]
  );

  const setFieldCount = (raw) => {
    const n = Math.max(1, Math.min(40, Number(raw) || 1));
    setFields((prev) => {
      if (n === prev.length) return prev;
      if (n > prev.length) {
        return [...prev, ...Array.from({ length: n - prev.length }, () => emptyField())];
      }
      return prev.slice(0, n);
    });
  };

  const hydrate = (doc) => {
    setOnboarding(doc);
    setOwner({
      name: doc.owner?.name || '',
      email: doc.owner?.email || '',
      avatarUrl: doc.owner?.avatarUrl || '',
    });
    const parts = phonePartsFromNormalized(doc.owner?.phone);
    setCarrierId(parts.carrierId);
    setLocalNumber(parts.localNumber || (doc.owner?.phone ? digitsOnly(doc.owner.phone).slice(-7) : ''));
    setStadium({
      name: doc.stadium?.name || '',
      description: doc.stadium?.description || '',
      city: doc.stadium?.city || '',
      region: doc.stadium?.region || '',
      area: doc.stadium?.area || '',
      address: doc.stadium?.address || '',
      lat: doc.stadium?.latLng?.lat ?? '',
      lng: doc.stadium?.latLng?.lng ?? '',
      images: doc.stadium?.images || [],
      facilities: (doc.stadium?.facilities || []).join(', '),
      openingTime: doc.stadium?.openingTime || '06:00',
      closingTime: doc.stadium?.closingTime || '23:00',
    });
    setFields(
      doc.fields?.length
        ? doc.fields.map((f) => ({
            name: f.name,
            type: f.type,
            pricingMode: f.pricingMode || 'per_player',
            pricePerPlayer: f.pricePerPlayer ?? '',
            fixedPrice: f.fixedPrice ?? '',
            images: f.images || [],
            openingTime: f.openingTime || '06:00',
            closingTime: f.closingTime || '23:00',
            slotDurationMinutes: f.slotDurationMinutes || 60,
          }))
        : [emptyField()]
    );
    setSubscription({
      amountPerField: doc.subscription?.amountPerField ?? 7,
      currency: doc.subscription?.currency || 'USD',
      monthsPaid: doc.subscription?.monthsPaid || 1,
      collectionMethod: doc.subscription?.collectionMethod || 'manual',
      notes: doc.subscription?.notes || '',
    });
    setSaSig(doc.agreement?.superAdminSignatureUrl || '');
    setOwnerSig(doc.agreement?.ownerSignatureUrl || '');

    if (doc.status === 'active') setStep(6);
    else if (doc.status === 'subscription_pending') setStep(5);
    else if (doc.status === 'awaiting_signatures') setStep(4);
  };

  useEffect(() => {
    if (isNew) return;
    (async () => {
      try {
        const { data } = await adminApi.getOwnerOnboarding(onboardingId);
        hydrate(data.data.onboarding);
        setPhase('form');
      } catch (err) {
        toastApiError(err, 'Failed to load onboarding');
        navigate('/super-admin/owner-onboardings');
      } finally {
        setLoading(false);
      }
    })();
  }, [isNew, onboardingId]);

  useEffect(() => {
    if (phase !== 'preview' && step !== 3) return;
    (async () => {
      try {
        if (phase === 'preview') setPreviewLoading(true);
        const { data } = await adminApi.getSiteContent();
        setLivePolicies(data.data.content?.policies || null);
      } catch {
        /* optional preview */
      } finally {
        if (phase === 'preview') setPreviewLoading(false);
      }
    })();
  }, [phase, step]);

  const handleAgreementPdf = async ({ print = false, filled = false } = {}) => {
    setPdfBusy(true);
    try {
      const id = filled ? onboarding?.id : undefined;
      const res = await adminApi.downloadOwnerAgreementPdf({
        onboardingId: id,
        lang: policyLang,
      });
      if (print) {
        await printPdfBlob(res.data);
        toast.success('Opened print dialog');
      } else {
        await downloadBlobResponse(
          res,
          filled
            ? `egaroon-owner-agreement-${policyLang}.pdf`
            : `egaroon-owner-agreement-template-${policyLang}.pdf`
        );
        toast.success('PDF downloaded');
      }
    } catch (err) {
      if (err.message && !err.response) toast.error(err.message);
      else toastApiError(err, 'PDF failed');
    } finally {
      setPdfBusy(false);
    }
  };

  const buildPayload = (emailOverride) => ({
    owner: {
      name: owner.name.trim(),
      email: String(emailOverride ?? owner.email).trim().toLowerCase(),
      phone: phone || undefined,
      avatarUrl: owner.avatarUrl || undefined,
    },
    stadium: {
      name: stadium.name.trim(),
      description: stadium.description,
      city: stadium.city.trim(),
      region: stadium.region.trim(),
      area: stadium.area.trim(),
      address: stadium.address.trim(),
      lat: stadium.lat !== '' ? Number(stadium.lat) : undefined,
      lng: stadium.lng !== '' ? Number(stadium.lng) : undefined,
      images: stadium.images,
      facilities: stadium.facilities
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      openingTime: stadium.openingTime,
      closingTime: stadium.closingTime,
    },
    fields: fields.map((f) => ({
      name: f.name.trim() || undefined,
      type: f.type,
      pricingMode: f.pricingMode,
      pricePerPlayer: f.pricingMode === 'per_player' ? Number(f.pricePerPlayer) : undefined,
      fixedPrice: f.pricingMode === 'fixed' ? Number(f.fixedPrice) : undefined,
      images: f.images,
      openingTime: f.openingTime,
      closingTime: f.closingTime,
      slotDurationMinutes: Number(f.slotDurationMinutes) || 60,
    })),
    subscription,
  });

  const ensureDraft = async (emailOverride) => {
    const payload = buildPayload(emailOverride);
    if (isNew || !onboarding?.id) {
      const { data } = await adminApi.createOwnerOnboarding(payload);
      const doc = data.data.onboarding;
      setOnboarding(doc);
      navigate(`/super-admin/owner-onboardings/${doc.id}`, { replace: true });
      return doc;
    }
    const { data } = await adminApi.updateOwnerOnboarding(onboarding.id, payload);
    const doc = data.data.onboarding;
    setOnboarding(doc);
    return doc;
  };

  const saveStep = async () => {
    setSaving(true);
    try {
      if (!owner.name.trim()) throw new Error('Owner name is required');
      if (step === 0 && !phone) throw new Error('Valid Somali phone is required');
      if (step >= 1 && !stadium.name.trim()) throw new Error('Stadium name is required');
      if (step >= 1 && !stadium.city.trim()) throw new Error('City is required');
      if (step >= 2 && (!fields.length || fields.some((f) => !f.type))) {
        throw new Error('Add at least one valid field');
      }

      let emailOverride;
      if (
        (status === 'draft' || status === 'awaiting_signatures' || isNew) &&
        !owner.email.trim() &&
        owner.name.trim()
      ) {
        const { data } = await adminApi.suggestOwnerEmail({ name: owner.name, phone });
        emailOverride = data.data.email;
        setOwner((o) => ({ ...o, email: emailOverride }));
      }

      let doc = onboarding;
      if (status === 'draft' || status === 'awaiting_signatures' || isNew) {
        doc = await ensureDraft(emailOverride);
      } else if (status === 'subscription_pending') {
        const { data } = await adminApi.updateOwnerOnboarding(onboarding.id, { subscription });
        doc = data.data.onboarding;
        setOnboarding(doc);
      }
      toast.success('Saved');
      return doc;
    } catch (err) {
      if (err.message && !err.response) toast.error(err.message);
      else toastApiError(err, 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    const doc = await saveStep();
    if (!doc && step < 3) return;
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  };

  const submitAgreement = async () => {
    setSaving(true);
    try {
      const doc = await ensureDraft();
      const { data } = await adminApi.submitOwnerOnboardingAgreement(doc.id);
      hydrate(data.data.onboarding);
      toast.success('Agreement frozen — collect signatures');
      setStep(4);
    } catch (err) {
      toastApiError(err, 'Could not submit agreement');
    } finally {
      setSaving(false);
    }
  };

  const saveSignatures = async () => {
    if (!saSig || !ownerSig) {
      toast.error('Both Super Admin and Owner signatures are required');
      return;
    }
    setSaving(true);
    try {
      const id = onboarding?.id;
      const { data } = await adminApi.signOwnerOnboarding(id, {
        superAdminSignatureUrl: saSig,
        ownerSignatureUrl: ownerSig,
      });
      hydrate(data.data.onboarding);
      toast.success('Signatures saved');
      setStep(5);
    } catch (err) {
      toastApiError(err, 'Could not save signatures');
    } finally {
      setSaving(false);
    }
  };

  const activate = async () => {
    setSaving(true);
    try {
      const { data } = await adminApi.activateOwnerOnboarding(onboarding.id, { subscription });
      const result = data.data;
      hydrate(result.onboarding);
      if (result.temporaryPassword) {
        setCredentials({
          email: result.owner?.email || result.onboarding?.owner?.email,
          temporaryPassword: result.temporaryPassword,
        });
        toast.success('Owner provisioned — copy the password now (shown once)');
      } else {
        toast(
          result.credentialsAlreadyRevealed
            ? 'Already activated. Password was shown once — use reset if needed.'
            : 'Already active'
        );
      }
      setStep(6);
    } catch (err) {
      toastApiError(err, 'Activation failed');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (!onboarding?.id || status === 'active') return;
    if (!window.confirm('Cancel this onboarding?')) return;
    try {
      const { data } = await adminApi.cancelOwnerOnboarding(onboarding.id, {
        reason: 'Cancelled by Super Admin',
      });
      hydrate(data.data.onboarding);
      toast.success('Cancelled');
    } catch (err) {
      toastApiError(err, 'Cancel failed');
    }
  };

  const suggestEmail = async () => {
    try {
      const { data } = await adminApi.suggestOwnerEmail({ name: owner.name, phone });
      setOwner((o) => ({ ...o, email: data.data.email }));
      toast.success('Email suggested');
    } catch (err) {
      toastApiError(err, 'Could not suggest email');
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  };

  const estimatedTotal = useMemo(() => {
    const amt = Number(subscription.amountPerField) || 0;
    const months = Number(subscription.monthsPaid) || 1;
    return Math.round(amt * fields.length * months * 100) / 100;
  }, [subscription, fields.length]);

  const agreementBody = pickLocale(
    livePolicies?.ownerAgreement,
    policyLang,
    '(Edit under Super Admin → Site Content → Policies → Owner agreement)'
  );
  const termsPreview = pickLocale(livePolicies?.terms, policyLang, '');
  const privacyPreview = pickLocale(livePolicies?.privacy, policyLang, '');

  if (loading) return <FullPageSpinner />;

  if (phase === 'preview') {
    return (
      <PageTransition>
        <PageHeader
          title="Owner agreement preview"
          description="Read what the stadium owner will agree to, download or print the soft A4 PDF, then continue to register."
          actions={
            <Link to="/super-admin/owner-onboardings">
              <Button variant="secondary" icon={<FiArrowLeft />}>
                Back to list
              </Button>
            </Link>
          }
        />

        <Card className="mx-auto max-w-3xl space-y-5 p-6 sm:p-8">
          <div className="rounded-sm border border-charcoal/15 bg-[#FFFEFA] px-5 py-6 shadow-sm dark:border-white/10 dark:bg-charcoal/40 sm:px-8 sm:py-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-forest/20 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-forest">E-Garoon</p>
                <h2 className="font-display text-xl text-charcoal dark:text-dark-text sm:text-2xl">
                  {policyLang === 'so' ? 'Heshiiska Mulkiilaha Garoonka' : 'Stadium Owner Agreement'}
                </h2>
                <p className="mt-1 text-xs text-muted dark:text-dark-muted">
                  Soft A4 contract preview · template
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={policyLang === 'so' ? 'primary' : 'secondary'}
                  onClick={() => setPolicyLang('so')}
                >
                  Soomaali
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={policyLang === 'en' ? 'primary' : 'secondary'}
                  onClick={() => setPolicyLang('en')}
                >
                  English
                </Button>
              </div>
            </div>

            {previewLoading ? (
              <p className="text-sm text-muted dark:text-dark-muted">Loading agreement…</p>
            ) : (
              <>
                <pre className="max-h-[min(52vh,420px)] overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-charcoal dark:text-dark-text">
                  {agreementBody}
                </pre>

                <div className="mt-6 space-y-3 border-t border-charcoal/10 pt-4 dark:border-white/10">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-dark-muted">
                    Related policies
                  </p>
                  <details className="rounded-lg border border-charcoal/10 p-3 dark:border-white/10">
                    <summary className="cursor-pointer text-sm font-semibold text-charcoal dark:text-dark-text">
                      Terms of service
                    </summary>
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-muted dark:text-dark-muted">
                      {termsPreview || '(Not set in Site Content)'}
                    </pre>
                  </details>
                  <details className="rounded-lg border border-charcoal/10 p-3 dark:border-white/10">
                    <summary className="cursor-pointer text-sm font-semibold text-charcoal dark:text-dark-text">
                      Privacy policy
                    </summary>
                    <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs text-muted dark:text-dark-muted">
                      {privacyPreview || '(Not set in Site Content)'}
                    </pre>
                  </details>
                  <Link
                    to="/super-admin/site-content"
                    className="inline-block text-sm font-semibold text-forest dark:text-dark-primary"
                  >
                    Edit policies in Site Content →
                  </Link>
                </div>

                <div className="mt-8 grid gap-4 border-t border-dashed border-charcoal/20 pt-6 sm:grid-cols-2 dark:border-white/15">
                  <div className="rounded-lg border border-charcoal/10 p-3 dark:border-white/10">
                    <p className="text-xs font-semibold text-forest">Super Admin</p>
                    <p className="mt-6 border-b border-charcoal/30 text-xs text-muted dark:border-white/20">
                      Signature · name · date
                    </p>
                  </div>
                  <div className="rounded-lg border border-charcoal/10 p-3 dark:border-white/10">
                    <p className="text-xs font-semibold text-forest">Stadium Owner</p>
                    <p className="mt-6 border-b border-charcoal/30 text-xs text-muted dark:border-white/20">
                      Signature · name · date
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              icon={<FiDownload />}
              loading={pdfBusy}
              onClick={() => handleAgreementPdf({ print: false, filled: false })}
            >
              Download PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<FiPrinter />}
              loading={pdfBusy}
              onClick={() => handleAgreementPdf({ print: true, filled: false })}
            >
              Print
            </Button>
            <Button
              type="button"
              icon={<FiArrowRight />}
              onClick={() => {
                setPhase('form');
                setStep(0);
              }}
            >
              Continue to register
            </Button>
          </div>
        </Card>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title={isNew ? 'New owner onboarding' : onboarding?.owner?.name || 'Owner onboarding'}
        description="Wizard: owner → stadium → fields → agreement → signatures → subscription → credentials."
        actions={
          <div className="flex flex-wrap gap-2">
            {isNew && !onboarding?.id && (
              <Button type="button" variant="secondary" onClick={() => setPhase('preview')}>
                Back to agreement
              </Button>
            )}
            <Link to="/super-admin/owner-onboardings">
              <Button variant="secondary" icon={<FiArrowLeft />}>
                Back to list
              </Button>
            </Link>
            {onboarding?.id && status !== 'active' && status !== 'cancelled' && (
              <Button variant="danger" onClick={cancel}>
                Cancel
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant="forest">{status}</Badge>
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              i === step
                ? 'bg-forest text-white'
                : 'bg-charcoal/5 text-muted dark:bg-white/10 dark:text-dark-muted'
            }`}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <Card className="space-y-4 p-6">
          <CardTitle>Owner details</CardTitle>
          <Input
            label="Full name"
            required
            value={owner.name}
            onChange={(e) => setOwner({ ...owner, name: e.target.value })}
          />
          <SomaliPhoneInput
            label="Phone"
            required
            carrierId={carrierId}
            onCarrierChange={setCarrierId}
            localNumber={localNumber}
            onLocalNumberChange={setLocalNumber}
          />
          <div className="flex flex-wrap items-end gap-2">
            <Input
              label="Email"
              type="email"
              className="min-w-[240px] flex-1"
              value={owner.email}
              onChange={(e) => setOwner({ ...owner, email: e.target.value })}
              hint="Leave blank to auto-generate @owners.kulansiiye.com"
            />
            <Button type="button" variant="secondary" onClick={suggestEmail}>
              Generate email
            </Button>
          </div>
          <MediaUpload
            folder="avatars"
            accept="image/*"
            label="Profile image"
            value={owner.avatarUrl}
            onChange={(url) => setOwner({ ...owner, avatarUrl: url })}
          />
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4 p-6">
          <CardTitle>Stadium</CardTitle>
          <Input
            label="Stadium name"
            required
            value={stadium.name}
            onChange={(e) => setStadium({ ...stadium, name: e.target.value })}
          />
          <Textarea
            label="Description"
            rows={2}
            value={stadium.description}
            onChange={(e) => setStadium({ ...stadium, description: e.target.value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="City"
              required
              value={stadium.city}
              onChange={(e) => setStadium({ ...stadium, city: e.target.value })}
            />
            <Input
              label="Region"
              value={stadium.region}
              onChange={(e) => setStadium({ ...stadium, region: e.target.value })}
            />
            <Input
              label="Area"
              value={stadium.area}
              onChange={(e) => setStadium({ ...stadium, area: e.target.value })}
            />
            <Input
              label="Address"
              value={stadium.address}
              onChange={(e) => setStadium({ ...stadium, address: e.target.value })}
            />
            <Input
              label="Latitude"
              type="number"
              step="any"
              value={stadium.lat}
              onChange={(e) => setStadium({ ...stadium, lat: e.target.value })}
            />
            <Input
              label="Longitude"
              type="number"
              step="any"
              value={stadium.lng}
              onChange={(e) => setStadium({ ...stadium, lng: e.target.value })}
            />
            <Input
              label="Opening"
              value={stadium.openingTime}
              onChange={(e) => setStadium({ ...stadium, openingTime: e.target.value })}
            />
            <Input
              label="Closing"
              value={stadium.closingTime}
              onChange={(e) => setStadium({ ...stadium, closingTime: e.target.value })}
            />
          </div>
          <Input
            label="Facilities (comma-separated)"
            value={stadium.facilities}
            onChange={(e) => setStadium({ ...stadium, facilities: e.target.value })}
          />
          <MediaUpload
            folder="stadiums"
            multiple
            maxFiles={12}
            accept="image/*,video/*"
            label="Stadium images"
            value={stadium.images}
            onChange={(images) => setStadium({ ...stadium, images })}
          />
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <Card className="space-y-3 p-6">
            <CardTitle>Number of fields</CardTitle>
            <p className="text-sm text-muted dark:text-dark-muted">
              Set how many pitches this stadium will register. This count drives subscription fees and
              appears on the agreement PDF.
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <Input
                label="Number of fields"
                type="number"
                min={1}
                max={40}
                className="w-40"
                value={fields.length}
                onChange={(e) => setFieldCount(e.target.value)}
              />
              <Badge variant="forest">
                {fields.length} field{fields.length === 1 ? '' : 's'}
              </Badge>
            </div>
          </Card>

          {fields.map((f, idx) => (
            <Card key={idx} className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <CardTitle>
                  Field {idx + 1} of {fields.length}
                </CardTitle>
                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    icon={<FiTrash2 />}
                    onClick={() => setFields(fields.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Name"
                  value={f.name}
                  placeholder={`Pitch ${idx + 1}`}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = { ...f, name: e.target.value };
                    setFields(next);
                  }}
                />
                <Select
                  label="Format"
                  value={f.type}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = { ...f, type: e.target.value };
                    setFields(next);
                  }}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t} ({capacityForType(t)} per side)
                    </option>
                  ))}
                </Select>
                <Select
                  label="Pricing"
                  value={f.pricingMode}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = { ...f, pricingMode: e.target.value };
                    setFields(next);
                  }}
                >
                  <option value="per_player">Per player</option>
                  <option value="fixed">Fixed slot</option>
                </Select>
                {f.pricingMode === 'per_player' ? (
                  <Input
                    label="Price per player (USD)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={f.pricePerPlayer}
                    onChange={(e) => {
                      const next = [...fields];
                      next[idx] = { ...f, pricePerPlayer: e.target.value };
                      setFields(next);
                    }}
                  />
                ) : (
                  <Input
                    label="Fixed price (USD)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={f.fixedPrice}
                    onChange={(e) => {
                      const next = [...fields];
                      next[idx] = { ...f, fixedPrice: e.target.value };
                      setFields(next);
                    }}
                  />
                )}
              </div>
              <MediaUpload
                folder="fields"
                accept="image/*"
                multiple
                maxFiles={6}
                label="Field images"
                value={f.images}
                onChange={(images) => {
                  const next = [...fields];
                  next[idx] = { ...f, images };
                  setFields(next);
                }}
              />
            </Card>
          ))}
          <Button
            type="button"
            variant="secondary"
            icon={<FiPlus />}
            onClick={() => setFields([...fields, emptyField()])}
          >
            Add field
          </Button>
          <p className="text-sm text-muted dark:text-dark-muted">
            Subscription uses platform field fee × {fields.length} field(s). Configure amount on the
            Subscription step (defaults from Platform Settings).
          </p>
        </div>
      )}

      {step === 3 && (
        <Card className="space-y-4 p-6">
          <CardTitle>Agreement review</CardTitle>
          <div className="rounded-xl border border-forest/25 bg-forest/5 p-4 text-sm dark:bg-forest/10">
            <p className="font-semibold text-charcoal dark:text-dark-text">Registration summary</p>
            <ul className="mt-2 space-y-1 text-muted dark:text-dark-muted">
              <li>Owner: {owner.name || '—'}</li>
              <li>
                Stadium: {stadium.name || '—'} ({stadium.city || '—'})
              </li>
              <li>
                Number of fields:{' '}
                <strong className="text-charcoal dark:text-dark-text">{fields.length}</strong>
                {fields.length
                  ? ` — ${fields.map((f, i) => f.name || `Field ${i + 1}`).join(', ')}`
                  : ''}
              </li>
            </ul>
          </div>
          <p className="text-sm text-muted dark:text-dark-muted">
            Content is loaded from Site Content → Policies (So/En). Submitting freezes a snapshot
            onto this onboarding. Download the filled A4 PDF after saving draft data.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={policyLang === 'so' ? 'primary' : 'secondary'}
              onClick={() => setPolicyLang('so')}
            >
              Soomaali
            </Button>
            <Button
              type="button"
              size="sm"
              variant={policyLang === 'en' ? 'primary' : 'secondary'}
              onClick={() => setPolicyLang('en')}
            >
              English
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<FiDownload />}
              loading={pdfBusy}
              disabled={!onboarding?.id}
              onClick={() => handleAgreementPdf({ print: false, filled: true })}
            >
              Download filled PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<FiPrinter />}
              loading={pdfBusy}
              disabled={!onboarding?.id}
              onClick={() => handleAgreementPdf({ print: true, filled: true })}
            >
              Print filled PDF
            </Button>
          </div>
          {['ownerAgreement', 'terms', 'privacy'].map((key) => {
            const snapKey =
              key === 'ownerAgreement'
                ? 'ownerAgreementSnapshot'
                : key === 'terms'
                  ? 'termsSnapshot'
                  : 'privacySnapshot';
            const snap = onboarding?.agreement?.[snapKey];
            const live = livePolicies?.[key];
            const title =
              key === 'ownerAgreement' ? 'Owner agreement' : key === 'terms' ? 'Terms' : 'Privacy';
            const body = pickLocale(
              snap?.so || snap?.en ? snap : live,
              policyLang,
              '(Edit under Super Admin → Site Content → Policies, then freeze agreement)'
            );
            return (
              <div key={key} className="rounded-xl border border-charcoal/10 p-4 dark:border-white/10">
                <h3 className="font-semibold text-charcoal dark:text-dark-text">{title}</h3>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-sm text-muted dark:text-dark-muted">
                  {body}
                </pre>
              </div>
            );
          })}
          {(status === 'draft' || status === 'awaiting_signatures') && (
            <Button onClick={submitAgreement} loading={saving} icon={<FiCheck />}>
              Freeze agreement & continue to signatures
            </Button>
          )}
          <Link
            to="/super-admin/site-content"
            className="text-sm font-semibold text-forest dark:text-dark-primary"
          >
            Edit policies in Site Content →
          </Link>
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-6 p-6">
          <CardTitle>Dual signatures</CardTitle>
          <p className="text-sm text-muted dark:text-dark-muted">
            Super Admin and Stadium Owner must both sign. Signatures upload to Cloudinary. Re-download
            the filled PDF afterward to include signature images.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<FiDownload />}
              loading={pdfBusy}
              disabled={!onboarding?.id}
              onClick={() => handleAgreementPdf({ print: false, filled: true })}
            >
              Download agreement PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<FiPrinter />}
              loading={pdfBusy}
              disabled={!onboarding?.id}
              onClick={() => handleAgreementPdf({ print: true, filled: true })}
            >
              Print
            </Button>
          </div>
          <SignaturePad
            label="Super Admin signature"
            value={saSig}
            onChange={setSaSig}
            disabled={status === 'active' || status === 'cancelled'}
          />
          <SignaturePad
            label="Stadium Owner signature"
            value={ownerSig}
            onChange={setOwnerSig}
            disabled={status === 'active' || status === 'cancelled'}
          />
          {status !== 'active' && status !== 'cancelled' && (
            <Button onClick={saveSignatures} loading={saving}>
              Save signatures
            </Button>
          )}
        </Card>
      )}

      {step === 5 && (
        <Card className="space-y-4 p-6">
          <CardTitle>Subscription confirm</CardTitle>
          <p className="text-sm text-muted dark:text-dark-muted">
            Manual collection for MVP. Confirming marks field subscription periods paid (or waived)
            and provisions the owner account.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Amount per field / month"
              type="number"
              min="0"
              step="0.01"
              value={subscription.amountPerField}
              onChange={(e) =>
                setSubscription({ ...subscription, amountPerField: e.target.value })
              }
            />
            <Input
              label="Months paid"
              type="number"
              min="1"
              max="12"
              value={subscription.monthsPaid}
              onChange={(e) => setSubscription({ ...subscription, monthsPaid: e.target.value })}
            />
            <Select
              label="Collection method"
              value={subscription.collectionMethod}
              onChange={(e) =>
                setSubscription({ ...subscription, collectionMethod: e.target.value })
              }
            >
              <option value="manual">Manual</option>
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="waived">Waived</option>
              <option value="other">Other</option>
            </Select>
            <Input
              label="Currency"
              value={subscription.currency}
              onChange={(e) => setSubscription({ ...subscription, currency: e.target.value })}
            />
          </div>
          <Textarea
            label="Notes"
            rows={2}
            value={subscription.notes}
            onChange={(e) => setSubscription({ ...subscription, notes: e.target.value })}
          />
          <p className="text-sm font-semibold text-charcoal dark:text-dark-text">
            Estimated total: {estimatedTotal} {subscription.currency} ({fields.length} fields ×{' '}
            {subscription.monthsPaid} mo)
          </p>
          {status === 'subscription_pending' && (
            <Button onClick={activate} loading={saving} icon={<FiCheck />}>
              Confirm subscription & provision owner
            </Button>
          )}
          {status !== 'subscription_pending' && status !== 'active' && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Complete dual signatures first (status must be subscription_pending).
            </p>
          )}
        </Card>
      )}

      {step === 6 && (
        <Card className="space-y-4 p-6">
          <CardTitle>Credentials</CardTitle>
          {credentials?.temporaryPassword ? (
            <>
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Temporary password is shown once. Copy it now and share securely with the owner.
                They must change it on first login.
              </p>
              <div className="rounded-xl bg-charcoal/5 p-4 font-mono text-sm dark:bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  <span>Email: {credentials.email}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<FiCopy />}
                    onClick={() => copyText(credentials.email)}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span>Password: {credentials.temporaryPassword}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<FiCopy />}
                    onClick={() => copyText(credentials.temporaryPassword)}
                  />
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<FiDownload />}
                loading={pdfBusy}
                onClick={() => handleAgreementPdf({ print: false, filled: true })}
              >
                Download signed agreement PDF
              </Button>
            </>
          ) : status === 'active' ? (
            <div className="space-y-2 text-sm">
              <p>
                Owner email: <strong>{onboarding?.owner?.email}</strong>
              </p>
              <p className="text-muted dark:text-dark-muted">
                {onboarding?.credentialsHint ||
                  'Temporary password was already revealed once. Use Forgot password if the owner lost it.'}
              </p>
              {onboarding?.provisioned?.stadiumId && (
                <p>
                  Stadium ID:{' '}
                  <code className="text-xs">{onboarding.provisioned.stadiumId}</code>
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<FiDownload />}
                loading={pdfBusy}
                onClick={() => handleAgreementPdf({ print: false, filled: true })}
              >
                Download signed agreement PDF
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted dark:text-dark-muted">
              Credentials appear here after subscription confirm.
            </p>
          )}
        </Card>
      )}

      <div className="mt-6 flex justify-between">
        <Button
          type="button"
          variant="secondary"
          disabled={step === 0}
          icon={<FiArrowLeft />}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Back
        </Button>
        {step < 3 && (
          <Button type="button" loading={saving} icon={<FiArrowRight />} onClick={next}>
            Save & continue
          </Button>
        )}
        {step === 3 && status !== 'draft' && (
          <Button type="button" onClick={() => setStep(4)}>
            Continue
          </Button>
        )}
      </div>
    </PageTransition>
  );
}
