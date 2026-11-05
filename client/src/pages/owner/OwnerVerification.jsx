import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiCircle, FiHome, FiFileText, FiShield } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import MediaUpload from '../../components/common/MediaUpload';
import { ownerApi } from '../../api/ownerApi';
import { stadiumApi } from '../../api/stadiumApi';
import { authApi } from '../../api/authApi';
import { setUser } from '../../features/auth/authSlice';
import { useAuth } from '../../hooks/useAuth';
import { toastApiError } from '../../lib/support';

const STATUS_COPY = {
  verification_required: { tone: 'warning', label: 'Verification required' },
  under_review: { tone: 'info', label: 'Under review' },
  rejected: { tone: 'danger', label: 'Not approved' },
  verified: { tone: 'success', label: 'Verified' },
};

function Step({ done, title, children }) {
  return (
    <div className="flex gap-3">
      <span className={done ? 'text-emerald-600' : 'text-muted'}>{done ? <FiCheckCircle size={20} /> : <FiCircle size={20} />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

export default function OwnerVerification() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const status = user?.verificationStatus || 'not_required';
  const kyc = user?.kyc || {};
  const locked = status === 'under_review' || status === 'verified';

  const [stadiums, setStadiums] = useState([]);
  const [form, setForm] = useState({
    idType: kyc.idType || 'national_id',
    idNumber: kyc.idNumber || '',
    businessName: kyc.businessName || '',
    documentUrl: kyc.documentUrl || '',
    payoutOperator: user?.payoutAccount?.operator || 'telesom',
    payoutAccountNumber: user?.payoutAccount?.accountNumber || user?.phone || '',
    payoutAccountName: user?.payoutAccount?.accountName || user?.name || '',
  });
  const [submitting, setSubmitting] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.me();
      dispatch(setUser(res.data.data.user));
    } catch {
      /* keep the cached user */
    }
  }, [dispatch]);

  useEffect(() => {
    refreshUser();
    stadiumApi
      .list({ mine: 'true' })
      .then((res) => setStadiums(res.data?.data?.stadiums || []))
      .catch(() => setStadiums([]));
  }, [refreshUser]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.idNumber.trim() || !form.documentUrl.trim()) {
      toast.error('Enter your ID number and upload your ID document.');
      return;
    }
    setSubmitting(true);
    try {
      await ownerApi.submitKyc({
        idType: form.idType,
        idNumber: form.idNumber.trim(),
        businessName: form.businessName.trim() || undefined,
        documentUrl: form.documentUrl.trim(),
        payoutAccountNumber: form.payoutAccountNumber.trim() || undefined,
        payoutAccountName: form.payoutAccountName.trim() || undefined,
      });
      toast.success('Documents submitted. E-Garoon will review your account.');
      await refreshUser();
    } catch (err) {
      toastApiError(err, 'Could not submit your documents');
    } finally {
      setSubmitting(false);
    }
  };

  const badge = STATUS_COPY[status];
  const hasStadium = stadiums.length > 0;

  return (
    <PageTransition>
      <PageHeader
        title="Account verification"
        description="Complete these steps. Once E-Garoon verifies your account your stadium goes live and payments unlock."
        actions={badge ? <Badge variant={badge.tone}>{badge.label}</Badge> : null}
      />

      {status === 'not_required' && (
        <Card className="p-5 text-sm text-muted">Your account was set up by E-Garoon and is already verified.</Card>
      )}

      {status === 'verified' && (
        <Card className="mb-6 p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
            <FiShield /> Your account is verified. Your stadiums are visible and payments are unlocked.
          </p>
        </Card>
      )}

      {status === 'rejected' && kyc.rejectionReason && (
        <Card className="mb-6 border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          <strong>Not approved:</strong> {kyc.rejectionReason}. Update your documents below and submit again.
        </Card>
      )}

      {status !== 'not_required' && (
        <Card className="space-y-8 p-5 sm:p-6">
          <Step done title="1. Create your account">
            <p className="text-xs text-muted">Done. You are signed in as {user?.email}.</p>
          </Step>

          <Step done={Boolean(kyc.documentUrl && kyc.idNumber && status !== 'verification_required')} title="2. Identity documents">
            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-foreground">Document type</label>
                  <Select value={form.idType} onChange={set('idType')} disabled={locked}>
                    <option value="national_id">National ID</option>
                    <option value="business_license">Business license</option>
                    <option value="passport">Passport</option>
                  </Select>
                </div>
                <Input label="Document number" value={form.idNumber} onChange={set('idNumber')} disabled={locked} required />
              </div>
              <Input label="Business / stadium company name (optional)" value={form.businessName} onChange={set('businessName')} disabled={locked} />
              <MediaUpload
                folder="misc"
                accept="image/*,application/pdf"
                label="Upload your ID or license"
                hint="A clear photo or PDF. Only E-Garoon staff can see it."
                value={form.documentUrl}
                onChange={(url) => setForm((f) => ({ ...f, documentUrl: url }))}
              />
              <Input
                label="…or paste a link to the document"
                placeholder="https://"
                value={form.documentUrl}
                onChange={set('documentUrl')}
                disabled={locked}
              />

              <div className="border-t border-border pt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <FiFileText /> Where should we pay you?
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Mobile-money number (withdrawals are paid here)" placeholder="063 1234567" value={form.payoutAccountNumber} onChange={set('payoutAccountNumber')} disabled={locked} />
                  <Input label="Account name" value={form.payoutAccountName} onChange={set('payoutAccountName')} disabled={locked} />
                </div>
              </div>

              {!locked && (
                <Button type="submit" loading={submitting}>
                  {status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
                </Button>
              )}
              {status === 'under_review' && (
                <p className="text-xs text-sky-700">Submitted. You can’t edit documents while they are being reviewed.</p>
              )}
            </form>
          </Step>

          <Step done={hasStadium} title="3. Add your stadium">
            {hasStadium ? (
              <ul className="space-y-1.5">
                {stadiums.map((s) => (
                  <li key={s._id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
                    <Link to={`/owner/stadiums/${s._id}`} className="font-semibold text-foreground hover:underline">
                      {s.name}
                    </Link>
                    <Badge variant={s.status === 'approved' ? 'success' : 'warning'}>
                      {s.status === 'approved' ? 'Live' : 'Hidden until verified'}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">Add your stadium, fields and photos. It stays hidden until your account is verified.</p>
            )}
            <Link to="/owner/stadiums/new" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:underline">
              <FiHome /> {hasStadium ? 'Add another stadium' : 'Add your stadium'}
            </Link>
          </Step>

          <Step done={status === 'verified'} title="4. E-Garoon verifies your account">
            <p className="text-xs text-muted">
              {status === 'verified'
                ? 'Verified. You can now receive bookings, pay subscriptions and withdraw earnings.'
                : 'After you submit documents and add a stadium, E-Garoon reviews your account. Payments, subscriptions and withdrawals unlock once you are verified.'}
            </p>
          </Step>
        </Card>
      )}
    </PageTransition>
  );
}
