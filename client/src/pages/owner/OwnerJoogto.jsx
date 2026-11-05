import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiUsers,
  FiPlus,
  FiSearch,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiDollarSign,
  FiShield,
  FiPrinter,
  FiCalendar,
  FiClock,
  FiTrash2,
  FiEdit2,
  FiLayers,
} from 'react-icons/fi';
import { QrCode as QrIcon } from 'lucide-react';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardTitle } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { FullPageSpinner } from '../../components/common/Spinner';
import JoogtoCardView from '../../components/joogto/JoogtoCardView';
import { stadiumApi } from '../../api/stadiumApi';
import { ownerApi } from '../../api/bookingApi';
import { toastApiError } from '../../lib/support';

const DAYS = [
  { value: 0, label: 'Axad (Sunday)' },
  { value: 1, label: 'Isniin (Monday)' },
  { value: 2, label: 'Talaado (Tuesday)' },
  { value: 3, label: 'Arbaco (Wednesday)' },
  { value: 4, label: 'Khamiis (Thursday)' },
  { value: 5, label: 'Jimce (Friday)' },
  { value: 6, label: 'Sabti (Saturday)' },
];

export default function OwnerJoogto() {
  const [stadiums, setStadiums] = useState([]);
  const [selectedStadiumId, setSelectedStadiumId] = useState('');
  const [fields, setFields] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedForPay, setSelectedForPay] = useState(null);
  const [cardToView, setCardToView] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    fieldId: '',
    teamName: '',
    captainName: '',
    captainPhone: '',
    dayOfWeek: 4, // Thursday default
    additionalDays: [],
    startTimeLocal: '17:00',
    endTimeLocal: '18:30',
    monthlyFee: 100,
    currency: 'USD',
    gracePeriodDays: 3,
    isPaid: true,
    paymentMethod: 'cash',
    note: '',
  });

  const [verifyInput, setVerifyInput] = useState('');
  const [verifyPin, setVerifyPin] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const [payForm, setPayForm] = useState({
    amount: '',
    currency: 'USD',
    paymentMethod: 'cash',
    reference: '',
    notes: '',
  });
  const [paying, setPaying] = useState(false);

  // Load stadiums
  useEffect(() => {
    (async () => {
      try {
        const { data } = await stadiumApi.list({ mine: 'true' });
        const list = data.data?.stadiums || [];
        setStadiums(list);
        if (list.length > 0) {
          setSelectedStadiumId(list[0]._id);
        }
      } catch (err) {
        toastApiError(err, 'Failed to load stadiums');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load fields & recurring memberships for selected stadium
  const loadStadiumData = async (stadiumId) => {
    if (!stadiumId) return;
    try {
      const [fieldsRes, recurringRes] = await Promise.all([
        stadiumApi.listFields(stadiumId),
        ownerApi.listRecurring({ stadiumId }),
      ]);
      const fieldList = fieldsRes.data.data?.fields || [];
      setFields(fieldList);
      if (fieldList.length > 0 && !createForm.fieldId) {
        setCreateForm((prev) => ({ ...prev, fieldId: fieldList[0]._id }));
      }
      setMemberships(recurringRes.data.data?.recurring || []);
    } catch (err) {
      toastApiError(err, 'Failed to load recurring matches');
    }
  };

  useEffect(() => {
    if (selectedStadiumId) {
      loadStadiumData(selectedStadiumId);
    }
  }, [selectedStadiumId]);

  // Filtered memberships
  const filtered = useMemo(() => {
    return memberships.filter((m) => {
      const matchSearch =
        m.teamName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.cardNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.captainName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.captainPhone?.includes(searchTerm);

      if (!matchSearch) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return m.cardStatus === 'active';
      if (statusFilter === 'grace') return m.cardStatus === 'grace_period';
      if (statusFilter === 'expired') return m.cardStatus === 'expired' || m.cardStatus === 'blocked';
      return true;
    });
  }, [memberships, searchTerm, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = memberships.length;
    const active = memberships.filter((m) => m.cardStatus === 'active').length;
    const grace = memberships.filter((m) => m.cardStatus === 'grace_period').length;
    const expired = memberships.filter((m) => m.cardStatus === 'expired' || m.cardStatus === 'blocked').length;
    const totalRev = memberships.reduce((acc, m) => acc + (Number(m.monthlyFee) || 0), 0);
    const kulRev = memberships.reduce((acc, m) => acc + (Number(m.kulansiiyeFee) || 0), 0);
    const stadiumNet = Math.max(0, totalRev - kulRev);

    return { total, active, grace, expired, totalRev, kulRev, stadiumNet };
  }, [memberships]);

  // Create Joogto Membership
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.fieldId) {
      toast.error('Fadlan dooro garoonka (Select a field)');
      return;
    }
    if (!createForm.teamName.trim()) {
      toast.error('Fadlan geli magaca kooxda (Enter team name)');
      return;
    }

    try {
      await ownerApi.createRecurring(createForm);
      toast.success(`Kooxda ${createForm.teamName} waa la diiwaangeliyay waxaana loo sameeyay Kaar Joogto ah!`);
      setCreateModalOpen(false);
      setCreateForm({
        fieldId: fields[0]?._id || '',
        teamName: '',
        captainName: '',
        captainPhone: '',
        dayOfWeek: 4,
        additionalDays: [],
        startTimeLocal: '17:00',
        endTimeLocal: '18:30',
        monthlyFee: 100,
        currency: 'USD',
        gracePeriodDays: 3,
        isPaid: true,
        paymentMethod: 'cash',
        note: '',
      });
      loadStadiumData(selectedStadiumId);
    } catch (err) {
      toastApiError(err, 'Failed to create joogto membership');
    }
  };

  // Verify Card (Gate Check-In / Anti-Scam)
  const handleVerify = async (e) => {
    e.preventDefault();
    if (!verifyInput.trim()) {
      toast.error('Geli lambarka kaarka ama scan garee QR code-ka');
      return;
    }
    setVerifying(true);
    setVerifyResult(null);
    try {
      const { data } = await ownerApi.verifyJoogtoCard({
        cardNumber: verifyInput.trim(),
        qrToken: verifyInput.trim(),
        pin: verifyPin.trim() || undefined,
      });
      setVerifyResult(data.data);
      if (data.data?.allowed) {
        toast.success(data.data.message || 'Kaarku waa sax oo waa la oggolaaday!');
      } else {
        toast.error(data.data.message || 'Kaarku wuu dhacay — lama oggola!');
      }
      loadStadiumData(selectedStadiumId);
    } catch (err) {
      toastApiError(err, 'Kaarka lama helin ama waa been-abuur (Invalid pass)');
    } finally {
      setVerifying(false);
    }
  };

  // Mark Paid / Renew 1 Month
  const openPayModal = (membership) => {
    setSelectedForPay(membership);
    setPayForm({
      amount: membership.monthlyFee || '',
      currency: membership.currency || 'USD',
      paymentMethod: 'cash',
      reference: '',
      notes: '',
    });
    setPayModalOpen(true);
  };

  const handleMarkPaid = async (e) => {
    e.preventDefault();
    if (!selectedForPay) return;
    setPaying(true);
    try {
      const { data } = await ownerApi.markJoogtoPaid(selectedForPay._id, payForm);
      toast.success(data.data?.message || 'Lacagta bisha waa la xaqiijiyay!');
      setPayModalOpen(false);
      setSelectedForPay(null);
      loadStadiumData(selectedStadiumId);
    } catch (err) {
      toastApiError(err, 'Could not record payment');
    } finally {
      setPaying(false);
    }
  };

  // Delete Membership
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Ma hubtaa inaad tirtirto kooxda joogtada ah ee "${name}"?`)) return;
    try {
      await ownerApi.deleteRecurring(id);
      toast.success('Kooxda waa la tirtiray');
      loadStadiumData(selectedStadiumId);
    } catch (err) {
      toastApiError(err, 'Could not delete');
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <PageTransition className="max-w-6xl">
      <PageHeader
        title="Ciyaaraha Joogto (Permanent Match Memberships)"
        description="Maamul kooxaha joogtada ah ee bishii mar bixiya lacagta (VIP Teams). Nidaamkan wuxuu xaqiijinayaa kaadhadhka dhijitaalka ah, ka-hortagga been-abuurka (anti-scam QR), muddo-dhaafka (dynamic grace period), iyo xisaabinta dakhliga bisha."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              icon={<QrIcon size={16} />}
              onClick={() => {
                setVerifyInput('');
                setVerifyPin('');
                setVerifyResult(null);
                setVerifyModalOpen(true);
              }}
            >
              Baadh Kaarka (Scan Gate Pass)
            </Button>
            <Button
              icon={<FiPlus />}
              onClick={() => setCreateModalOpen(true)}
            >
              Ku dar Koox Joogto ah
            </Button>
          </div>
        }
      />

      {/* Stadium Switcher */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-4 shadow-sm dark:border-dark-border dark:bg-dark-surface">
        <div className="flex items-center gap-3">
          <FiShield className="text-forest text-xl" />
          <div>
            <p className="text-xs uppercase text-muted font-bold">Dooro Garoonkaaga</p>
            <Select
              className="mt-1 font-semibold"
              value={selectedStadiumId}
              onChange={(e) => setSelectedStadiumId(e.target.value)}
            >
              {stadiums.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name} ({s.location?.city || 'Garoon'})
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Dynamic Grace Period Info */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-semibold">Muddada Muddo-dhaafka (Grace Period):</p>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
            Haddii bishu dhammaato, kooxdu waxay haysataa <strong>3-4 maalmood</strong> oo naxariis ah ka hor inta uusan kaarku si automatic ah u noqon <strong>EXPIRED / DIIDMO</strong>.
          </p>
        </div>
      </div>

      {/* Financial & Status KPI Cards */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest">
            <FiUsers size={20} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted font-bold">Wadarta Kooxaha</p>
            <p className="font-display text-2xl font-extrabold text-charcoal dark:text-dark-text">{stats.total}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
            <FiCheckCircle size={20} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted font-bold">Firfircoon (Paid)</p>
            <p className="font-display text-2xl font-extrabold text-emerald-600">{stats.active}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
            <FiAlertTriangle size={20} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted font-bold">Muddo-Dhaaf (Grace)</p>
            <p className="font-display text-2xl font-extrabold text-amber-600">{stats.grace}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-600">
            <FiXCircle size={20} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted font-bold">Xidhan (Expired)</p>
            <p className="font-display text-2xl font-extrabold text-red-600">{stats.expired}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/15 text-forest">
            <FiDollarSign size={20} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted font-bold">Dakhliga Bisha (Net)</p>
            <p className="font-display text-xl font-extrabold text-forest">${stats.stadiumNet}</p>
            <p className="text-[10px] text-muted">E-Garoon: ${stats.kulRev}</p>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 max-w-md">
          <Input
            icon={<FiSearch />}
            placeholder="Raadi magaca kooxda, Card No (JG-...), kabtanka..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-white p-1 text-xs dark:border-dark-border dark:bg-dark-surface">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg px-3 py-1.5 font-semibold transition-all ${
              statusFilter === 'all' ? 'bg-forest text-white' : 'text-muted hover:text-charcoal'
            }`}
          >
            Dhammaan ({memberships.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`rounded-lg px-3 py-1.5 font-semibold transition-all ${
              statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-muted hover:text-charcoal'
            }`}
          >
            Firfircoon ({stats.active})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('grace')}
            className={`rounded-lg px-3 py-1.5 font-semibold transition-all ${
              statusFilter === 'grace' ? 'bg-amber-600 text-white' : 'text-muted hover:text-charcoal'
            }`}
          >
            Muddo-Dhaaf ({stats.grace})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('expired')}
            className={`rounded-lg px-3 py-1.5 font-semibold transition-all ${
              statusFilter === 'expired' ? 'bg-red-600 text-white' : 'text-muted hover:text-charcoal'
            }`}
          >
            Xidhan ({stats.expired})
          </button>
        </div>
      </div>

      {/* Membership List */}
      {filtered.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<FiUsers size={24} />}
            title="Kooxo Joogto ah Lama Helin"
            description="Garoonkan weli kooxo joogto ah (permanent matches) laguma darin, ama raadintaada waxba kuma soo bixin."
            action={
              <Button icon={<FiPlus />} onClick={() => setCreateModalOpen(true)}>
                Ku dar Koox Joogto ah
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {filtered.map((item) => (
            <div key={item._id} className="space-y-2">
              <JoogtoCardView
                membership={item}
                isManager={true}
                onMarkPaid={openPayModal}
              />
              <div className="flex items-center justify-between px-2 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <FiLayers size={13} /> Dakhliga Garoonka: <strong>${item.stadiumShare || item.monthlyFee}</strong> (E-Garoon Fee: ${item.kulansiiyeFee || 4})
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(item._id, item.teamName)}
                  className="inline-flex items-center gap-1 text-red-500 hover:text-red-700 font-medium"
                >
                  <FiTrash2 size={13} /> Tir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================== VERIFY & SCAN MODAL (ANTI-SCAM) ===================== */}
      <Modal
        open={verifyModalOpen}
        onClose={() => setVerifyModalOpen(false)}
        title="Baadh & Xaqiiji Kaarka Joogtada ah (Gate Check-In)"
      >
        <form onSubmit={handleVerify} className="space-y-4">
          <p className="text-xs text-muted">
            Si looga fogaado been-abuurka (qof dhahaya anigaa ah kooxda hebel), geli lambarka kaarka (`JG-HAR-1042`) ama scan garee QR code-ka.
          </p>

          <Input
            label="Lambarka Kaarka (Card Number) ama QR Token"
            placeholder="JG-HAR-104221"
            value={verifyInput}
            onChange={(e) => setVerifyInput(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Security PIN (Optional — Xaqiijin dheeraad ah)"
            placeholder="4-digit PIN (e.g. 7842)"
            value={verifyPin}
            onChange={(e) => setVerifyPin(e.target.value)}
          />

          <Button type="submit" loading={verifying} className="w-full" icon={<QrIcon size={16} />}>
            Baadh Kaarka (Verify Pass)
          </Button>

          {/* Verification Result Banner */}
          {verifyResult && (
            <div
              className={`mt-4 rounded-2xl border p-4 text-sm transition-all ${
                verifyResult.allowed
                  ? verifyResult.status === 'grace_period'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
                  : 'border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-base">
                {verifyResult.allowed ? (
                  verifyResult.status === 'grace_period' ? (
                    <>
                      <FiAlertTriangle className="text-amber-500" size={20} />
                      <span>WAAD CIYAARI KARTAA — DIGNIIN MUDDO-DHAAF</span>
                    </>
                  ) : (
                    <>
                      <FiCheckCircle className="text-emerald-500" size={20} />
                      <span>SAX — WAAD CIYAARI KARTAA (ALLOWED)</span>
                    </>
                  )
                ) : (
                  <>
                    <FiXCircle className="text-red-500" size={20} />
                    <span>DIIDMO — KAARKU WUU DHACAY (EXPIRED / UNPAID)</span>
                  </>
                )}
              </div>

              <p className="mt-2 text-xs leading-relaxed">{verifyResult.message}</p>
              {verifyResult.warning && (
                <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {verifyResult.warning}
                </p>
              )}

              {verifyResult.team && (
                <div className="mt-3 grid gap-2 rounded-xl bg-white/40 p-3 text-xs dark:bg-black/20">
                  <p><strong>Kooxda:</strong> {verifyResult.team.teamName}</p>
                  <p><strong>Kabtanka:</strong> {verifyResult.team.captainName || '—'} ({verifyResult.team.captainPhone || '—'})</p>
                  <p><strong>Card No:</strong> {verifyResult.team.cardNumber}</p>
                  <p><strong>Saacadda:</strong> {verifyResult.schedule?.startTimeLocal} - {verifyResult.schedule?.endTimeLocal}</p>
                  <p><strong>Dhicitaanka:</strong> {verifyResult.validUntil ? new Date(verifyResult.validUntil).toLocaleDateString() : 'N/A'}</p>
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      {/* ===================== CREATE MEMBERSHIP MODAL ===================== */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Diiwaangeli Koox Joogto ah (Add Permanent Match Team)"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Select
            label="Garoonka (Field)"
            value={createForm.fieldId}
            onChange={(e) => setCreateForm({ ...createForm, fieldId: e.target.value })}
            required
          >
            {fields.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name} ({f.type})
              </option>
            ))}
          </Select>

          <Input
            label="Magaca Kooxda (Team Name)"
            placeholder="Tusaale: Gaashaan FC ama Doctors FC"
            value={createForm.teamName}
            onChange={(e) => setCreateForm({ ...createForm, teamName: e.target.value })}
            required
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Magaca Kabtanka"
              placeholder="Ismail Ahmed"
              value={createForm.captainName}
              onChange={(e) => setCreateForm({ ...createForm, captainName: e.target.value })}
            />
            <Input
              label="Telefoonka Kabtanka"
              placeholder="0634123456"
              value={createForm.captainPhone}
              onChange={(e) => setCreateForm({ ...createForm, captainPhone: e.target.value })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Select
              label="Maalinta Ciyaarta"
              value={createForm.dayOfWeek}
              onChange={(e) => setCreateForm({ ...createForm, dayOfWeek: Number(e.target.value) })}
            >
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>

            <Input
              label="Waqtiga Bilaabashada"
              type="time"
              value={createForm.startTimeLocal}
              onChange={(e) => setCreateForm({ ...createForm, startTimeLocal: e.target.value })}
              required
            />

            <Input
              label="Waqtiga Dhamaadka"
              type="time"
              value={createForm.endTimeLocal}
              onChange={(e) => setCreateForm({ ...createForm, endTimeLocal: e.target.value })}
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Lacagta Bisha ($)"
              type="number"
              min="0"
              value={createForm.monthlyFee}
              onChange={(e) => setCreateForm({ ...createForm, monthlyFee: Number(e.target.value) })}
              required
            />

            <Select
              label="Nooca Lacagta"
              value={createForm.currency}
              onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
            >
              <option value="USD">USD ($)</option>
              <option value="SLSH">Somaliland Shilling</option>
            </Select>

            <Input
              label="Muddo-dhaaf (Grace Days)"
              type="number"
              min="0"
              max="30"
              value={createForm.gracePeriodDays}
              onChange={(e) => setCreateForm({ ...createForm, gracePeriodDays: Number(e.target.value) })}
            />
          </div>

          <div className="rounded-xl border border-border p-3 bg-surface-inset">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={createForm.isPaid}
                onChange={(e) => setCreateForm({ ...createForm, isPaid: e.target.checked })}
              />
              Bishii hore waa la bixiyay (Mark 1st Month as Paid immediately)
            </label>
            {createForm.isPaid && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs">
                <Select
                  label="Habka Lacag-bixinta"
                  value={createForm.paymentMethod}
                  onChange={(e) => setCreateForm({ ...createForm, paymentMethod: e.target.value })}
                >
                  <option value="cash">Kaash (Cash at Stadium)</option>
                  <option value="mobile_money">Mobile Money (Zaad / eDahab)</option>
                </Select>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full" size="lg">
            Diiwaangeli oo Abuur Kaarka Joogtada ah
          </Button>
        </form>
      </Modal>

      {/* ===================== MARK PAID / RENEW 1 MONTH MODAL ===================== */}
      <Modal
        open={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={`Xaqiiji Lacagta Bisha — ${selectedForPay?.teamName || ''}`}
      >
        <form onSubmit={handleMarkPaid} className="space-y-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-200">
            <p><strong>Kooxda:</strong> {selectedForPay?.teamName} · Card No: {selectedForPay?.cardNumber}</p>
            <p>Xaqiijintani waxay kaarka u cusbooneysiinaysaa <strong>1 bil oo buuxda</strong> waxayna siinaysaa risiidh rasmi ah.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Cadadka Lacagta"
              type="number"
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              required
            />
            <Select
              label="Nooca Lacagta"
              value={payForm.currency}
              onChange={(e) => setPayForm({ ...payForm, currency: e.target.value })}
            >
              <option value="USD">USD ($)</option>
              <option value="SLSH">Somaliland Shilling</option>
            </Select>
          </div>

          <Select
            label="Habka Lacag-bixinta"
            value={payForm.paymentMethod}
            onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
          >
            <option value="cash">Kaash toos loogu dhiibay Garoonka (Cash)</option>
            <option value="mobile_money">Mobile Money (Zaad / eDahab / Sahal)</option>
          </Select>

          <Input
            label="Tixraaca / Reference (Optional)"
            placeholder="Tusaale: Zaad Trx ID ama Cash Receipt No"
            value={payForm.reference}
            onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
          />

          <Button type="submit" loading={paying} className="w-full" size="lg" icon={<FiCheckCircle />}>
            Xaqiiji Lacagta & Cusbooneysii Kaarka (Renew Pass)
          </Button>
        </form>
      </Modal>
    </PageTransition>
  );
}
