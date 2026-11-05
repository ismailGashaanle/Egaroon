import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { FiShieldOff, FiClock, FiAlertTriangle } from 'react-icons/fi';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../api/authApi';
import { setUser } from '../../features/auth/authSlice';

const COPY = {
  verification_required: {
    icon: FiShieldOff,
    tone: 'border-amber-300 bg-amber-50 text-amber-900',
    title: 'Verification required',
    body: 'Your stadium is hidden from the public list and payments are locked until E-Garoon verifies your account.',
    cta: 'Complete verification',
  },
  under_review: {
    icon: FiClock,
    tone: 'border-sky-300 bg-sky-50 text-sky-900',
    title: 'Documents under review',
    body: 'E-Garoon is reviewing your documents. Your stadium goes live as soon as your account is verified.',
    cta: 'View status',
  },
  rejected: {
    icon: FiAlertTriangle,
    tone: 'border-rose-300 bg-rose-50 text-rose-900',
    title: 'Verification was not approved',
    body: 'Please correct your documents and submit them again.',
    cta: 'Fix and resubmit',
  },
};

/** Shown on every owner page while a self-registered owner is not yet verified. */
export default function OwnerVerificationBanner() {
  const { user } = useAuth();
  const dispatch = useDispatch();
  const status = user?.verificationStatus;
  const restricted = Boolean(COPY[status]);

  // Pick up a verification decision made by the Super Admin without requiring a re-login.
  useEffect(() => {
    if (!restricted) return;
    authApi
      .me()
      .then((res) => dispatch(setUser(res.data.data.user)))
      .catch(() => {});
  }, [restricted, dispatch]);

  if (!restricted) return null;
  const { icon: Icon, tone, title, body, cta } = COPY[status];

  return (
    <div className={`mb-6 flex flex-wrap items-start gap-3 rounded-2xl border px-4 py-3 ${tone}`}>
      <Icon className="mt-0.5 shrink-0" size={18} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs opacity-90">
          {body}
          {status === 'rejected' && user?.kyc?.rejectionReason ? ` Reason: ${user.kyc.rejectionReason}` : ''}
        </p>
      </div>
      <Link
        to="/owner/verification"
        className="rounded-xl bg-charcoal px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90"
      >
        {cta}
      </Link>
    </div>
  );
}
