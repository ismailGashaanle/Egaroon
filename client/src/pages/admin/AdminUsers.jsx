import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiSearch,
  FiSlash,
  FiCheck,
  FiMoreVertical,
  FiEdit2,
  FiTrash2,
  FiUserPlus,
  FiCopy,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Avatar from '../../components/common/Avatar';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import DropdownMenu, { DropdownItem } from '../../components/common/DropdownMenu';
import { SkeletonTable } from '../../components/common/Skeleton';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../../components/common/Table';
import { adminApi } from '../../api/adminApi';
import { ROLE_LABELS, ROLES } from '../../lib/roles';
import { useAuth } from '../../hooks/useAuth';

const ROLE_FILTERS = [
  { value: '', label: 'All roles' },
  { value: ROLES.TEAM_CAPTAIN, label: ROLE_LABELS[ROLES.TEAM_CAPTAIN] },
  { value: ROLES.STADIUM_OWNER, label: ROLE_LABELS[ROLES.STADIUM_OWNER] },
  { value: ROLES.STADIUM_MANAGER, label: ROLE_LABELS[ROLES.STADIUM_MANAGER] },
  { value: ROLES.ADMIN, label: ROLE_LABELS[ROLES.ADMIN] },
];

const emptyCreate = {
  role: ROLES.ADMIN,
  name: '',
  email: '',
  phone: '',
  city: '',
  region: '',
  password: '',
};

export default function AdminUsers() {
  const { role: myRole, user: me } = useAuth();
  const isSuperAdmin = myRole === ROLES.SUPER_ADMIN;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', phone: '', city: '', region: '', area: '' });
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [creating, setCreating] = useState(false);
  const [credentials, setCredentials] = useState(null);

  const load = async (params = {}) => {
    setLoading(true);
    try {
      const q = {
        search: params.search !== undefined ? params.search : search || undefined,
        role: params.role !== undefined ? params.role : roleFilter || undefined,
        status: params.status !== undefined ? params.status : statusFilter || undefined,
      };
      Object.keys(q).forEach((k) => q[k] === undefined && delete q[k]);
      const { data } = await adminApi.listUsers(q);
      setUsers(data.data.users);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every change to a user goes through this dialog first.
  const [confirmState, setConfirmState] = useState(null);
  const ask = (opts) => setConfirmState(opts);
  const closeConfirm = () => setConfirmState(null);
  const runConfirmed = async () => {
    const run = confirmState?.run;
    try {
      await run?.();
    } finally {
      setConfirmState(null);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const toggleStatus = (user) => {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    const suspending = nextStatus === 'suspended';
    ask({
      title: suspending ? 'Suspend this user?' : 'Unblock this user?',
      message: suspending ? (
        <>
          <strong>{user.name}</strong> ({user.email}) will be blocked and won’t be able to log in until you unblock them.
        </>
      ) : (
        <>
          <strong>{user.name}</strong> ({user.email}) will be able to log in again.
        </>
      ),
      confirmLabel: suspending ? 'Suspend user' : 'Unblock user',
      danger: suspending,
      run: async () => {
        try {
          await adminApi.setUserStatus(user.id, nextStatus);
          toast.success(suspending ? 'User suspended / blocked' : 'User unblocked');
          load();
        } catch (err) {
          toast.error(err.response?.data?.error?.message || 'Action failed');
        }
      },
    });
  };

  const changeRole = (user, role) => {
    if (role === user.role) return;
    ask({
      title: 'Change this user’s role?',
      message: (
        <>
          <strong>{user.name}</strong> will change from <strong>{ROLE_LABELS[user.role]}</strong> to{' '}
          <strong>{ROLE_LABELS[role]}</strong>. This changes what they can see and do across E-Garoon.
        </>
      ),
      confirmLabel: 'Change role',
      run: async () => {
        try {
          await adminApi.setUserRole(user.id, role);
          toast.success('Role updated');
          load();
        } catch (err) {
          toast.error(err.response?.data?.error?.message || 'Could not change role');
        }
      },
    });
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditForm({
      name: user.name || '',
      phone: user.phone || '',
      city: user.city || '',
      region: user.region || '',
      area: user.area || '',
    });
  };

  const saveEdit = (e) => {
    e.preventDefault();
    if (!editUser) return;
    ask({
      title: 'Save changes?',
      message: (
        <>
          Update the details of <strong>{editUser.name}</strong>?
        </>
      ),
      confirmLabel: 'Save changes',
      run: async () => {
        setSaving(true);
        try {
          await adminApi.updateUser(editUser.id, editForm);
          toast.success('User updated');
          setEditUser(null);
          load();
        } catch (err) {
          toast.error(err.response?.data?.error?.message || 'Update failed');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const removeUser = (user) => {
    ask({
      title: 'Delete this user?',
      message: (
        <>
          <strong>{user.name}</strong> ({user.email}) will be suspended and won’t be able to log in.
        </>
      ),
      confirmLabel: 'Delete user',
      danger: true,
      run: async () => {
        try {
          await adminApi.deleteUser(user.id);
          toast.success('User removed');
          load();
        } catch (err) {
          toast.error(err.response?.data?.error?.message || 'Delete failed');
        }
      },
    });
  };

  const openCreate = (role = ROLES.ADMIN) => {
    setCreateForm({ ...emptyCreate, role });
    setCredentials(null);
    setCreateOpen(true);
  };

  const submitCreate = (e) => {
    e.preventDefault();
    ask({
      title: 'Create this account?',
      message: (
        <>
          Create a <strong>{ROLE_LABELS[createForm.role]}</strong> account for <strong>{createForm.name.trim()}</strong> (
          {createForm.email.trim()})? They will be able to log in with the credentials you share.
        </>
      ),
      confirmLabel: 'Create account',
      run: performCreate,
    });
  };

  const performCreate = async () => {
    setCreating(true);
    try {
      const payload = {
        role: createForm.role,
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim() || undefined,
        city: createForm.city.trim() || undefined,
        region: createForm.region.trim() || undefined,
      };
      if (createForm.password.trim().length >= 8) {
        payload.password = createForm.password.trim();
      }
      const { data } = await adminApi.createUser(payload);
      const user = data.data.user;
      const temporaryPassword = data.data.temporaryPassword;
      setCredentials({
        email: user.email,
        temporaryPassword,
        role: user.role,
        name: user.name,
      });
      toast.success(
        user.role === ROLES.ADMIN ? 'Admin account created' : 'Stadium owner account created'
      );
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Could not create user');
    } finally {
      setCreating(false);
    }
  };

  const copyCreds = async () => {
    if (!credentials) return;
    const text = `E-Garoon login\nEmail: ${credentials.email}\nPassword: ${credentials.temporaryPassword}\n(Change password on first login)`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Credentials copied — share out-of-band only');
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title="Users"
        description={
          isSuperAdmin
            ? 'Register Admin or Stadium Owner, filter by role, suspend/block, edit, or soft-delete.'
            : 'Filter by role, suspend/block, edit profile fields, or soft-delete.'
        }
        breadcrumbs={[
          {
            label: isSuperAdmin ? 'Super Admin' : 'Admin',
            to: isSuperAdmin ? '/super-admin' : '/admin',
          },
          { label: 'Users' },
        ]}
        actions={
          isSuperAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<FiUserPlus />} onClick={() => openCreate(ROLES.ADMIN)}>
                Register Admin
              </Button>
              <Button icon={<FiUserPlus />} onClick={() => openCreate(ROLES.STADIUM_OWNER)}>
                Register Stadium Owner
              </Button>
            </div>
          ) : null
        }
      />

      {isSuperAdmin ? (
        <Card className="mb-4 border border-brand-green/20 bg-brand-green/5 p-4 text-sm">
          <p className="font-medium text-foreground">Stadium owner with stadium + agreement?</p>
          <p className="mt-1 text-muted dark:text-dark-muted">
            Use{' '}
            <Link className="font-semibold text-brand-green underline" to="/super-admin/owner-onboardings/new">
              Register owners (full onboarding)
            </Link>{' '}
            for stadium, fields, signatures &amp; subscription. Quick “Register Stadium Owner” here only creates
            the login account.
          </p>
        </Card>
      ) : null}

      <Card className="mb-6 p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
          <Input
            icon={<FiSearch />}
            placeholder="Search name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            containerClassName="flex-1 min-w-[200px]"
          />
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            containerClassName="w-44"
          >
            {ROLE_FILTERS.map((r) => (
              <option key={r.value || 'all'} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            containerClassName="w-36"
          >
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : users.length === 0 ? (
        <p className="text-sm text-muted dark:text-dark-muted">No users found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={user.name} size="sm" />
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted dark:text-dark-muted">{user.email}</p>
                      {user.phone && (
                        <p className="text-xs text-muted dark:text-dark-muted">{user.phone}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {isSuperAdmin && user.role !== ROLES.SUPER_ADMIN ? (
                    <Select
                      className="!py-1.5 text-xs"
                      value={user.role}
                      onChange={(e) => changeRole(user, e.target.value)}
                    >
                      {Object.values(ROLES)
                        .filter((r) => r !== ROLES.SUPER_ADMIN)
                        .map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                    </Select>
                  ) : (
                    <Badge variant="neutral">{ROLE_LABELS[user.role]}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge status={user.status === 'active' ? 'ACTIVE' : 'SUSPENDED'} dot />
                </TableCell>
                <TableCell className="text-muted dark:text-dark-muted">
                  {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu
                    align="right"
                    trigger={<Button variant="ghost" size="sm" iconOnly icon={<FiMoreVertical />} />}
                  >
                    <DropdownItem onClick={() => openEdit(user)}>
                      <FiEdit2 size={14} /> Edit
                    </DropdownItem>
                    {String(user.id) !== String(me?.id) && (
                      <DropdownItem onClick={() => toggleStatus(user)}>
                        {user.status === 'active' ? (
                          <>
                            <FiSlash size={14} /> Suspend / block
                          </>
                        ) : (
                          <>
                            <FiCheck size={14} /> Unblock
                          </>
                        )}
                      </DropdownItem>
                    )}
                    {String(user.id) !== String(me?.id) && user.role !== ROLES.SUPER_ADMIN && (
                      <DropdownItem onClick={() => removeUser(user)}>
                        <FiTrash2 size={14} /> Soft-delete
                      </DropdownItem>
                    )}
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Modal open={Boolean(editUser)} onClose={() => setEditUser(null)} title="Edit user">
        <form onSubmit={saveEdit} className="space-y-3">
          <Input
            label="Name"
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Phone"
            value={editForm.phone}
            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="City"
            value={editForm.city}
            onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
          />
          <Input
            label="Region"
            value={editForm.region}
            onChange={(e) => setEditForm((f) => ({ ...f, region: e.target.value }))}
          />
          <Input
            label="Area"
            value={editForm.area}
            onChange={(e) => setEditForm((f) => ({ ...f, area: e.target.value }))}
          />
          <p className="text-xs text-muted">Email and password cannot be changed here.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => {
          if (credentials) {
            setCreateOpen(false);
            setCredentials(null);
            return;
          }
          setCreateOpen(false);
        }}
        title={credentials ? 'Credentials (copy once)' : 'Register Admin / Stadium Owner'}
      >
        {credentials ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Share out-of-band only. Password is shown once; user must change it on first login.
            </p>
            <div className="rounded-lg border border-brand-green/30 bg-surface-inset p-4 font-mono text-sm">
              <p>
                <span className="text-muted">Role:</span> {ROLE_LABELS[credentials.role]}
              </p>
              <p>
                <span className="text-muted">Name:</span> {credentials.name}
              </p>
              <p>
                <span className="text-muted">Email:</span> {credentials.email}
              </p>
              <p>
                <span className="text-muted">Temp password:</span> {credentials.temporaryPassword}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" icon={<FiCopy />} onClick={copyCreds}>
                Copy
              </Button>
              {credentials.role === ROLES.STADIUM_OWNER ? (
                <Link to="/super-admin/owner-onboardings/new">
                  <Button type="button" variant="secondary">
                    Full owner onboarding
                  </Button>
                </Link>
              ) : null}
              <Button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setCredentials(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submitCreate} className="space-y-3">
            <Select
              label="Role"
              value={createForm.role}
              onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
              required
            >
              <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
              <option value={ROLES.STADIUM_OWNER}>{ROLE_LABELS[ROLES.STADIUM_OWNER]}</option>
            </Select>
            <Input
              label="Full name"
              value={createForm.name}
              onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              required
              minLength={2}
            />
            <Input
              label="Email"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              required
              autoComplete="off"
            />
            <Input
              label="Phone (optional)"
              value={createForm.phone}
              onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="063… / +252…"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="City"
                value={createForm.city}
                onChange={(e) => setCreateForm((f) => ({ ...f, city: e.target.value }))}
              />
              <Input
                label="Region"
                value={createForm.region}
                onChange={(e) => setCreateForm((f) => ({ ...f, region: e.target.value }))}
              />
            </div>
            <Input
              label="Password (optional)"
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Leave blank to auto-generate"
              minLength={8}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted">
              Temp password is returned once. Account requires password change on first login. Super Admin role
              cannot be created here.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={creating}>
                Create account
              </Button>
            </div>
          </form>
        )}
      </Modal>
    <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        danger={confirmState?.danger}
        onConfirm={runConfirmed}
        onCancel={closeConfirm}
      />
    </PageTransition>
  );
}
