import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  FiFileText,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiShield,
  FiCalendar,
  FiDollarSign,
  FiClock,
  FiAlertTriangle,
  FiCloudRain,
  FiUsers,
  FiEye,
  FiSave,
  FiSend,
  FiSliders,
  FiInfo,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardHeader, CardTitle, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Spinner from '../../components/common/Spinner';
import { ownerApi } from '../../api/ownerApi';
import { stadiumApi } from '../../api/stadiumApi';
import { toastApiError } from '../../lib/support';
import { useTranslation } from '../../i18n/LanguageContext';
import clsx from 'clsx';

// ── Tab definitions ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'booking', label: '01 Booking & Jadwalka', icon: FiCalendar },
  { id: 'pricing', label: '02 Qiimaha & Lacagaha', icon: FiDollarSign },
  { id: 'cancellation', label: '03 Kansalaashada & Celin', icon: FiXCircle },
  { id: 'reschedule', label: '04 Beddelka Waqtiga', icon: FiClock },
  { id: 'late_noshow', label: '05 Daahitaanka & No-Show', icon: FiAlertTriangle },
  { id: 'owner_cancel', label: '06 Kansal Garoonka', icon: FiShield },
  { id: 'weather', label: '07 Cimilo & Degdeg', icon: FiCloudRain },
  { id: 'conduct', label: '08 Dhaawac & Anshaxa', icon: FiAlertTriangle },
  { id: 'roster', label: '09 Kooxda & Ciyaartoyda', icon: FiUsers },
  { id: 'overtime', label: '10 Waqti Dheeraad', icon: FiSliders },
  { id: 'disputes', label: '11 Muranka & Cabashada', icon: FiInfo },
  { id: 'history', label: '12 Heshiisyada & Versions', icon: FiFileText },
];

export default function OwnerAgreements() {
  const { t } = useTranslation();
  const [stadiums, setStadiums] = useState([]);
  const [selectedStadiumId, setSelectedStadiumId] = useState('');
  const [agreements, setAgreements] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState('booking');
  const [previewOpen, setPreviewOpen] = useState(false);

  // Revenue agreement actions
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [accepting, setAccepting] = useState(false);

  // Load stadiums and initial agreements
  const loadStadiumsAndAgreements = useCallback(async () => {
    setLoading(true);
    try {
      const [stRes, agRes] = await Promise.all([
        stadiumApi.list({ mine: 'true' }),
        ownerApi.listAgreements(),
      ]);
      const stList = stRes?.data?.data?.stadiums || [];
      setStadiums(stList);
      setAgreements(agRes?.data?.data?.agreements || []);
      if (stList.length > 0 && !selectedStadiumId) {
        setSelectedStadiumId(stList[0]._id);
      }
    } catch (err) {
      toastApiError(err, 'Waa lagu fashilmay soo raridda xogta garoomada');
    } finally {
      setLoading(false);
    }
  }, [selectedStadiumId]);

  useEffect(() => {
    loadStadiumsAndAgreements();
  }, [loadStadiumsAndAgreements]);

  // Load policy whenever selected stadium changes
  const loadPolicy = useCallback(async (stadiumId) => {
    if (!stadiumId) return;
    try {
      const { data } = await ownerApi.getStadiumPolicy(stadiumId);
      const raw = data.data?.policy || {};
      // If there is an unsaved draft, prefill form with draft
      const active = raw.draftPolicy ? { ...raw, ...raw.draftPolicy } : raw;
      setPolicy(active);
    } catch (err) {
      toastApiError(err, 'Waa lagu fashilmay soo raridda xeerarka garoonka');
    }
  }, []);

  useEffect(() => {
    if (selectedStadiumId) {
      loadPolicy(selectedStadiumId);
    }
  }, [selectedStadiumId, loadPolicy]);

  // Field change handler
  const updateField = (field, value) => {
    setPolicy((prev) => ({
      ...prev,
      [field]: value,
      policyStatus: 'DRAFT', // mark as draft upon edit
    }));
  };

  // Update a refund tier
  const updateTierRefund = (index, percent) => {
    setPolicy((prev) => {
      const tiers = [...(prev.cancelRefundTiers || [])];
      tiers[index] = {
        ...tiers[index],
        refundPercent: Math.max(0, Math.min(100, Number(percent) || 0)),
      };
      return { ...prev, cancelRefundTiers: tiers, policyStatus: 'DRAFT' };
    });
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (!selectedStadiumId) return;
    setSavingDraft(true);
    try {
      await ownerApi.saveDraftPolicy(selectedStadiumId, policy);
      toast.success('Xeerarka qabyada ah waa la kaydiyay (Draft Saved)!');
      loadPolicy(selectedStadiumId);
    } catch (err) {
      toastApiError(err, 'Waa lagu fashilmay kaydinta qabyada');
    } finally {
      setSavingDraft(false);
    }
  };

  // Publish Policy
  const handlePublish = async () => {
    if (!selectedStadiumId) return;
    setPublishing(true);
    try {
      const res = await ownerApi.publishPolicy(selectedStadiumId, policy);
      toast.success(
        `Xeerka cusub ee nooca v${res.data?.data?.policy?.policyVersion || ''} si toos ah ayaa loo daabacay!`
      );
      loadPolicy(selectedStadiumId);
    } catch (err) {
      toastApiError(err, 'Waa lagu fashilmay daabacaadda xeerka');
    } finally {
      setPublishing(false);
    }
  };

  // Accept agreement
  const handleAcceptAgreement = async () => {
    if (!acceptTarget) return;
    setAccepting(true);
    try {
      await ownerApi.acceptAgreement(acceptTarget.id || acceptTarget._id);
      toast.success('Heshiiska dakhliga waa la aqbalay (Agreement accepted)!');
      setAcceptTarget(null);
      loadStadiumsAndAgreements();
    } catch (err) {
      toastApiError(err, 'Failed to accept agreement');
    } finally {
      setAccepting(false);
    }
  };

  // Reject agreement
  const handleRejectAgreement = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await ownerApi.rejectAgreement(rejectTarget.id || rejectTarget._id, { reason: rejectReason });
      toast.success('Heshiiska waa la diiday');
      setRejectTarget(null);
      setRejectReason('');
      loadStadiumsAndAgreements();
    } catch (err) {
      toastApiError(err, 'Failed to reject agreement');
    } finally {
      setRejecting(false);
    }
  };

  const currentStadium = stadiums.find((s) => s._id === selectedStadiumId);
  const stadiumAgreements = agreements.filter(
    (a) => String(a.stadium?._id || a.stadium) === String(selectedStadiumId)
  );

  return (
    <PageTransition className="max-w-6xl space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Stadium Booking Rules & Agreements Manager"
        description="Deji xeerarka garoonka, lacagaha, cancellations, refunds, ganaaxyada la oggol yahay, dib-u-dhacyada, iyo heshiisyada E-Garoon."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<FiEye />}
              onClick={() => setPreviewOpen(true)}
              disabled={!policy}
            >
              Preview Captain Terms
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<FiSave />}
              loading={savingDraft}
              onClick={handleSaveDraft}
              disabled={!policy}
            >
              Save Draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<FiSend />}
              loading={publishing}
              onClick={handlePublish}
              disabled={!policy}
            >
              Publish Policy
            </Button>
          </div>
        }
      />

      {/* Stadium Switcher & Top Status Bar */}
      <Card className="p-4 bg-gradient-to-r from-warmwhite via-white to-white dark:from-dark-surface dark:via-dark-surface dark:to-dark-surface">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase text-muted">Dooro Garoonka:</label>
            <select
              value={selectedStadiumId}
              onChange={(e) => setSelectedStadiumId(e.target.value)}
              className="rounded-xl border border-border bg-white px-3 py-1.5 text-sm font-semibold text-charcoal shadow-sm transition-colors focus:border-brand-green focus:outline-none dark:border-dark-border dark:bg-dark-surface dark:text-dark-text"
            >
              {stadiums.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.city || 'Somaliland'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="text-muted">Xaaladda Xeerka:</span>
              <Badge variant={policy?.policyStatus === 'PUBLISHED' ? 'success' : 'warning'} dot>
                {policy?.policyStatus === 'PUBLISHED'
                  ? `PUBLISHED v${policy?.policyVersion || 1}`
                  : 'DRAFT (Qabyo)'}
              </Badge>
            </span>
            <span className="flex items-center gap-1.5 text-brand-green font-medium">
              <FiShield className="shrink-0" />
              <span>Super Admin Guardrails Active</span>
            </span>
          </div>
        </div>
      </Card>

      {/* Main Content Area: Tabs + Panels */}
      {loading || !policy ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Sidebar Tabs */}
          <div className="space-y-1 lg:col-span-1 rounded-2xl border border-border bg-white p-2 shadow-soft dark:border-dark-border dark:bg-dark-surface">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={clsx(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all',
                    isActive
                      ? 'bg-brand-green text-white font-semibold shadow-sm'
                      : 'text-charcoal hover:bg-black/5 dark:text-dark-text dark:hover:bg-white/5'
                  )}
                >
                  <Icon className={clsx('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-muted')} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tab Panel Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* 01 Booking & Availability */}
            {activeTab === 'booking' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiCalendar className="text-brand-green" />
                    <span>01. Siyaasadaha Booking-ka & Jadwalka Garoonka</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Maamul muddada ciyaarta, buffers-ka u dhexeeya kooxaha, iyo shuruudaha qabsashada.
                  </p>
                </CardHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted">Muddada Ciyaarta (Daqiiqo)</label>
                    <select
                      value={policy.slotDurationMinutes || 60}
                      onChange={(e) => updateField('slotDurationMinutes', Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-border p-2.5 text-sm dark:border-dark-border dark:bg-dark-surface"
                    >
                      <option value={30}>30 daqiiqo</option>
                      <option value={60}>60 daqiiqo (Caadi)</option>
                      <option value={90}>90 daqiiqo</option>
                      <option value={120}>120 daqiiqo (2 saac)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted">Wakhtiga Ugu Yar Ee Hore Loo Ballansado</label>
                    <Input
                      type="number"
                      value={policy.minBookingNoticeMinutes || 30}
                      onChange={(e) => updateField('minBookingNoticeMinutes', Number(e.target.value))}
                      className="mt-1"
                      hint="Daqiiqo ka hor ciyaarta (Tusaale: 30 daqiiqo)"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted">Wakhtiga Ugu Fog Ee La Sii Qabsan Karo</label>
                    <Input
                      type="number"
                      value={policy.maxBookingAdvanceDays || 30}
                      onChange={(e) => updateField('maxBookingAdvanceDays', Number(e.target.value))}
                      className="mt-1"
                      hint="Maalmood ka hor (Tusaale: 30 maalmood)"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted">Slot Buffer (Wakhtiga U Dhexeeya Kooxaha)</label>
                    <select
                      value={policy.slotBufferMinutes || 0}
                      onChange={(e) => updateField('slotBufferMinutes', Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-border p-2.5 text-sm dark:border-dark-border dark:bg-dark-surface"
                    >
                      <option value={0}>0 daqiiqo (Toos)</option>
                      <option value={5}>5 daqiiqo buffer</option>
                      <option value={10}>10 daqiiqo buffer</option>
                      <option value={15}>15 daqiiqo buffer</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 space-y-3 dark:border-dark-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Toos u Xaqiiji (Auto-Confirm Booking)</p>
                      <p className="text-xs text-muted">
                        Ballanku si toos ah ayuu u xaqiijismayaa marka kabtanku bixiyo lacagta.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={policy.autoConfirm !== false}
                      onChange={(e) => updateField('autoConfirm', e.target.checked)}
                      className="h-5 w-5 rounded text-brand-green focus:ring-brand-green"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Oggolaansho Gacan Ah (Manual Owner Approval)</p>
                      <p className="text-xs text-muted">
                        Mulkiiluhu waa inuu gacanta ku aqbalo ka hor inta aan ballanku noqon mid rasmi ah.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(policy.manualApproval)}
                      onChange={(e) => updateField('manualApproval', e.target.checked)}
                      className="h-5 w-5 rounded text-brand-green focus:ring-brand-green"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* 02 Pricing & Fees */}
            {activeTab === 'pricing' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiDollarSign className="text-brand-green" />
                    <span>02. Siyaasadaha Lacagaha & Kharashka</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Xeerarka qiimaha adeegga, overtime-ka, iyo deebaajiga la oggol yahay.
                  </p>
                </CardHeader>

                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-blue-900 dark:text-blue-200">
                  ℹ️ <strong>Xusuusin Super Admin:</strong> Kirada garoonka waxaa maamula adiga, halka platform commission-ka (4%) iyo booking fee-ga (1,000 SlSh) lagu maamulo heshiiska heshiiska guud ee E-Garoon.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted">Lacagta Heshiiska (Currency)</label>
                    <select
                      value={policy.currency || 'USD'}
                      onChange={(e) => updateField('currency', e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border p-2.5 text-sm dark:border-dark-border dark:bg-dark-surface"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="SLL">SLL (SlSh)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted">Qiimaha Overtime-ka (Halkii 15 daqiiqo)</label>
                    <Input
                      type="number"
                      value={policy.overtimeChargePer15Min || 5}
                      onChange={(e) => updateField('overtimeChargePer15Min', Number(e.target.value))}
                      className="mt-1"
                      hint="Haddii kooxuhu codsadaan kordhin waqti"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 space-y-3 dark:border-dark-border/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Damage Deposit (Deebaajiga Waxyeellada)</p>
                      <p className="text-xs text-muted">
                        Deebaaji laga qaadayo kooxaha si loo daboolo haddii ay waxyeello geystaan.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(policy.damageDepositRequired)}
                      onChange={(e) => updateField('damageDepositRequired', e.target.checked)}
                      className="h-5 w-5 rounded text-brand-green focus:ring-brand-green"
                    />
                  </div>

                  {policy.damageDepositRequired && (
                    <div>
                      <label className="text-xs font-semibold text-muted">Qadarka Deebaajiga ($)</label>
                      <Input
                        type="number"
                        value={policy.damageDepositAmount || 0}
                        onChange={(e) => updateField('damageDepositAmount', Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* 03 Team Cancellation & Refunds */}
            {activeTab === 'cancellation' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiXCircle className="text-rose-600" />
                    <span>03. Cancellation Policy — Kansalaashada & Lacag-celinta</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Jadwalka lacag-celinta ee ku salaysan goorta uu kabtanku kansalo ballanka ka hor ciyaarta.
                  </p>
                </CardHeader>

                <div className="rounded-xl border border-border bg-black/[0.02] p-4 dark:border-dark-border dark:bg-white/[0.02]">
                  <p className="text-xs font-semibold uppercase text-muted mb-3">
                    Jadwalka Lacag-celinta (Refund Schedule Tiers):
                  </p>

                  <div className="space-y-3">
                    {(policy.cancelRefundTiers || []).map((tier, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-3 dark:border-dark-border dark:bg-dark-surface"
                      >
                        <div>
                          <p className="text-sm font-semibold text-charcoal dark:text-dark-text">
                            {tier.label || `${tier.hoursBefore} saacadood ka hor`}
                          </p>
                          <p className="text-xs text-muted">
                            {tier.hoursBefore > 0
                              ? `Haddii la kansalo ugu yaraan ${tier.hoursBefore} saac ka hor`
                              : 'Kansalaasho degdeg ah ciyaarta ka hor'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted">Celinta:</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={tier.refundPercent}
                            onChange={(e) => updateTierRefund(idx, e.target.value)}
                            className="w-20 rounded-lg border border-border p-1.5 text-center text-sm font-bold tabular-nums text-brand-green dark:border-dark-border dark:bg-dark-surface"
                          />
                          <span className="text-xs font-semibold">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
                  🛡️ <strong>Kansalaashada Mulkiilaha:</strong> Haddii garoonku kansalo ciyaarta sabab kasta ha ahaatee, nidaamku wuxuu si toos ah kabtanka u siinayaa <strong>100% lacag celin buuxda</strong>.
                </div>
              </Card>
            )}

            {/* 04 Rescheduling */}
            {activeTab === 'reschedule' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiClock className="text-brand-green" />
                    <span>04. Rescheduling Policy — Beddelidda Waqtiga Ciyaarta</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Xeerarka xakameynaya marka kabtanku ama garoonku codsado in waqtiga ciyaarta loo wareejiyo maalin ama saacad kale.
                  </p>
                </CardHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted">Muddada Beddelka Bilaashka Ah</label>
                    <Input
                      type="number"
                      value={policy.freeRescheduleWindowHours || 24}
                      onChange={(e) => updateField('freeRescheduleWindowHours', Number(e.target.value))}
                      className="mt-1"
                      hint="Saacadood ka hor ciyaarta (Tusaale: 24 saac = bilaash)"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted">Kharashka Beddelka (Haddii la soo daaho)</label>
                    <Input
                      type="number"
                      value={policy.rescheduleFee || 0}
                      onChange={(e) => updateField('rescheduleFee', Number(e.target.value))}
                      className="mt-1"
                      hint="Ugu badnaan $20 (Super Admin Guardrail)"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted">Ogeysiiska Ugu Yar (Min Notice Hours)</label>
                    <Input
                      type="number"
                      value={policy.minRescheduleNoticeHours || 6}
                      onChange={(e) => updateField('minRescheduleNoticeHours', Number(e.target.value))}
                      className="mt-1"
                      hint="Wax ka yar saacadahan lama oggola in la beddelo"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted">Tirada Ugu Badan Ee La Beddeli Karo</label>
                    <Input
                      type="number"
                      value={policy.maxReschedulesPerBooking || 1}
                      onChange={(e) => updateField('maxReschedulesPerBooking', Number(e.target.value))}
                      className="mt-1"
                      hint="Tusaale: 1 jeer oo bilaash ah halkii booking"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                  ⚖️ <strong>Xeerka Adag Ee E-Garoon:</strong> Mulkiiluhu ma qasbi karo kabtanka inuu waqti beddelo sababtoo ah wuxuu helay koox lacag badan bixinaysa. Haddii mulkiiluhu soo jeediyo waqti cusub, kabtanka ayaa xaq u leh inuu aqbalo ama diido.
                </div>
              </Card>
            )}

            {/* 05 Late Arrival & No-Show */}
            {activeTab === 'late_noshow' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiAlertTriangle className="text-amber-600" />
                    <span>05. Late Arrival & No-Show Policy — Soo Daahidda & Iman-waaga</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Sida loo maamulayo marka kooxdu ka soo daahdo waqtigeeda ama aysan gebi ahaanba garoonka iman.
                  </p>
                </CardHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted">Grace Period (Daqiiqo Sugid)</label>
                    <select
                      value={policy.lateArrivalGraceMinutes || 15}
                      onChange={(e) => updateField('lateArrivalGraceMinutes', Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-border p-2.5 text-sm dark:border-dark-border dark:bg-dark-surface"
                    >
                      <option value={10}>10 daqiiqo</option>
                      <option value={15}>15 daqiiqo (Default)</option>
                      <option value={20}>20 daqiiqo</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted">No-Show Wait Window</label>
                    <Input
                      type="number"
                      value={policy.noShowWaitMinutes || 15}
                      onChange={(e) => updateField('noShowWaitMinutes', Number(e.target.value))}
                      className="mt-1"
                      hint="Daqiiqo kadib ciyaarta ka hor inta aan no-show la calaamadayn"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-warmwhite p-3.5 text-xs text-muted space-y-1.5 dark:bg-dark-surface dark:border-dark-border">
                  <p className="font-semibold text-charcoal dark:text-dark-text">Cawaaqibta Soo Daahidda (Late Consequence):</p>
                  <p>• Wakhtiga lumay dib looguma darayo ciyaarta haddii booska xiga uu ballansan yahay (Next team protection).</p>
                  <p>• Haddii kooxdu gebi ahaanba timaaddi weydo (No-Show), <strong>lacag celin ma jirto (0% refund)</strong> kirada garoonkana mulkiilaha ayaa qaadanaya.</p>
                  <p>• Akoonka kabtanka waxaa lagu samaynayaa digniin anshaxeed (Reliability record).</p>
                </div>
              </Card>
            )}

            {/* 06 Owner Cancellation */}
            {activeTab === 'owner_cancel' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiShield className="text-brand-green" />
                    <span>06. Garoon Aan Diyaar Ahayn & Owner Cancellation</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Shuruudaha khuseeya haddii garoonku cillad ku timaaddo ama uu baajiyo ciyaarta.
                  </p>
                </CardHeader>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Bixi Boos Kale Oo Magdhaw Ah (Compensate Alternative Slot)</p>
                      <p className="text-xs text-muted">
                        U soo jeedi kooxda waqti kale oo lacag la'aan ah haddii garoonku baajiyo.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={policy.ownerCompensateAlternativeSlot !== false}
                      onChange={(e) => updateField('ownerCompensateAlternativeSlot', e.target.checked)}
                      className="h-5 w-5 rounded text-brand-green focus:ring-brand-green"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted">Ogeysiiska Ugu Yar Ee Baajinta Garoonka (Hours)</label>
                    <Input
                      type="number"
                      value={policy.ownerCancellationNoticeMinHours || 4}
                      onChange={(e) => updateField('ownerCancellationNoticeMinHours', Number(e.target.value))}
                      className="mt-1"
                      hint="Ugu yaraan 4 saacadood ka hor xaaladaha caadiga ah"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* 07 Weather & Emergencies */}
            {activeTab === 'weather' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiCloudRain className="text-blue-600" />
                    <span>07. Weather, Emergency & Force Majeure — Cimilada & Degdegga</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Xeerarka roobka, biyo fariisiga garoonka, iyo xaaladaha dabiiciga ah.
                  </p>
                </CardHeader>

                <div>
                  <label className="text-xs font-semibold text-muted">Xeerka Cimilada Xun (Roob & Biyo Fariisi)</label>
                  <select
                    value={policy.weatherPolicyType || 'full_refund_or_reschedule'}
                    onChange={(e) => updateField('weatherPolicyType', e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border p-2.5 text-sm dark:border-dark-border dark:bg-dark-surface"
                  >
                    <option value="full_refund_or_reschedule">
                      100% Lacag Celin Ama Waqti Kale Oo Bilaash Ah (Lagugula talinayo)
                    </option>
                    <option value="reschedule_only">Kaliya Waqti Kale Oo Bilaash Ah</option>
                  </select>
                </div>
              </Card>
            )}

            {/* 08 Damage & Conduct */}
            {activeTab === 'conduct' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiAlertTriangle className="text-amber-600" />
                    <span>08. Waxyeellada Garoonka & Anshaxa Ciyaartoyda</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Xeerarka nadaafadda, qalabka garoonka, kabaha la oggol yahay, iyo anshaxa.
                  </p>
                </CardHeader>

                <div>
                  <label className="text-xs font-semibold text-muted">Xeerka Kabaha La Oggol Yahay (Footwear Rule)</label>
                  <Input
                    value={policy.bannedFootwearPolicy || ''}
                    onChange={(e) => updateField('bannedFootwearPolicy', e.target.value)}
                    className="mt-1"
                    placeholder="Tusaale: Kaba biraha leh waa mamnuuc; kaliya kuwa caagga ah..."
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted">Waxyaabaha Mamnuuca Ah (Prohibited Items)</label>
                  <Input
                    value={policy.prohibitedItemsPolicy || ''}
                    onChange={(e) => updateField('prohibitedItemsPolicy', e.target.value)}
                    className="mt-1"
                    placeholder="Tusaale: Sigaarka, qashinka, hubka..."
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <div>
                    <p className="text-sm font-semibold">Caddeyn Sawir Ah Oo Qasab Ah (Photo Evidence Required)</p>
                    <p className="text-xs text-muted">
                      Mulkiiluhu ma jari karo lacag waxyeello ilaa uu la yimaado sawir caddeyn ah oo timestamp leh.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={policy.pitchDamageEvidenceRequired !== false}
                    onChange={(e) => updateField('pitchDamageEvidenceRequired', e.target.checked)}
                    className="h-5 w-5 rounded text-brand-green focus:ring-brand-green"
                  />
                </div>
              </Card>
            )}

            {/* 09 Roster & Team Rules */}
            {activeTab === 'roster' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiUsers className="text-brand-green" />
                    <span>09. Xeerarka Ciyaartoyda & Kooxda</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Tirada ugu yar iyo ugu badan ee ciyaartoyda iyo beddelka xubnaha kooxda.
                  </p>
                </CardHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted">Tirada Ugu Yar Halkii Koox</label>
                    <Input
                      type="number"
                      value={policy.minPlayersPerTeam || 5}
                      onChange={(e) => updateField('minPlayersPerTeam', Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted">Tirada Ugu Badan Halkii Koox</label>
                    <Input
                      type="number"
                      value={policy.maxPlayersPerTeam || 15}
                      onChange={(e) => updateField('maxPlayersPerTeam', Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* 10 Overtime & Extensions */}
            {activeTab === 'overtime' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiSliders className="text-brand-green" />
                    <span>10. Waqtiga Dheeraadka Ah (Overtime & Extensions)</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Kordhinta waqtiga ciyaarta iyo ilaalinta kooxda xigta.
                  </p>
                </CardHeader>

                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                  ⚠️ <strong>Ilaalinta Kooxda Xigta (Next Team Protection):</strong> Overtime lama oggolaan karo haddii saacadda xigta ay ballansan tahay koox kale.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted">Ogeysiiska Kordhinta Ka Hor Dhammaadka</label>
                    <Input
                      type="number"
                      value={policy.overtimeNoticeMinutes || 10}
                      onChange={(e) => updateField('overtimeNoticeMinutes', Number(e.target.value))}
                      className="mt-1"
                      hint="Daqiiqo ka hor inta aanay ciyaartu dhammaan"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted">Qiimaha 15-ka Daqiiqo Ee Dheeraadka Ah ($)</label>
                    <Input
                      type="number"
                      value={policy.overtimeChargePer15Min || 5}
                      onChange={(e) => updateField('overtimeChargePer15Min', Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* 11 Complaints & Disputes */}
            {activeTab === 'disputes' && (
              <Card className="p-6 space-y-5">
                <CardHeader className="p-0 border-none">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FiInfo className="text-brand-green" />
                    <span>11. Murannada, Cabashooyinka & Appeals</span>
                  </CardTitle>
                  <p className="text-xs text-muted">
                    Sida loo xalliyo khilaafaadka u dhexeeya garoonka iyo kabtanka.
                  </p>
                </CardHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted">Muddada Gudbinta Cabashada (Saacadood)</label>
                    <Input
                      type="number"
                      value={policy.disputeWindowHours || 24}
                      onChange={(e) => updateField('disputeWindowHours', Number(e.target.value))}
                      className="mt-1"
                      hint="Saacadood kadib ciyaarta"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted">Muddada Jawaabta Mulkiilaha (Saacadood)</label>
                    <Input
                      type="number"
                      value={policy.ownerResponseWindowHours || 24}
                      onChange={(e) => updateField('ownerResponseWindowHours', Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* 12 Policy History & Revenue Agreements */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                {/* Revenue Agreements from Super Admin */}
                <Card className="p-6 space-y-4">
                  <CardHeader className="p-0 border-none">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FiFileText className="text-brand-green" />
                      <span>Heshiisyada Dakhliga Ee E-Garoon (Revenue Agreements)</span>
                    </CardTitle>
                    <p className="text-xs text-muted">
                      Heshiisyada rasmiga ah ee Super Admin-ku kuu soo diray ee xakameynaya commission-ka iyo booking fees.
                    </p>
                  </CardHeader>

                  {stadiumAgreements.length === 0 ? (
                    <p className="text-xs text-muted py-4 text-center">
                      Ma jiraan heshiisyo weli u yaalla garoonkan.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {stadiumAgreements.map((ag) => (
                        <div
                          key={ag._id}
                          className="rounded-xl border border-border bg-warmwhite p-4 space-y-3 dark:border-dark-border dark:bg-dark-surface"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-semibold text-sm">
                                Heshiiska Nooca v{ag.version} · {ag.rules?.model?.replace(/_/g, ' ')}
                              </p>
                              <p className="text-xs text-muted">
                                Taariikhda: {ag.createdAt ? new Date(ag.createdAt).toLocaleDateString() : '—'}
                              </p>
                            </div>
                            <Badge
                              variant={ag.status === 'ACTIVE' ? 'success' : ag.status === 'PENDING_ACCEPTANCE' ? 'warning' : 'neutral'}
                              dot
                            >
                              {ag.status}
                            </Badge>
                          </div>

                          <div className="text-xs text-muted space-y-1">
                            <p>• Booking Fee: {ag.rules?.bookingFeeAmount} {ag.rules?.bookingFeeCurrency || 'SLL'} (per team)</p>
                            <p>• Subscription: ${ag.rules?.subscriptionAmount} {ag.rules?.subscriptionCurrency || 'USD'} / bil</p>
                            <p>• Commission: {ag.rules?.commissionPercent || 0}% kirada garoonka</p>
                          </div>

                          {ag.status === 'PENDING_ACCEPTANCE' && (
                            <div className="flex gap-2 pt-2 border-t border-border/50">
                              <Button
                                size="sm"
                                icon={<FiCheckCircle />}
                                onClick={() => setAcceptTarget(ag)}
                              >
                                Aqbal Heshiiska (Accept)
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<FiXCircle />}
                                onClick={() => setRejectTarget(ag)}
                              >
                                Diid (Reject)
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Published Policy Versions History */}
                <Card className="p-6 space-y-4">
                  <CardHeader className="p-0 border-none">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FiClock className="text-brand-green" />
                      <span>Taariikhda Xeerarka La Daabacay (Policy Version History)</span>
                    </CardTitle>
                    <p className="text-xs text-muted">
                      Nuqulladii hore ee aad u daabacday garoonkan oo ay weheliyaan waqtigii la hirgeliyay.
                    </p>
                  </CardHeader>

                  {(policy.policyHistory || []).length === 0 ? (
                    <p className="text-xs text-muted py-4 text-center">
                      Kani waa noocii 1aad ee xeerka garoonkan.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {[...(policy.policyHistory || [])].reverse().map((h, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between rounded-xl border border-border p-3 text-xs dark:border-dark-border"
                        >
                          <div>
                            <span className="font-bold text-charcoal dark:text-dark-text">Nooca v{h.version}</span>
                            <span className="ml-2 text-muted">
                              {h.publishedAt ? new Date(h.publishedAt).toLocaleString() : '—'}
                            </span>
                          </div>
                          <Badge variant="neutral">Published Record</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Captain Terms Modal */}
      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Shuruudaha & Xeerarka: ${currentStadium?.name || 'Garoonka'}`}
        size="lg"
      >
        <div className="space-y-4 text-xs text-charcoal dark:text-dark-text">
          <p className="text-muted">
            Tani waa sida ay shuruudaha garoonkaagu ugu muuqdaan kabtannada iyo ciyaartoyda marka ay ballanka samaynayaan:
          </p>

          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-warmwhite p-3.5 space-y-1.5 dark:bg-dark-surface dark:border-dark-border">
              <p className="font-bold text-sm text-brand-green">⏰ Jadwalka & Boosaska</p>
              <p>• Muddada ciyaarta: <strong>{policy?.slotDurationMinutes || 60} daqiiqo</strong></p>
              <p>• Aagga waqtiga: <strong>Waqtiga Bariga Afrika (GMT+3 / EAT)</strong></p>
              <p>• Ugu yaraan {policy?.minBookingNoticeMinutes || 30} daqiiqo ka hor ciyaarta waa in la ballansado.</p>
            </div>

            <div className="rounded-xl border border-border bg-warmwhite p-3.5 space-y-1.5 dark:bg-dark-surface dark:border-dark-border">
              <p className="font-bold text-sm text-rose-600">❌ Kansalaashada & Lacag-celinta</p>
              {(policy?.cancelRefundTiers || []).map((t, idx) => (
                <p key={idx}>• {t.label}: <strong>{t.refundPercent}% celin</strong></p>
              ))}
              <p className="text-muted">• Haddii garoonku baajiyo ciyaarta: <strong>100% buuxda ayaa laguu soo celinayaa.</strong></p>
            </div>

            <div className="rounded-xl border border-border bg-warmwhite p-3.5 space-y-1.5 dark:bg-dark-surface dark:border-dark-border">
              <p className="font-bold text-sm text-amber-600">🔄 Beddelka Waqtiga (Reschedule)</p>
              <p>• Beddelka &gt; {policy?.freeRescheduleWindowHours || 24} saacadood ka hor: <strong>Bilaash ($0)</strong></p>
              <p>• Wax ka yar {policy?.minRescheduleNoticeHours || 6} saacadood lama oggola in la beddelo.</p>
            </div>

            <div className="rounded-xl border border-border bg-warmwhite p-3.5 space-y-1.5 dark:bg-dark-surface dark:border-dark-border">
              <p className="font-bold text-sm text-blue-600">👟 Anshaxa & Qalabka</p>
              <p>• {policy?.bannedFootwearPolicy || 'Kaba biraha leh waa mamnuuc; kaliya kuwa caagga ah ayaa la oggol yahay.'}</p>
              <p>• {policy?.prohibitedItemsPolicy || 'Sigaarka iyo qashinka waa mamnuuc garoonka.'}</p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button onClick={() => setPreviewOpen(false)}>Xir Preview-ga</Button>
          </div>
        </div>
      </Modal>

      {/* Accept Agreement Modal */}
      <Modal
        open={Boolean(acceptTarget)}
        onClose={() => setAcceptTarget(null)}
        title="Aqbal Heshiiska Dakhliga"
      >
        <div className="space-y-4 text-sm">
          <p>
            Ma xaqiijinaysaa inaad aqbashay heshiiska dakhliga ee <strong>v{acceptTarget?.version}</strong> ee garoonkaaga?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setAcceptTarget(null)}>Ka noqo</Button>
            <Button loading={accepting} onClick={handleAcceptAgreement}>Haa, Aqbal</Button>
          </div>
        </div>
      </Modal>

      {/* Reject Agreement Modal */}
      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        title="Diid Heshiiska Dakhliga"
      >
        <div className="space-y-4 text-sm">
          <p>Fadlan qor sababta aad u diidayso heshiiskan:</p>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Tusaale: Commission-ka aad buu u sarreeyaa..."
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Ka noqo</Button>
            <Button variant="danger" loading={rejecting} onClick={handleRejectAgreement}>Diid Heshiiska</Button>
          </div>
        </div>
      </Modal>
    </PageTransition>
  );
}
