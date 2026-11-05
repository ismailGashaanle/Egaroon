import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Select from '../../components/common/Select';
import Modal from '../../components/common/Modal';
import Tabs from '../../components/common/Tabs';
import MediaUpload from '../../components/common/MediaUpload';
import { FullPageSpinner } from '../../components/common/Spinner';
import { stadiumApi, fieldApi } from '../../api/stadiumApi';
import { ownerApi } from '../../api/bookingApi';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../lib/roles';
import { useTranslation } from '../../i18n/LanguageContext';
import { FIELD_TYPES, capacityForType } from '../../lib/fieldFormats';

const emptyField = {
  name: '',
  type: '7v7',
  capacity: 7,
  pricingMode: 'per_player',
  pricePerPlayer: '',
  fixedPrice: '',
  images: [],
  openingTime: '06:00',
  closingTime: '23:00',
};

const emptyBlock = {
  fieldId: '',
  type: 'maintenance',
  startsAt: '',
  endsAt: '',
  reason: '',
};

const emptyRecurring = {
  fieldId: '',
  teamName: '',
  dayOfWeek: 5,
  startTimeLocal: '20:00',
  endTimeLocal: '21:00',
  startDate: '',
  note: '',
};

const DOW_KEYS = ['dow0', 'dow1', 'dow2', 'dow3', 'dow4', 'dow5', 'dow6'];

export default function OwnerStadiumDetail() {
  const { stadiumId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { role } = useAuth();
  const isOwner = role === ROLES.STADIUM_OWNER;

  const [stadium, setStadium] = useState(null);
  const [fields, setFields] = useState([]);
  const [managers, setManagers] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const tab = searchParams.get('tab') || 'fields';
  const setTab = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyField);
  const [editingField, setEditingField] = useState(null);
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState([]);
  const [savingImages, setSavingImages] = useState(false);
  const [blockForm, setBlockForm] = useState(emptyBlock);
  const [blocking, setBlocking] = useState(false);
  const [lockForm, setLockForm] = useState({
    type: 'owner_block',
    startsAt: '',
    endsAt: '',
    reason: '',
  });
  const [locking, setLocking] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blockFilterField, setBlockFilterField] = useState('');
  const [showPastBlocks, setShowPastBlocks] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [editForm, setEditForm] = useState(emptyBlock);
  const [editBusy, setEditBusy] = useState(false);

  const [mgrForm, setMgrForm] = useState({ email: '', name: '', password: '' });
  const [mgrBusy, setMgrBusy] = useState(false);

  const [recForm, setRecForm] = useState(emptyRecurring);
  const [recBusy, setRecBusy] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);

  const [discForm, setDiscForm] = useState({
    name: '',
    fieldId: '',
    applyToAllSlots: false,
    type: 'percent',
    percentOff: 20,
    amountOff: '',
    startTimeLocal: '06:00',
    endTimeLocal: '12:00',
    daysOfWeek: [],
    validFrom: '',
    validUntil: '',
  });
  const [discBusy, setDiscBusy] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);

  const [payoutMode, setPayoutMode] = useState('after_match');
  const [payoutMinutes, setPayoutMinutes] = useState(20);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [acceptMode, setAcceptMode] = useState('auto');
  const [acceptBusy, setAcceptBusy] = useState(false);

  // Booking & Reschedule Policy state
  const [policyForm, setPolicyForm] = useState({
    rescheduleAllowed: true,
    freeRescheduleWindowHours: 24,
    rescheduleFee: 0,
    rescheduleFeeCurrency: 'USD',
    minRescheduleNoticeHours: 6,
    cancellationAllowed: true,
    cancelRefundWindowHours: 24,
    cancelRefundPercent: 100,
    venueTimeZone: 'Africa/Mogadishu',
    policyNoticeSo: '',
  });
  const [policyBusy, setPolicyBusy] = useState(false);

  const load = async () => {
    try {
      const [stadiumRes, fieldsRes] = await Promise.all([
        stadiumApi.get(stadiumId),
        stadiumApi.listFields(stadiumId),
      ]);
      const st = stadiumRes.data.data.stadium;
      setStadium(st);
      setFields(fieldsRes.data.data.fields);
      setImages(st.images || []);
      setPayoutMode(st.payoutPolicy?.mode || 'after_match');
      setPayoutMinutes(st.payoutPolicy?.delayMinutes || 20);
      setAcceptMode(st.bookingAcceptMode === 'manual' ? 'manual' : 'auto');

      const p = st.bookingPolicy || {};
      setPolicyForm({
        rescheduleAllowed: p.rescheduleAllowed !== false,
        freeRescheduleWindowHours: p.freeRescheduleWindowHours ?? 24,
        rescheduleFee: p.rescheduleFee ?? 0,
        rescheduleFeeCurrency: p.rescheduleFeeCurrency || 'USD',
        minRescheduleNoticeHours: p.minRescheduleNoticeHours ?? 6,
        cancellationAllowed: p.cancellationAllowed !== false,
        cancelRefundWindowHours: p.cancelRefundWindowHours ?? 24,
        cancelRefundPercent: p.cancelRefundPercent ?? 100,
        venueTimeZone: p.venueTimeZone || 'Africa/Mogadishu',
        policyNoticeSo: p.policyNoticeSo || '',
      });

      const [m, r, d] = await Promise.all([
        isOwner
          ? stadiumApi.listManagers(stadiumId).catch(() => ({ data: { data: { managers: [] } } }))
          : Promise.resolve({ data: { data: { managers: [] } } }),
        ownerApi.listRecurring({ stadiumId }).catch(() => ({ data: { data: { recurring: [] } } })),
        ownerApi.listDiscounts({ stadiumId }).catch(() => ({ data: { data: { discounts: [] } } })),
      ]);
      setManagers(m.data.data.managers || []);
      setRecurring(r.data.data.recurring || []);
      const allDisc = d.data.data.discounts || [];
      setDiscounts(allDisc.filter((x) => String(x.stadium) === stadiumId || x.stadium?._id === stadiumId));
    } catch {
      toast.error(t('owner.loadFail'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadiumId]);

  const loadBlocks = async () => {
    setBlocksLoading(true);
    try {
      const params = {
        upcoming: showPastBlocks ? '0' : '1',
      };
      if (blockFilterField) params.fieldId = blockFilterField;
      const { data } = await stadiumApi.listAvailabilityBlocks(stadiumId, params);
      setBlocks(data.data.blocks || []);
    } catch {
      toast.error(t('owner.blocksLoadFail'));
      setBlocks([]);
    } finally {
      setBlocksLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'blocks' && stadiumId) loadBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, stadiumId, blockFilterField, showPastBlocks]);

  const pricePreview = useMemo(() => {
    return fields.map((f) => {
      const perSide = Number(f.capacity) || 0;
      const total =
        f.pricingMode === 'per_player'
          ? (Number(f.pricePerPlayer) || 0) * perSide * 2
          : Number(f.fixedPrice) || 0;
      return {
        id: f._id,
        name: f.name,
        total,
        mode: f.pricingMode,
        perSide,
        teamShare:
          f.pricingMode === 'per_player' ? (Number(f.pricePerPlayer) || 0) * perSide : total / 2,
      };
    });
  }, [fields]);

  const openAddField = () => {
    setEditingField(null);
    setForm(emptyField);
    setOpen(true);
  };

  const openEditField = (f) => {
    setEditingField(f);
    setForm({
      name: f.name || '',
      type: f.type || '7v7',
      capacity: f.capacity || capacityForType(f.type || '7v7'),
      pricingMode: f.pricingMode || 'per_player',
      pricePerPlayer: f.pricePerPlayer ?? '',
      fixedPrice: f.fixedPrice ?? '',
      images: f.images || [],
      openingTime: f.openingTime || '06:00',
      closingTime: f.closingTime || '23:00',
    });
    setOpen(true);
  };

  const handleSaveField = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        images: form.images || [],
        capacity: Number(form.capacity),
        pricePerPlayer: form.pricingMode === 'per_player' ? Number(form.pricePerPlayer) : undefined,
        fixedPrice: form.pricingMode === 'fixed' ? Number(form.fixedPrice) : undefined,
      };
      if (editingField?._id) {
        await fieldApi.update(editingField._id, payload);
        toast.success(t('owner.fieldUpdated'));
      } else {
        await stadiumApi.createField(stadiumId, payload);
        toast.success(t('owner.fieldAdded'));
      }
      setOpen(false);
      setEditingField(null);
      setForm(emptyField);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.fieldSaveFail'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteField = async (f) => {
    if (!window.confirm(t('owner.fieldDeleteConfirm', { name: f.name }))) return;
    try {
      await fieldApi.remove(f._id);
      toast.success(t('owner.fieldDeleted'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.fieldDeleteFail'));
    }
  };

  const handleFieldOps = async (f, mode) => {
    try {
      await fieldApi.setOps(f._id, { mode });
      toast.success(mode === 'offline' ? t('owner.fieldOffline') : t('owner.fieldOnline'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.loadFail'));
    }
  };

  const handleSaveImages = async () => {
    setSavingImages(true);
    try {
      const { data } = await stadiumApi.update(stadiumId, { images });
      setStadium(data.data.stadium);
      setImages(data.data.stadium.images || []);
      toast.success(t('owner.imagesSaved'));
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update images');
    } finally {
      setSavingImages(false);
    }
  };

  const toDatetimeLocal = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const formatBlockWhen = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const blockTypeLabel = (type) => {
    const map = {
      maintenance: t('owner.blockMaintenance'),
      weather: t('owner.blockWeather'),
      holiday: t('owner.blockHoliday'),
      private_event: t('owner.blockPrivate'),
      tournament: t('owner.blockTournament'),
      owner_block: t('owner.blockOwnerLock'),
    };
    return map[type] || type;
  };

  const handleLockStadium = async (e) => {
    e.preventDefault();
    if (!lockForm.startsAt || !lockForm.endsAt) {
      return toast.error(t('owner.lockNeedTimes'));
    }
    setLocking(true);
    try {
      await stadiumApi.lockStadium(stadiumId, {
        type: lockForm.type || 'owner_block',
        startsAt: new Date(lockForm.startsAt).toISOString(),
        endsAt: new Date(lockForm.endsAt).toISOString(),
        reason: lockForm.reason || undefined,
      });
      toast.success(t('owner.stadiumLocked'));
      setLockForm({ type: 'owner_block', startsAt: '', endsAt: '', reason: '' });
      loadBlocks();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.lockFail'));
    } finally {
      setLocking(false);
    }
  };

  const handleBlockSlot = async (e) => {
    e.preventDefault();
    if (!blockForm.fieldId) return toast.error(t('owner.pickField'));
    setBlocking(true);
    try {
      await fieldApi.createAvailabilityBlock(blockForm.fieldId, {
        type: blockForm.type,
        startsAt: new Date(blockForm.startsAt).toISOString(),
        endsAt: new Date(blockForm.endsAt).toISOString(),
        reason: blockForm.reason,
      });
      toast.success(t('owner.slotBlocked'));
      setBlockForm({ ...emptyBlock, fieldId: blockForm.fieldId });
      loadBlocks();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.blockCreateFail'));
    } finally {
      setBlocking(false);
    }
  };

  const openEditBlock = (block) => {
    setEditingBlock(block);
    setEditForm({
      fieldId: block.field?._id || block.field || '',
      type: block.type || 'maintenance',
      startsAt: toDatetimeLocal(block.startsAt),
      endsAt: toDatetimeLocal(block.endsAt),
      reason: block.reason || '',
    });
  };

  const handleUpdateBlock = async (e) => {
    e.preventDefault();
    if (!editingBlock) return;
    setEditBusy(true);
    try {
      await fieldApi.updateAvailabilityBlock(editingBlock._id, {
        type: editForm.type,
        startsAt: new Date(editForm.startsAt).toISOString(),
        endsAt: new Date(editForm.endsAt).toISOString(),
        reason: editForm.reason,
      });
      toast.success(t('owner.blockUpdated'));
      setEditingBlock(null);
      loadBlocks();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.blockUpdateFail'));
    } finally {
      setEditBusy(false);
    }
  };

  const handleDeleteBlock = async (block) => {
    const label =
      block.scope === 'stadium'
        ? t('owner.wholeStadium')
        : block.field?.name || t('owner.field');
    if (!window.confirm(t('owner.blockDeleteConfirm', { field: label }))) return;
    try {
      await fieldApi.deleteAvailabilityBlock(block._id);
      toast.success(t('owner.blockDeleted'));
      loadBlocks();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.blockDeleteFail'));
    }
  };

  const inviteManager = async (e) => {
    e.preventDefault();
    setMgrBusy(true);
    try {
      const { data } = await stadiumApi.inviteManager(stadiumId, mgrForm);
      toast.success(
        data.data.temporaryPassword
          ? `Manager invited. Temp password: ${data.data.temporaryPassword}`
          : t('owner.managerLinked')
      );
      setMgrForm({ email: '', name: '', password: '' });
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.response?.data?.message || 'Invite failed');
    } finally {
      setMgrBusy(false);
    }
  };

  const revokeManager = async (managerId) => {
    try {
      await stadiumApi.revokeManager(stadiumId, managerId);
      toast.success(t('owner.managerRevoked'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Revoke failed');
    }
  };

  const resetRecForm = () => {
    setRecForm(emptyRecurring);
    setEditingRecurring(null);
  };

  const startEditRecurring = (r) => {
    setEditingRecurring(r);
    setRecForm({
      fieldId: String(r.field?._id || r.field || ''),
      teamName: r.teamName || '',
      dayOfWeek: Number(r.dayOfWeek),
      startTimeLocal: r.startTimeLocal || '20:00',
      endTimeLocal: r.endTimeLocal || '21:00',
      startDate: r.startDate ? String(r.startDate).slice(0, 10) : '',
      note: r.note || '',
    });
  };

  const saveRecurring = async (e) => {
    e.preventDefault();
    setRecBusy(true);
    try {
      const payload = {
        fieldId: recForm.fieldId,
        teamName: recForm.teamName,
        dayOfWeek: Number(recForm.dayOfWeek),
        startTimeLocal: recForm.startTimeLocal,
        endTimeLocal: recForm.endTimeLocal,
        startDate: recForm.startDate || new Date().toISOString(),
        note: recForm.note,
        frequency: 'weekly',
      };
      if (editingRecurring?._id) {
        await ownerApi.updateRecurring(editingRecurring._id, payload);
        toast.success(t('owner.recurringUpdated'));
      } else {
        await ownerApi.createRecurring(payload);
        toast.success(t('owner.recurringSaved'));
      }
      resetRecForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save recurring');
    } finally {
      setRecBusy(false);
    }
  };

  const removeRecurring = async (id) => {
    if (!window.confirm(t('owner.recurringDeleteConfirm'))) return;
    try {
      await ownerApi.deleteRecurring(id);
      toast.success(t('owner.recurringDeleted'));
      if (editingRecurring?._id === id) resetRecForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete');
    }
  };

  const resetDiscForm = () => {
    setDiscForm({
      name: '',
      fieldId: '',
      applyToAllSlots: false,
      type: 'percent',
      percentOff: 20,
      amountOff: '',
      startTimeLocal: '06:00',
      endTimeLocal: '12:00',
      daysOfWeek: [],
      validFrom: '',
      validUntil: '',
    });
    setEditingDiscount(null);
  };

  const toggleDiscDay = (day) => {
    setDiscForm((prev) => {
      const has = prev.daysOfWeek.includes(day);
      return {
        ...prev,
        daysOfWeek: has ? prev.daysOfWeek.filter((d) => d !== day) : [...prev.daysOfWeek, day].sort(),
      };
    });
  };

  const startEditDiscount = (d) => {
    setEditingDiscount(d);
    setDiscForm({
      name: d.name || '',
      fieldId: d.field?._id || d.field || '',
      applyToAllSlots: Boolean(d.applyToAllSlots),
      type: d.amountOff != null && d.percentOff == null ? 'amount' : 'percent',
      percentOff: d.percentOff ?? 20,
      amountOff: d.amountOff ?? '',
      startTimeLocal: d.startTimeLocal || '06:00',
      endTimeLocal: d.endTimeLocal || '12:00',
      daysOfWeek: Array.isArray(d.daysOfWeek) ? d.daysOfWeek : [],
      validFrom: d.validFrom ? String(d.validFrom).slice(0, 10) : '',
      validUntil: d.validUntil ? String(d.validUntil).slice(0, 10) : '',
    });
  };

  const addDiscount = async (e) => {
    e.preventDefault();
    const pct = Number(discForm.percentOff);
    const amt = Number(discForm.amountOff);
    if (discForm.type === 'percent' && (pct < 1 || pct > 100)) {
      toast.error(t('owner.percentRange'));
      return;
    }
    if (discForm.type === 'amount' && (!Number.isFinite(amt) || amt < 0)) {
      toast.error(t('owner.amountInvalid'));
      return;
    }
    if (
      !discForm.applyToAllSlots &&
      discForm.startTimeLocal &&
      discForm.endTimeLocal &&
      discForm.endTimeLocal <= discForm.startTimeLocal
    ) {
      toast.error(t('owner.timeOrder'));
      return;
    }
    if (discForm.validFrom && discForm.validUntil && discForm.validUntil < discForm.validFrom) {
      toast.error(t('owner.dateOrder'));
      return;
    }

    setDiscBusy(true);
    try {
      const payload = {
        stadiumId,
        name: discForm.name,
        fieldId: discForm.fieldId || null,
        applyToAllSlots: discForm.applyToAllSlots,
        daysOfWeek: discForm.applyToAllSlots ? [] : discForm.daysOfWeek,
        startTimeLocal: discForm.applyToAllSlots ? null : discForm.startTimeLocal || null,
        endTimeLocal: discForm.applyToAllSlots ? null : discForm.endTimeLocal || null,
        validFrom: discForm.validFrom || null,
        validUntil: discForm.validUntil || null,
        ...(discForm.type === 'percent'
          ? { percentOff: pct, amountOff: null }
          : { amountOff: amt, percentOff: null }),
      };

      if (editingDiscount?._id) {
        await ownerApi.updateDiscount(editingDiscount._id, payload);
        toast.success(t('owner.discountUpdated'));
      } else {
        await ownerApi.createDiscount(payload);
        toast.success(t('owner.discountAdded'));
      }
      resetDiscForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save discount');
    } finally {
      setDiscBusy(false);
    }
  };

  const removeDiscount = async (id) => {
    if (!window.confirm(t('owner.discountDeleteConfirm'))) return;
    try {
      await ownerApi.deleteDiscount(id);
      toast.success(t('owner.discountDeleted'));
      if (editingDiscount?._id === id) resetDiscForm();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete');
    }
  };

  const savePayoutPolicy = async (e) => {
    e.preventDefault();
    setPayoutBusy(true);
    try {
      let delayMinutes = Number(payoutMinutes);
      if (payoutMode === 'fixed_hours') delayMinutes = 1440;
      if (payoutMode === 'after_match' && ![20, 30, 60, 75].includes(delayMinutes)) {
        delayMinutes = 20;
      }
      const { data } = await stadiumApi.update(stadiumId, {
        payoutPolicy: { mode: payoutMode, delayMinutes },
      });
      setStadium(data.data.stadium);
      toast.success(t('owner.payoutSaved'));
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save policy');
    } finally {
      setPayoutBusy(false);
    }
  };

  const saveAcceptMode = async (e) => {
    e.preventDefault();
    setAcceptBusy(true);
    try {
      const { data } = await stadiumApi.update(stadiumId, {
        bookingAcceptMode: acceptMode === 'manual' ? 'manual' : 'auto',
      });
      setStadium(data.data.stadium);
      toast.success(t('owner.acceptModeSaved'));
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.loadFail'));
    } finally {
      setAcceptBusy(false);
    }
  };

  const savePolicy = async (e) => {
    e.preventDefault();
    setPolicyBusy(true);
    try {
      const { data } = await ownerApi.updateStadiumPolicy(stadiumId, {
        rescheduleAllowed: Boolean(policyForm.rescheduleAllowed),
        freeRescheduleWindowHours: Number(policyForm.freeRescheduleWindowHours),
        rescheduleFee: Number(policyForm.rescheduleFee),
        rescheduleFeeCurrency: policyForm.rescheduleFeeCurrency || 'USD',
        minRescheduleNoticeHours: Number(policyForm.minRescheduleNoticeHours),
        cancellationAllowed: Boolean(policyForm.cancellationAllowed),
        cancelRefundWindowHours: Number(policyForm.cancelRefundWindowHours),
        cancelRefundPercent: Number(policyForm.cancelRefundPercent),
        venueTimeZone: policyForm.venueTimeZone || 'Africa/Mogadishu',
        policyNoticeSo: policyForm.policyNoticeSo || '',
      });
      setStadium((prev) => ({ ...prev, bookingPolicy: data.data.bookingPolicy }));
      toast.success('Xeerka ballanka (Booking Policy) waa la keydiyay');
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to save booking policy');
    } finally {
      setPolicyBusy(false);
    }
  };

  if (loading) return <FullPageSpinner />;
  if (!stadium) return null;

  const tabs = [
    { key: 'fields', label: t('owner.tabFields') },
    { key: 'blocks', label: t('owner.tabBlocks') },
    { key: 'pricing', label: t('owner.tabPricing') },
    { key: 'recurring', label: t('owner.tabRecurring') },
    { key: 'policy', label: 'Booking Policy' },
    { key: 'accept', label: t('owner.tabAccept') },
    ...(isOwner
      ? [
          { key: 'discounts', label: t('owner.tabDiscounts') },
          { key: 'managers', label: t('owner.tabManagers') },
          { key: 'payout', label: t('owner.tabPayout') },
        ]
      : [{ key: 'discounts', label: t('owner.tabDiscounts') }]),
  ];

  return (
    <PageTransition>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">{stadium.name}</h1>
          <p className="mt-1 text-sm text-muted dark:text-dark-muted capitalize">
            Status: <span className="font-semibold">{stadium.status}</span>
            {' · '}
            {stadium.location?.city || 'No city'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to={`/owner/slots?stadiumId=${stadiumId}`} size="sm" variant="outline">
            {t('owner.navSlots')}
          </Button>
          <Button icon={<FiPlus />} onClick={openAddField}>
            {t('owner.addField')}
          </Button>
        </div>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-display font-bold">{t('owner.stadiumImages')}</h2>
        <MediaUpload
          className="mt-3"
          folder="stadiums"
          accept="image/*,video/*"
          multiple
          maxFiles={12}
          label={t('owner.uploadStadiumMedia')}
          hint={t('owner.uploadStadiumHint')}
          value={images}
          onChange={setImages}
        />
        <Button className="mt-3" size="sm" loading={savingImages} onClick={handleSaveImages}>
          {t('common.save')}
        </Button>
      </Card>

      <div className="mt-6">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {tab === 'fields' && (
        <div className="mt-4 space-y-3">
          {fields.length === 0 && <p className="text-sm text-muted">{t('owner.noFields')}</p>}
          {fields.map((f) => (
            <Card key={f._id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display font-bold">{f.name}</p>
                  <p className="text-sm text-muted">
                    {f.type} · {f.capacity}v{f.capacity}
                    {f.pricingMode === 'per_player'
                      ? ` · $${f.pricePerPlayer}/player`
                      : ` · $${f.fixedPrice} fixed`}
                    {f.openingTime && f.closingTime ? ` · ${f.openingTime}–${f.closingTime}` : ''}
                  </p>
                  {f.ops?.bookable === false && (
                    <p className="mt-1 text-xs font-semibold text-amber-700">{t('owner.fieldOffline')}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button as={Link} to={`/owner/slots?stadiumId=${stadiumId}&fieldId=${f._id}`} size="sm" variant="outline">
                    {t('owner.navSlots')}
                  </Button>
                  <Button size="sm" variant="secondary" icon={<FiEdit2 />} onClick={() => openEditField(f)}>
                    {t('owner.editField')}
                  </Button>
                  {f.ops?.bookable === false ? (
                    <Button size="sm" variant="outline" onClick={() => handleFieldOps(f, 'online')}>
                      {t('owner.goOnline')}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleFieldOps(f, 'offline')}>
                      {t('owner.goOffline')}
                    </Button>
                  )}
                  {isOwner && (
                    <Button size="sm" variant="danger" icon={<FiTrash2 />} onClick={() => handleDeleteField(f)}>
                      {t('owner.deleteField')}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'pricing' && (
        <Card className="mt-4 p-5">
          <p className="mb-3 text-sm text-muted">{t('owner.pricingHint')}</p>
          <ul className="space-y-2">
            {pricePreview.map((p) => (
              <li
                key={p.id}
                className="flex justify-between rounded-xl bg-warmwhite px-3 py-2 text-sm dark:bg-dark-surface-2"
              >
                <span>{p.name}</span>
                <span className="font-semibold">
                  ${p.teamShare.toFixed(2)} / team · ${p.total.toFixed(2)} match
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'blocks' && (
        <div className="mt-4 space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display font-bold">{t('owner.blocksListTitle')}</h2>
                <p className="mt-1 text-sm text-muted">{t('owner.blocksHint')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  label={t('owner.filterField')}
                  value={blockFilterField}
                  onChange={(e) => setBlockFilterField(e.target.value)}
                >
                  <option value="">{t('owner.allFields')}</option>
                  {fields.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
                <label className="flex items-center gap-2 pb-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={showPastBlocks}
                    onChange={(e) => setShowPastBlocks(e.target.checked)}
                    className="rounded border-border"
                  />
                  {t('owner.showPastBlocks')}
                </label>
              </div>
            </div>

            {blocksLoading ? (
              <p className="text-sm text-muted">{t('common.loading')}</p>
            ) : blocks.length === 0 ? (
              <p className="text-sm text-muted">{t('owner.noBlocks')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted dark:border-dark-border">
                      <th className="py-2 pr-3 font-semibold">{t('owner.field')}</th>
                      <th className="py-2 pr-3 font-semibold">{t('owner.blockType')}</th>
                      <th className="py-2 pr-3 font-semibold">{t('owner.startsAt')}</th>
                      <th className="py-2 pr-3 font-semibold">{t('owner.endsAt')}</th>
                      <th className="py-2 pr-3 font-semibold">{t('owner.reason')}</th>
                      <th className="py-2 pr-3 font-semibold">{t('owner.createdBy')}</th>
                      <th className="py-2 font-semibold">{t('owner.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((b) => (
                      <tr
                        key={b._id}
                        className="border-b border-border/60 last:border-0 dark:border-dark-border/60"
                      >
                        <td className="py-3 pr-3 font-medium">
                          {b.scope === 'stadium'
                            ? t('owner.wholeStadium')
                            : b.field?.name || '—'}
                        </td>
                        <td className="py-3 pr-3">{blockTypeLabel(b.type)}</td>
                        <td className="py-3 pr-3 whitespace-nowrap">{formatBlockWhen(b.startsAt)}</td>
                        <td className="py-3 pr-3 whitespace-nowrap">{formatBlockWhen(b.endsAt)}</td>
                        <td className="py-3 pr-3 text-muted">{b.reason || '—'}</td>
                        <td className="py-3 pr-3 text-muted">
                          {b.createdBy?.name || b.createdBy?.email || '—'}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              icon={<FiEdit2 />}
                              onClick={() => openEditBlock(b)}
                            >
                              {t('owner.editBlock')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              icon={<FiTrash2 />}
                              onClick={() => handleDeleteBlock(b)}
                            >
                              {t('owner.deleteBlock')}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-1 font-display font-bold">{t('owner.lockStadiumTitle')}</h2>
            <p className="mb-4 text-sm text-muted">{t('owner.lockStadiumHint')}</p>
            <form onSubmit={handleLockStadium} className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t('owner.blockType')}
                value={lockForm.type}
                onChange={(e) => setLockForm({ ...lockForm, type: e.target.value })}
              >
                <option value="owner_block">{t('owner.blockOwnerLock')}</option>
                <option value="weather">{t('owner.blockWeather')}</option>
                <option value="maintenance">{t('owner.blockMaintenance')}</option>
                <option value="holiday">{t('owner.blockHoliday')}</option>
                <option value="private_event">{t('owner.blockPrivate')}</option>
              </Select>
              <Input
                label={t('owner.reason')}
                value={lockForm.reason}
                onChange={(e) => setLockForm({ ...lockForm, reason: e.target.value })}
                placeholder={t('owner.lockReasonPh')}
              />
              <Input
                label={t('owner.startsAt')}
                type="datetime-local"
                value={lockForm.startsAt}
                onChange={(e) => setLockForm({ ...lockForm, startsAt: e.target.value })}
                required
              />
              <Input
                label={t('owner.endsAt')}
                type="datetime-local"
                value={lockForm.endsAt}
                onChange={(e) => setLockForm({ ...lockForm, endsAt: e.target.value })}
                required
              />
              <Button type="submit" loading={locking} className="sm:col-span-2">
                {t('owner.lockStadiumSubmit')}
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-display font-bold">{t('owner.createBlock')}</h2>
            <form onSubmit={handleBlockSlot} className="grid gap-3 sm:grid-cols-2">
              <Select
                label={t('owner.field')}
                value={blockForm.fieldId}
                onChange={(e) => setBlockForm({ ...blockForm, fieldId: e.target.value })}
                required
              >
                <option value="">—</option>
                {fields.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name}
                  </option>
                ))}
              </Select>
              <Select
                label={t('owner.blockType')}
                value={blockForm.type}
                onChange={(e) => setBlockForm({ ...blockForm, type: e.target.value })}
              >
                <option value="maintenance">{t('owner.blockMaintenance')}</option>
                <option value="weather">{t('owner.blockWeather')}</option>
                <option value="holiday">{t('owner.blockHoliday')}</option>
                <option value="private_event">{t('owner.blockPrivate')}</option>
              </Select>
              <Input
                label={t('owner.startsAt')}
                type="datetime-local"
                value={blockForm.startsAt}
                onChange={(e) => setBlockForm({ ...blockForm, startsAt: e.target.value })}
                required
              />
              <Input
                label={t('owner.endsAt')}
                type="datetime-local"
                value={blockForm.endsAt}
                onChange={(e) => setBlockForm({ ...blockForm, endsAt: e.target.value })}
                required
              />
              <Input
                containerClassName="sm:col-span-2"
                label={t('owner.reason')}
                value={blockForm.reason}
                onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                placeholder={t('owner.reasonPh')}
              />
              <Button type="submit" loading={blocking} className="sm:col-span-2">
                {t('owner.blockSubmit')}
              </Button>
            </form>
          </Card>
        </div>
      )}

      {tab === 'recurring' && (
        <Card className="mt-4 p-5">
          <p className="mb-4 text-sm text-muted">{t('owner.recurringHint')}</p>
          <form onSubmit={saveRecurring} className="grid gap-3 sm:grid-cols-2">
            <Select
              label={t('owner.field')}
              value={recForm.fieldId}
              onChange={(e) => setRecForm({ ...recForm, fieldId: e.target.value })}
              required
            >
              <option value="">—</option>
              {fields.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Input
              label={t('owner.teamName')}
              value={recForm.teamName}
              onChange={(e) => setRecForm({ ...recForm, teamName: e.target.value })}
              required
            />
            <Select
              label={t('owner.dayOfWeek')}
              value={recForm.dayOfWeek}
              onChange={(e) => setRecForm({ ...recForm, dayOfWeek: e.target.value })}
            >
              {DOW_KEYS.map((key, i) => (
                <option key={key} value={i}>
                  {t(`owner.${key}`)}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label={t('owner.from')}
                type="time"
                value={recForm.startTimeLocal}
                onChange={(e) => setRecForm({ ...recForm, startTimeLocal: e.target.value })}
              />
              <Input
                label={t('owner.to')}
                type="time"
                value={recForm.endTimeLocal}
                onChange={(e) => setRecForm({ ...recForm, endTimeLocal: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" loading={recBusy}>
                {editingRecurring ? t('owner.updateRecurring') : t('owner.saveRecurring')}
              </Button>
              {editingRecurring && (
                <Button type="button" variant="secondary" onClick={resetRecForm}>
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          </form>
          <ul className="mt-4 space-y-2 text-sm">
            {recurring.length === 0 && <li className="text-muted">{t('owner.noRecurring')}</li>}
            {recurring.map((r) => (
              <li
                key={r._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warmwhite px-3 py-2 dark:bg-dark-surface-2"
              >
                <span>
                  {r.teamName} · {t(`owner.${DOW_KEYS[r.dayOfWeek]}`)} {r.startTimeLocal}–{r.endTimeLocal}
                  {r.field?.name ? ` · ${r.field.name}` : ''}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-forest"
                    title={t('owner.editRecurring')}
                    onClick={() => startEditRecurring(r)}
                  >
                    <FiEdit2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="text-status-cancelled-text"
                    title={t('owner.deleteRecurring')}
                    onClick={() => removeRecurring(r._id)}
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'discounts' && (
        <Card className="mt-4 p-5">
          <p className="mb-4 text-sm text-muted">{t('owner.discountsHint')}</p>
          {isOwner && (
            <form onSubmit={addDiscount} className="mb-6 grid gap-3 sm:grid-cols-2">
              <Input
                label={t('owner.discountName')}
                value={discForm.name}
                onChange={(e) => setDiscForm({ ...discForm, name: e.target.value })}
                required
              />
              <Select
                label={t('owner.discountField')}
                value={discForm.fieldId}
                onChange={(e) => setDiscForm({ ...discForm, fieldId: e.target.value })}
              >
                <option value="">{t('owner.allFields')}</option>
                {fields.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name}
                  </option>
                ))}
              </Select>

              <Select
                label={t('owner.discountType')}
                value={discForm.type}
                onChange={(e) => setDiscForm({ ...discForm, type: e.target.value })}
              >
                <option value="percent">{t('owner.percentOff')}</option>
                <option value="amount">{t('owner.amountOff')}</option>
              </Select>
              {discForm.type === 'percent' ? (
                <Input
                  label={t('owner.percentOff')}
                  type="number"
                  min={1}
                  max={100}
                  value={discForm.percentOff}
                  onChange={(e) => setDiscForm({ ...discForm, percentOff: e.target.value })}
                  required
                />
              ) : (
                <Input
                  label={t('owner.amountOff')}
                  type="number"
                  min={0}
                  step="0.01"
                  value={discForm.amountOff}
                  onChange={(e) => setDiscForm({ ...discForm, amountOff: e.target.value })}
                  required
                />
              )}

              <Select
                label={t('owner.slotScope')}
                value={discForm.applyToAllSlots ? 'all' : 'match'}
                onChange={(e) =>
                  setDiscForm({ ...discForm, applyToAllSlots: e.target.value === 'all' })
                }
              >
                <option value="match">{t('owner.matchingSlots')}</option>
                <option value="all">{t('owner.allSlots')}</option>
              </Select>
              <div className="hidden sm:block" />

              <Input
                label={t('owner.validFrom')}
                type="date"
                value={discForm.validFrom}
                onChange={(e) => setDiscForm({ ...discForm, validFrom: e.target.value })}
              />
              <Input
                label={t('owner.validUntil')}
                type="date"
                value={discForm.validUntil}
                onChange={(e) => setDiscForm({ ...discForm, validUntil: e.target.value })}
              />

              {!discForm.applyToAllSlots && (
                <>
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      {t('owner.daysOfWeek')}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {DOW_KEYS.map((key, i) => {
                        const on = discForm.daysOfWeek.includes(i);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleDiscDay(i)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                              on
                                ? 'bg-forest text-white'
                                : 'bg-warmwhite text-muted dark:bg-dark-surface-2'
                            }`}
                          >
                            {t(`owner.${key}`)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-1 text-[11px] text-muted">{t('owner.daysHint')}</p>
                  </div>
                  <Input
                    label={t('owner.from')}
                    type="time"
                    value={discForm.startTimeLocal}
                    onChange={(e) => setDiscForm({ ...discForm, startTimeLocal: e.target.value })}
                  />
                  <Input
                    label={t('owner.to')}
                    type="time"
                    value={discForm.endTimeLocal}
                    onChange={(e) => setDiscForm({ ...discForm, endTimeLocal: e.target.value })}
                  />
                </>
              )}

              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" loading={discBusy}>
                  {editingDiscount ? t('owner.saveDiscount') : t('owner.addDiscount')}
                </Button>
                {editingDiscount && (
                  <Button type="button" variant="secondary" onClick={resetDiscForm}>
                    {t('common.cancel')}
                  </Button>
                )}
              </div>
            </form>
          )}
          <ul className="space-y-2 text-sm">
            {discounts.length === 0 && <li className="text-muted">{t('owner.noDiscounts')}</li>}
            {discounts.map((d) => {
              const fieldLabel = d.field
                ? fields.find((f) => f._id === (d.field._id || d.field))?.name || t('owner.oneField')
                : t('owner.allFields');
              const offLabel =
                d.percentOff != null ? `${d.percentOff}%` : d.amountOff != null ? `$${Number(d.amountOff).toFixed(2)}` : '—';
              const daysLabel =
                d.applyToAllSlots || !d.daysOfWeek?.length
                  ? t('owner.everyDay')
                  : d.daysOfWeek.map((i) => t(`owner.${DOW_KEYS[i]}`)).join(', ');
              const timeLabel = d.applyToAllSlots
                ? t('owner.allSlots')
                : d.startTimeLocal && d.endTimeLocal
                  ? `${d.startTimeLocal}–${d.endTimeLocal}`
                  : t('owner.allDay');
              const dateLabel =
                d.validFrom || d.validUntil
                  ? `${d.validFrom ? String(d.validFrom).slice(0, 10) : '…'} → ${
                      d.validUntil ? String(d.validUntil).slice(0, 10) : '…'
                    }`
                  : null;

              return (
                <li
                  key={d._id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warmwhite px-3 py-2 dark:bg-dark-surface-2"
                >
                  <div>
                    <strong>{d.name}</strong> · {offLabel} {t('owner.off')} · {fieldLabel}
                    <p className="text-xs text-muted">
                      {daysLabel} · {timeLabel}
                      {dateLabel ? ` · ${dateLabel}` : ''}
                    </p>
                  </div>
                  {isOwner && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-forest"
                        title={t('common.save')}
                        onClick={() => startEditDiscount(d)}
                      >
                        <FiEdit2 size={16} />
                      </button>
                      <button
                        type="button"
                        className="text-status-cancelled-text"
                        onClick={() => removeDiscount(d._id)}
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {tab === 'managers' && isOwner && (
        <Card className="mt-4 p-5">
          <p className="mb-4 text-sm text-muted">{t('owner.managersHint')}</p>
          <form onSubmit={inviteManager} className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Email"
              type="email"
              value={mgrForm.email}
              onChange={(e) => setMgrForm({ ...mgrForm, email: e.target.value })}
              required
            />
            <Input
              label={t('owner.managerName')}
              value={mgrForm.name}
              onChange={(e) => setMgrForm({ ...mgrForm, name: e.target.value })}
            />
            <Input
              label={t('owner.tempPassword')}
              value={mgrForm.password}
              onChange={(e) => setMgrForm({ ...mgrForm, password: e.target.value })}
              placeholder="optional"
            />
            <Button type="submit" loading={mgrBusy} className="sm:col-span-3">
              {t('owner.inviteManager')}
            </Button>
          </form>
          <ul className="mt-4 space-y-2">
            {managers.map((m) => (
              <li
                key={m._id}
                className="flex items-center justify-between rounded-xl bg-warmwhite px-3 py-2 text-sm dark:bg-dark-surface-2"
              >
                <span>
                  {m.user?.name || m.user?.email || m.email} · {m.status || 'active'}
                </span>
                <Button size="sm" variant="danger" onClick={() => revokeManager(m._id)}>
                  {t('owner.revoke')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'accept' && (
        <Card className="mt-4 p-5">
          <p className="mb-4 text-sm text-muted">{t('owner.acceptHint')}</p>
          <form onSubmit={saveAcceptMode} className="max-w-md space-y-4">
            <Select
              label={t('owner.acceptMode')}
              value={acceptMode}
              onChange={(e) => setAcceptMode(e.target.value)}
            >
              <option value="auto">{t('owner.acceptAuto')}</option>
              <option value="manual">{t('owner.acceptManual')}</option>
            </Select>
            <p className="rounded-xl bg-forest/5 px-3 py-2 text-xs text-muted">
              {acceptMode === 'manual' ? t('owner.acceptPreviewManual') : t('owner.acceptPreviewAuto')}
            </p>
            <Button type="submit" loading={acceptBusy}>
              {t('owner.saveAcceptMode')}
            </Button>
          </form>
        </Card>
      )}

      {tab === 'policy' && (
        <Card className="mt-4 p-6">
          <div className="mb-4">
            <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">
              Xeerka Ballanka & Beddelka Waqtiga (Booking Policy)
            </h3>
            <p className="mt-1 text-sm text-muted">
              Xeerarka beddelka waqtiga (reschedule), xayiraadaha ogeysiinta, lacag-celinta (refund), iyo aagga waqtiga garoonka (Timezone).
            </p>
          </div>

          <form onSubmit={savePolicy} className="max-w-2xl space-y-6">
            <div className="rounded-xl border border-border bg-warmwhite p-4 space-y-4 dark:bg-dark-surface dark:border-dark-border">
              <h4 className="font-semibold text-sm text-charcoal dark:text-dark-text">
                1. Beddelka Waqtiga (Rescheduling)
              </h4>

              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyForm.rescheduleAllowed}
                  onChange={(e) => setPolicyForm({ ...policyForm, rescheduleAllowed: e.target.checked })}
                  className="rounded border-border text-brand-green focus:ring-brand-green"
                />
                <span className="font-medium text-charcoal dark:text-dark-text">
                  U oggolow kooxaha inay codsadaan beddelka waqtiga (Reschedule)
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted">
                    Waqtiga Bilaashka ah (Saacado ka hor ciyaarta)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={policyForm.freeRescheduleWindowHours}
                    onChange={(e) => setPolicyForm({ ...policyForm, freeRescheduleWindowHours: e.target.value })}
                    className="mt-1"
                  />
                  <span className="mt-1 block text-2xs text-muted">
                    Haddii uu ka badan yahay intan (tusaale 24 saac), beddelku waa $0 bilaash.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted">
                    Kharashka Beddelka ($ USD)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={policyForm.rescheduleFee}
                    onChange={(e) => setPolicyForm({ ...policyForm, rescheduleFee: e.target.value })}
                    className="mt-1"
                  />
                  <span className="mt-1 block text-2xs text-muted">
                    Kharashka laga qaadayo haddii la beddelo inta u dhaxaysa waqtiga bilaashka iyo waqtiga ugu yar.
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">
                  Ogeysiiska Ugu Yar Ee La Oggol Yahay (Saacado)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="1"
                  max="168"
                  value={policyForm.minRescheduleNoticeHours}
                  onChange={(e) => setPolicyForm({ ...policyForm, minRescheduleNoticeHours: e.target.value })}
                  className="mt-1"
                />
                <span className="mt-1 block text-2xs text-muted">
                  Wax ka yar saacadahan (tusaale 6 saac), kooxdu ma beddeli karto iyada oo aan maamulaha la xiriirin.
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-warmwhite p-4 space-y-4 dark:bg-dark-surface dark:border-dark-border">
              <h4 className="font-semibold text-sm text-charcoal dark:text-dark-text">
                2. Kansalaashada & Lacag-celinta (Cancellations & Refunds)
              </h4>

              <label className="flex items-center gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyForm.cancellationAllowed}
                  onChange={(e) => setPolicyForm({ ...policyForm, cancellationAllowed: e.target.checked })}
                  className="rounded border-border text-brand-green focus:ring-brand-green"
                />
                <span className="font-medium text-charcoal dark:text-dark-text">
                  U oggolow kooxaha inay kansali karaan ballanka
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-muted">
                    Ogeysiiska Lacag-celinta (Saacado)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={policyForm.cancelRefundWindowHours}
                    onChange={(e) => setPolicyForm({ ...policyForm, cancelRefundWindowHours: e.target.value })}
                    className="mt-1"
                  />
                  <span className="mt-1 block text-2xs text-muted">
                    Saacadaha ka hor ciyaarta ee lacag celinta lagu bixinayo (tusaale 24 saac).
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted">
                    Boqolkiiba Lacag-celinta (% Refund)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={policyForm.cancelRefundPercent}
                    onChange={(e) => setPolicyForm({ ...policyForm, cancelRefundPercent: e.target.value })}
                    className="mt-1"
                  />
                  <span className="mt-1 block text-2xs text-muted">
                    Boqolkiiba inta lacagta laga celinayo (tusaale 100% ama 80%).
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-warmwhite p-4 space-y-4 dark:bg-dark-surface dark:border-dark-border">
              <h4 className="font-semibold text-sm text-charcoal dark:text-dark-text">
                3. Aagga Waqtiga (Timezone / GMT)
              </h4>

              <div>
                <label className="text-xs font-semibold text-muted">Venue Timezone</label>
                <Input
                  type="text"
                  value={policyForm.venueTimeZone}
                  readOnly
                  disabled
                  className="mt-1 bg-gray-100 dark:bg-dark-surface"
                />
                <span className="mt-1 block text-2xs text-muted">
                  Waqtiga garoomada Somaliland iyo Bariga Afrika waa <strong>Waqtiga Bariga Afrika (GMT+3 / EAT)</strong> si looga fogaado isku-dhexyaaca saacadaha.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted">Fariinta Ogeysiiska Ee Kooxaha (Af-Soomaali)</label>
                <Textarea
                  rows={2}
                  value={policyForm.policyNoticeSo}
                  onChange={(e) => setPolicyForm({ ...policyForm, policyNoticeSo: e.target.value })}
                  placeholder="Xeer gaar ah oo aad rabto inay ciyaartoydu arkaan marka ay ballansanayaan..."
                  className="mt-1"
                />
              </div>
            </div>

            <Button type="submit" loading={policyBusy}>
              Keydi Xeerka Garoonka
            </Button>
          </form>
        </Card>
      )}

      {tab === 'payout' && isOwner && (
        <Card className="mt-4 p-5">
          <p className="mb-4 text-sm text-muted">{t('owner.payoutHint')}</p>
          <form onSubmit={savePayoutPolicy} className="max-w-md space-y-4">
            <Select
              label={t('owner.payoutWhen')}
              value={payoutMode}
              onChange={(e) => {
                const mode = e.target.value;
                setPayoutMode(mode);
                setPayoutMinutes(mode === 'fixed_hours' ? 1440 : 20);
              }}
            >
              <option value="after_match">{t('owner.payoutAfterMatch')}</option>
              <option value="fixed_hours">{t('owner.payout24h')}</option>
            </Select>
            {payoutMode === 'after_match' && (
              <Select
                label={t('owner.payoutDelay')}
                value={payoutMinutes}
                onChange={(e) => setPayoutMinutes(Number(e.target.value))}
              >
                <option value={20}>20 {t('owner.minutes')}</option>
                <option value={30}>30 {t('owner.minutes')}</option>
                <option value={60}>60 {t('owner.minutes')}</option>
                <option value={75}>75 {t('owner.minutes')}</option>
              </Select>
            )}
            <p className="rounded-xl bg-forest/5 px-3 py-2 text-xs text-muted">
              {payoutMode === 'fixed_hours'
                ? t('owner.payoutPreview24')
                : t('owner.payoutPreviewMatch', { m: payoutMinutes })}
            </p>
            <Button type="submit" loading={payoutBusy}>
              {t('owner.savePayout')}
            </Button>
          </form>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setEditingField(null);
          setForm(emptyField);
        }}
        title={editingField ? t('owner.editField') : t('owner.addField')}
      >
        <form onSubmit={handleSaveField} className="space-y-3">
          <Input
            label={t('owner.fieldName')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => {
                const type = e.target.value;
                setForm({ ...form, type, capacity: capacityForType(type) });
              }}
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {ft} ({capacityForType(ft)})
                </option>
              ))}
            </Select>
            <Input label={t('owner.capacity')} type="number" value={form.capacity} readOnly disabled />
          <Select
            label={t('owner.pricingMode')}
            value={form.pricingMode}
            onChange={(e) => setForm({ ...form, pricingMode: e.target.value })}
          >
            <option value="per_player">Per player</option>
            <option value="fixed">Fixed match</option>
          </Select>
          {form.pricingMode === 'per_player' ? (
            <Input
              label="$ / player"
              type="number"
              value={form.pricePerPlayer}
              onChange={(e) => setForm({ ...form, pricePerPlayer: e.target.value })}
            />
          ) : (
            <Input
              label="Fixed $"
              type="number"
              value={form.fixedPrice}
              onChange={(e) => setForm({ ...form, fixedPrice: e.target.value })}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t('owner.opens')}
              type="time"
              value={form.openingTime}
              onChange={(e) => setForm({ ...form, openingTime: e.target.value })}
            />
            <Input
              label={t('owner.closes')}
              type="time"
              value={form.closingTime}
              onChange={(e) => setForm({ ...form, closingTime: e.target.value })}
            />
          </div>
          <MediaUpload
            folder="fields"
            accept="image/*,video/*"
            multiple
            maxFiles={6}
            label={t('owner.fieldImages')}
            value={form.images}
            onChange={(next) => setForm({ ...form, images: next })}
          />
          <Button type="submit" className="w-full" loading={saving}>
            {t('common.save')}
          </Button>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingBlock)}
        onClose={() => setEditingBlock(null)}
        title={t('owner.editBlock')}
      >
        <form onSubmit={handleUpdateBlock} className="space-y-3">
          <p className="text-sm text-muted">
            {editingBlock?.field?.name || t('owner.field')}
          </p>
          <Select
            label={t('owner.blockType')}
            value={editForm.type}
            onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
          >
            <option value="maintenance">{t('owner.blockMaintenance')}</option>
            <option value="weather">{t('owner.blockWeather')}</option>
            <option value="holiday">{t('owner.blockHoliday')}</option>
            <option value="private_event">{t('owner.blockPrivate')}</option>
            <option value="tournament">{t('owner.blockTournament')}</option>
          </Select>
          <Input
            label={t('owner.startsAt')}
            type="datetime-local"
            value={editForm.startsAt}
            onChange={(e) => setEditForm({ ...editForm, startsAt: e.target.value })}
            required
          />
          <Input
            label={t('owner.endsAt')}
            type="datetime-local"
            value={editForm.endsAt}
            onChange={(e) => setEditForm({ ...editForm, endsAt: e.target.value })}
            required
          />
          <Input
            label={t('owner.reason')}
            value={editForm.reason}
            onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
            placeholder={t('owner.reasonPh')}
          />
          <Button type="submit" className="w-full" loading={editBusy}>
            {t('owner.saveBlock')}
          </Button>
        </form>
      </Modal>
    </PageTransition>
  );
}
