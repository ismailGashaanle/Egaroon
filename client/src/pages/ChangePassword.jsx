import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { FiLock } from 'react-icons/fi';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { authApi } from '../api/authApi';
import { setAccessToken } from '../api/axiosClient';
import { setUser } from '../features/auth/authSlice';
import { dashboardPathForRole } from '../lib/roles';
import { useAuth } from '../hooks/useAuth';
import { toastApiError } from '../lib/support';

/**
 * Forced when user.mustChangePassword (e.g. Super Admin–provisioned owners).
 */
export default function ChangePassword() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user && !user.mustChangePassword) {
    return <Navigate to={dashboardPathForRole(user.role)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (form.newPassword !== form.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const { data } = await authApi.changePassword({
        currentPassword: form.currentPassword || undefined,
        newPassword: form.newPassword,
      });
      if (data.data.accessToken) setAccessToken(data.data.accessToken);
      dispatch(setUser(data.data.user));
      toast.success('Password updated');
      navigate(dashboardPathForRole(data.data.user.role), { replace: true });
    } catch (err) {
      toastApiError(err, 'Could not change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-h1 text-charcoal dark:text-dark-text">Change password</h1>
      <p className="mt-2 text-body text-muted dark:text-dark-muted">
        Your account was provisioned with a temporary password. Set a new one before continuing.
      </p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <Input
          label="Temporary / current password"
          type="password"
          icon={<FiLock />}
          value={form.currentPassword}
          onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          hint="Required if you still know the temporary password"
        />
        <Input
          label="New password"
          type="password"
          icon={<FiLock />}
          required
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
        />
        <Input
          label="Confirm new password"
          type="password"
          icon={<FiLock />}
          required
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
        />
        <Button type="submit" className="w-full" size="lg" loading={saving}>
          Save new password
        </Button>
      </form>
    </div>
  );
}
