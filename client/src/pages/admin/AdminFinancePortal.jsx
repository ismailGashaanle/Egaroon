import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Wallet, 
  ArrowUpRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  ShieldCheck, 
  FileText, 
  Smartphone, 
  RefreshCw,
  Search,
  Filter,
  Eye,
  Settings,
  Send
} from 'lucide-react';
import { adminApi } from '../../api/adminApi';

const PAYOUT_LABELS = {
  telesom_zaad: 'Telesom ZAAD',
  hormuud_evc: 'Hormuud EVC',
  somtel_edahab: 'Somtel eDahab',
  golis_sahal: 'Golis SAHAL',
};

export default function AdminFinancePortal() {
  const [activeTab, setActiveTab] = useState('withdrawals'); // 'withdrawals' | 'kyc' | 'master_accounts'
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [kycList, setKycList] = useState([]);
  const [masterAccounts, setMasterAccounts] = useState({ telesom: {}, somtel: {} });
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Approval modal state
  const [approveModal, setApproveModal] = useState({ open: false, item: null, ref: '', masterAcc: 'telesom_zaad' });
  const [rejectModal, setRejectModal] = useState({ open: false, item: null, reason: '' });
  const [submittingAction, setSubmittingAction] = useState(false);

  // KYC review modal
  const [kycModal, setKycModal] = useState({ open: false, item: null, action: 'approve', reason: '' });

  // Master accounts edit state
  const [editAccounts, setEditAccounts] = useState(null);
  const [savingAccounts, setSavingAccounts] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ovRes, wthRes, kycRes, accRes] = await Promise.all([
        adminApi.getFinanceOverview().catch(() => ({ success: false })),
        adminApi.listFinanceWithdrawals({ status: statusFilter }).catch(() => ({ success: false, data: [] })),
        adminApi.listFinanceKyc().catch(() => ({ success: false, data: [] })),
        adminApi.getMasterAccounts().catch(() => ({ success: false, data: {} }))
      ]);

      const payload = (r) => (r?.data?.success ? r.data.data : null);
      const overviewData = payload(ovRes);
      const withdrawalsData = payload(wthRes);
      const kycData = payload(kycRes);
      const accountsData = payload(accRes);
      if (overviewData) setOverview(overviewData);
      if (withdrawalsData) setWithdrawals(withdrawalsData.withdrawals || []);
      if (kycData) setKycList(kycData.users || []);
      if (accountsData) {
        setMasterAccounts(accountsData.masterAccounts || {});
        setEditAccounts(accountsData.masterAccounts || {});
      }
    } catch (err) {
      console.error('Failed to load finance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleApproveWithdrawal = async (e) => {
    e.preventDefault();
    if (!approveModal.ref.trim()) {
      alert('Fadlan geli lambarka tixraaca xawaaladda (Disbursement Reference)');
      return;
    }
    setSubmittingAction(true);
    try {
      const res = await adminApi.approveWithdrawal(approveModal.item._id, {
        disbursementReference: approveModal.ref,
        masterAccountUsed: approveModal.masterAcc === 'telesom_zaad' ? 'E-Garoon Master ZAAD' : 'E-Garoon Master eDahab'
      });
      if (res.data?.success) {
        setFeedback({ type: 'success', message: 'Lacag-bixinta si guul leh ayaa loo ansixiyay loona gudbiyay!' });
        setApproveModal({ open: false, item: null, ref: '', masterAcc: 'telesom_zaad' });
        loadData();
      } else {
        alert(res.data?.error?.message || 'Khalad ayaa dhacay');
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Khalad ayaa dhacay');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleRejectWithdrawal = async (e) => {
    e.preventDefault();
    if (!rejectModal.reason.trim()) {
      alert('Fadlan geli sababta loo diiday');
      return;
    }
    setSubmittingAction(true);
    try {
      const res = await adminApi.rejectWithdrawal(rejectModal.item._id, {
        reason: rejectModal.reason
      });
      if (res.data?.success) {
        setFeedback({ type: 'success', message: 'Codsiga xawaaladda waa la diiday, lacagtana waxaa dib loogu celiyay Available Balance-ka mulkiilaha.' });
        setRejectModal({ open: false, item: null, reason: '' });
        loadData();
      } else {
        alert(res.data?.error?.message || 'Khalad ayaa dhacay');
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Khalad ayaa dhacay');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReviewKyc = async (e) => {
    e.preventDefault();
    setSubmittingAction(true);
    try {
      const res = await adminApi.reviewKyc(kycModal.item._id, {
        status: kycModal.action === 'approve' ? 'verified' : 'rejected',
        rejectionReason: kycModal.action === 'reject' ? kycModal.reason : undefined
      });
      if (res.data?.success) {
        setFeedback({ 
          type: 'success', 
          message: kycModal.action === 'approve' ? 'Mulkiilaha si rasmi ah ayaa loo aqoonsaday (KYC Verified)!' : 'Aqoonsiga mulkiilaha waa la diiday.' 
        });
        setKycModal({ open: false, item: null, action: 'approve', reason: '' });
        loadData();
      } else {
        alert(res.data?.error?.message || 'Khalad ayaa dhacay');
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Khalad ayaa dhacay');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleSaveMasterAccounts = async (e) => {
    e.preventDefault();
    setSavingAccounts(true);
    try {
      const res = await adminApi.updateMasterAccounts({ masterAccounts: editAccounts });
      if (res.data?.success) {
        setFeedback({ type: 'success', message: 'Akoonnada guud ee E-Garoon si guul leh ayaa loo cusbooneysiiyay!' });
        setMasterAccounts(editAccounts);
      } else {
        alert(res.data?.error?.message || 'Khalad ayaa dhacay');
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || err.message || 'Khalad ayaa dhacay');
    } finally {
      setSavingAccounts(false);
    }
  };

  const filteredWithdrawals = withdrawals.filter(w => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      w.reference?.toLowerCase().includes(term) ||
      w.payoutPhone?.toLowerCase().includes(term) ||
      w.owner?.name?.toLowerCase().includes(term) ||
      w.stadium?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                Waaxda Maaliyadda & Xawaaladaha (Finance & Payouts)
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Nidaamka Dhexe ee Lacag-qabashada E-Garoon, Hubinta Xisaabaadka, & Bixinta Lacagaha Garoomada
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={loadData}
          disabled={loading}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          Cusbooneysii Xogta
        </button>
      </div>

      {feedback && (
        <div className={`mb-6 p-4 rounded-xl border flex items-center justify-between ${feedback.type === 'success' ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300' : 'bg-rose-950/60 border-rose-500/50 text-rose-300'}`}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{feedback.message}</p>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs hover:underline">Xidh</button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Escrow / Xisaabta Dhexe</span>
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><Clock className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-extrabold text-white">${overview?.heldInEscrow?.toFixed(2) || '0.00'}</div>
          <p className="text-xs text-slate-400 mt-1">Lacagaha haysta E-Garoon ee la sugayo ciyaarta</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Codsiyada Sugaya Bixinta</span>
            <span className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><ArrowUpRight className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-extrabold text-white">${overview?.pendingPayouts?.toFixed(2) || '0.00'}</div>
          <p className="text-xs text-slate-400 mt-1">{overview?.pendingPayoutCount || 0} codsi oo u baahan oggolaansho</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Wadarta La Bixiyay</span>
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-extrabold text-white">${overview?.completedPayouts?.toFixed(2) || '0.00'}</div>
          <p className="text-xs text-slate-400 mt-1">Lagu shubay Zaad / eDahab mulkiilayaasha</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">Mulkiilayaasha Sugaya KYC</span>
            <span className="p-2 rounded-lg bg-purple-500/10 text-purple-400"><ShieldCheck className="w-4 h-4" /></span>
          </div>
          <div className="text-3xl font-extrabold text-white">{overview?.pendingKycCount || 0}</div>
          <p className="text-xs text-slate-400 mt-1">Liisan ama ID u baahan hubin maaliyadeed</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`pb-3 px-4 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${activeTab === 'withdrawals' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Codsiyada Lacag-bixinta (Payouts Queue)
          {overview?.pendingPayoutCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300 font-bold">
              {overview.pendingPayoutCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('kyc')}
          className={`pb-3 px-4 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${activeTab === 'kyc' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          Hubinta Aqoonsiga Mulkiilaha (Owner KYC)
          {overview?.pendingKycCount > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-300 font-bold">
              {overview.pendingKycCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('master_accounts')}
          className={`pb-3 px-4 text-sm font-semibold transition border-b-2 flex items-center gap-2 ${activeTab === 'master_accounts' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Settings className="w-4 h-4" />
          Akoonnada Guud ee E-Garoon (Zaad & eDahab)
        </button>
      </div>

      {/* TAB 1: WITHDRAWALS QUEUE */}
      {activeTab === 'withdrawals' && (
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Raadi tixraaca, taleefanka, mulkiilaha..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="">Dhammaan Xaaladaha</option>
                <option value="pending_approval">Sugaya Ansixin (Pending Approval)</option>
                <option value="completed">La Bixiyay (Completed)</option>
                <option value="rejected">La Diiday (Rejected)</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-900/80 text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="py-3 px-4">Tixraac</th>
                  <th className="py-3 px-4">Garoonka & Mulkiilaha</th>
                  <th className="py-3 px-4">Lacagta ($)</th>
                  <th className="py-3 px-4">Akoonka / Habka</th>
                  <th className="py-3 px-4">Xaaladda</th>
                  <th className="py-3 px-4">Taariikhda</th>
                  <th className="py-3 px-4 text-right">Ficil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-500">
                      Wax codsi ah lagama helin liiskan.
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((item) => (
                    <tr key={item._id} className="hover:bg-slate-750/50 transition">
                      <td className="py-4 px-4 font-mono font-medium text-emerald-400 text-xs">
                        {item.reference}
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-semibold text-white">{item.stadium?.name || 'Garoon aan la aqoon'}</div>
                        <div className="text-xs text-slate-400">{item.owner?.name} • {item.owner?.phone}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-white text-base">${item.amount?.toFixed(2)}</div>
                        <div className="text-xs text-slate-400">SLSH {item.amountSlsh?.toLocaleString()}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="capitalize text-xs font-semibold px-2 py-0.5 rounded bg-slate-750 border border-slate-700 inline-block text-amber-300 mb-1">
                          {PAYOUT_LABELS[item.payoutMethod] || item.payoutMethod}
                        </div>
                        <div className="font-mono text-xs text-slate-200">{item.payoutPhone}</div>
                        <div className="text-xs text-slate-400">{item.payoutAccountName}</div>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                          item.status === 'rejected' ? 'bg-rose-500/20 text-rose-400' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {item.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {item.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                          {item.status === 'pending_approval' && <Clock className="w-3.5 h-3.5" />}
                          {item.status === 'completed' ? 'La Bixiyay' :
                           item.status === 'rejected' ? 'La Diiday' : 'Sugaya Ansixin'}
                        </span>
                        {item.disbursementReference && (
                          <div className="text-xs font-mono text-slate-400 mt-1">Ref: {item.disbursementReference}</div>
                        )}
                        {item.rejectionReason && (
                          <div className="text-xs text-rose-400 mt-1">Sabab: {item.rejectionReason}</div>
                        )}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString('so-SO', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-4 px-4 text-right">
                        {item.status === 'pending_approval' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setApproveModal({ open: true, item, ref: '', masterAcc: item.payoutMethod === 'somtel_edahab' ? 'somtel_edahab' : 'telesom_zaad' })}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition shadow-md shadow-emerald-700/20"
                            >
                              Ansihi & Bixi
                            </button>
                            <button
                              onClick={() => setRejectModal({ open: true, item, reason: '' })}
                              className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition"
                            >
                              Diid
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Dhameystiran</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: OWNER KYC REVIEW */}
      {activeTab === 'kyc' && (
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 shadow-xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white mb-1">Hubinta Aqoonsiyada Mulkiilayaasha Garoomada</h2>
            <p className="text-sm text-slate-400">
              Mulkiile kasta waa in la xaqiijiyaa sharcigiisa ganacsi (Liisan) ama Kaarkiisa Aqoonsiga Qaran ka hor inta aanu xawaalad la bixi karin.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kycList.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500">
                Ma jiraan mulkiilayaal hadda KYC u soo gudbiyay.
              </div>
            ) : (
              kycList.map(owner => (
                <div key={owner._id} className="bg-slate-900/90 border border-slate-700 rounded-xl p-5 shadow flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-white text-base">{owner.name}</h3>
                        <p className="text-xs text-slate-400">{owner.phone} • {owner.email}</p>
                        {owner.selfRegistered && (
                          <span className="mt-1.5 inline-block rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-300">
                            Self-registered owner
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                        owner.kyc?.status === 'verified' ? 'bg-emerald-500/20 text-emerald-400' :
                        owner.kyc?.status === 'rejected' ? 'bg-rose-500/20 text-rose-400' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {owner.kyc?.status || 'unsubmitted'}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800 pt-3">
                      {owner.selfRegistered && (
                        <div className="rounded-lg bg-slate-800/70 px-3 py-2 text-slate-300">
                          Stadiums submitted: <strong className="text-white">{owner.stadiumCount || 0}</strong>
                          {owner.pendingStadiumCount > 0 && (
                            <span className="text-amber-300"> · {owner.pendingStadiumCount} go live when you verify this owner</span>
                          )}
                        </div>
                      )}
                      <div>
                        <span className="text-slate-500 block">Nooca Aqoonsiga:</span>
                        <span className="font-semibold">{owner.kyc?.idType === 'business_license' ? 'Liisanka Ganacsiga (Business License)' : 'Kaarka Aqoonsiga Qaran (National ID)'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Lambarka Sharciga:</span>
                        <span className="font-mono text-emerald-400">{owner.kyc?.idNumber || 'Lama gelin'}</span>
                      </div>
                      {owner.kyc?.businessName && (
                        <div>
                          <span className="text-slate-500 block">Magaca Ganacsiga:</span>
                          <span>{owner.kyc?.businessName}</span>
                        </div>
                      )}
                      {owner.kyc?.documentUrl && (
                        <div className="pt-2">
                          <a
                            href={owner.kyc?.documentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 underline font-medium"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Eeg Faylka/Sawirka Dukumintiga
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800 flex items-center justify-end gap-2">
                    {owner.kyc?.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => setKycModal({ open: true, item: owner, action: 'approve', reason: '' })}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                        >
                          Xaqiiji (Verify)
                        </button>
                        <button
                          onClick={() => setKycModal({ open: true, item: owner, action: 'reject', reason: '' })}
                          className="px-3 py-1.5 bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition"
                        >
                          Diid (Reject)
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {owner.kyc?.status === 'verified' ? 'Waa la xaqiijiyay' : 'Waa la diiday'}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MASTER COLLECTION ACCOUNTS */}
      {activeTab === 'master_accounts' && editAccounts && (
        <div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 shadow-xl max-w-4xl">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white mb-1">Akoonnada Guud ee Lacag-qabashada (Master Escrow Accounts)</h2>
            <p className="text-sm text-slate-400">
              Kuwani waa labada akoon ee rasmiga ah (Telesom ZAAD & Somtel eDahab) ee dhammaan lacagaha ballansashada garoomada ay ku soo dhacayaan (sida Uber oo kale).
            </p>
          </div>

          <form onSubmit={handleSaveMasterAccounts} className="space-y-6">
            {/* Telesom Zaad */}
            <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  ZAAD
                </div>
                <div>
                  <h3 className="font-bold text-white">Telesom ZAAD (Master Collection Account)</h3>
                  <p className="text-xs text-slate-400">Akoonka dhexe ee ZAAD Merchant & Lacag-qabashada</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Merchant Code</label>
                  <input
                    type="text"
                    value={editAccounts.telesom?.merchantNumber || ''}
                    onChange={(e) => setEditAccounts({
                      ...editAccounts,
                      telesom: { ...editAccounts.telesom, merchantNumber: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Taleefanka / Akoonka</label>
                  <input
                    type="text"
                    value={editAccounts.telesom?.accountNumber || ''}
                    onChange={(e) => setEditAccounts({
                      ...editAccounts,
                      telesom: { ...editAccounts.telesom, accountNumber: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Magaca Akoonka</label>
                  <input
                    type="text"
                    value={editAccounts.telesom?.accountName || ''}
                    onChange={(e) => setEditAccounts({
                      ...editAccounts,
                      telesom: { ...editAccounts.telesom, accountName: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Somtel eDahab */}
            <div className="bg-slate-900/80 border border-teal-500/30 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 font-bold">
                  ED
                </div>
                <div>
                  <h3 className="font-bold text-white">Somtel eDahab (Master Collection Account)</h3>
                  <p className="text-xs text-slate-400">Akoonka dhexe ee eDahab Merchant & Lacag-qabashada</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Agent / Merchant ID</label>
                  <input
                    type="text"
                    value={editAccounts.somtel?.merchantNumber || ''}
                    onChange={(e) => setEditAccounts({
                      ...editAccounts,
                      somtel: { ...editAccounts.somtel, merchantNumber: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Taleefanka / Akoonka</label>
                  <input
                    type="text"
                    value={editAccounts.somtel?.accountNumber || ''}
                    onChange={(e) => setEditAccounts({
                      ...editAccounts,
                      somtel: { ...editAccounts.somtel, accountNumber: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Magaca Akoonka</label>
                  <input
                    type="text"
                    value={editAccounts.somtel?.accountName || ''}
                    onChange={(e) => setEditAccounts({
                      ...editAccounts,
                      somtel: { ...editAccounts.somtel, accountName: e.target.value }
                    })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={savingAccounts}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-700/20 disabled:opacity-50"
              >
                {savingAccounts ? 'Keydinayaa...' : 'Keydi Akoonnada Guud'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* APPROVE PAYOUT MODAL */}
      {approveModal.open && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Ansixinta Lacag-bixinta (Payout Disbursement)</h3>
            <p className="text-xs text-slate-400 mb-4">
              Xaqiiji inaad lacagtan (${approveModal.item?.amount?.toFixed(2)}) ka wareejisay akoonka dhexe ee E-Garoon kuna shubtay akoonka mulkiilaha.
            </p>

            <form onSubmit={handleApproveWithdrawal} className="space-y-4">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 text-xs space-y-1">
                <div><span className="text-slate-400">Mulkiilaha:</span> <strong className="text-white">{approveModal.item?.owner?.name}</strong></div>
                <div><span className="text-slate-400">Taleefanka:</span> <strong className="text-white">{approveModal.item?.payoutPhone}</strong></div>
                <div><span className="text-slate-400">Habka:</span> <strong className="text-amber-400 uppercase">{approveModal.item?.payoutMethod}</strong></div>
                <div><span className="text-slate-400">Lacagta:</span> <strong className="text-emerald-400 text-base">${approveModal.item?.amount?.toFixed(2)}</strong></div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Akoonka Dhexe ee Lacagtu Ka Baxday</label>
                <select
                  value={approveModal.masterAcc}
                  onChange={(e) => setApproveModal({ ...approveModal, masterAcc: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                >
                  <option value="telesom_zaad">Telesom Master ZAAD ({masterAccounts.telesom?.merchantNumber || '202020'})</option>
                  <option value="somtel_edahab">Somtel Master eDahab ({masterAccounts.somtel?.merchantNumber || 'ED-7070'})</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lambarka Tixraaca Xawaaladda (Disbursement Reference / SMS Ref) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Tusaale: TR-ZAAD-884920 ama eDahab TxID"
                  value={approveModal.ref}
                  onChange={(e) => setApproveModal({ ...approveModal, ref: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setApproveModal({ open: false, item: null, ref: '', masterAcc: 'telesom_zaad' })}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-600 transition"
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {submittingAction ? 'Ansixinayaa...' : 'Xaqiiji Bixinta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT PAYOUT MODAL */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Diidmada Codsiga Xawaaladda</h3>
            <p className="text-xs text-slate-400 mb-4">
              Haddii aad codsigan diiddo, lacagta (${rejectModal.item?.amount?.toFixed(2)}) waxay si toos ah ugu laabanaysaa Available Balance-ka mulkiilaha.
            </p>

            <form onSubmit={handleRejectWithdrawal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Sababta loo diiday *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Geli sababta diidmada (tusaale: Akoonka mulkiilaha wuu qaldan yahay ama magaca ma qabto)..."
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setRejectModal({ open: false, item: null, reason: '' })}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-600 transition"
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {submittingAction ? 'Diidayaa...' : 'Xaqiiji Diidmada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* KYC REVIEW MODAL */}
      {kycModal.open && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">
              {kycModal.action === 'approve' ? 'Xaqiijinta Sharciga Ganacsi ee Mulkiilaha' : 'Diidmada Sharciga Mulkiilaha'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Mulkiilaha: <strong>{kycModal.item?.name}</strong> ({kycModal.item?.phone})
            </p>
            {kycModal.action === 'approve' && kycModal.item?.selfRegistered && (
              <p className="mb-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                Verifying this owner makes their {kycModal.item?.pendingStadiumCount || 0} submitted stadium(s) visible
                in the public list and unlocks payments, subscriptions and withdrawals.
              </p>
            )}

            <form onSubmit={handleReviewKyc} className="space-y-4">
              {kycModal.action === 'reject' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Sababta loo diiday *</label>
                  <textarea
                    required
                    rows="3"
                    placeholder="Qor sababta sharciga/ID-ga loo diiday..."
                    value={kycModal.reason}
                    onChange={(e) => setKycModal({ ...kycModal, reason: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-white focus:border-rose-500"
                  />
                </div>
              )}

              {kycModal.action === 'approve' && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs text-emerald-300">
                  Ma hubtaa in dukumintiyada mulkiilaha aad xaqiijisay oo uu u qalmo inuu xawaalado la baxo?
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setKycModal({ open: false, item: null, action: 'approve', reason: '' })}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-600 transition"
                >
                  Ka noqo
                </button>
                <button
                  type="submit"
                  disabled={submittingAction}
                  className={`px-5 py-2 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 ${
                    kycModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {submittingAction ? 'Gudbinayaa...' : kycModal.action === 'approve' ? 'Haa, Xaqiiji' : 'Xaqiiji Diidmada'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
