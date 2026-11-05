import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FiCalendar, FiGrid, FiList, FiChevronLeft, FiChevronRight, FiKey, FiAward } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import PageTransition from '../components/common/PageTransition';
import PageHeader from '../components/common/PageHeader';
import BookingCard from '../components/booking/BookingCard';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { PillTabs } from '../components/common/Tabs';
import { SkeletonCard } from '../components/common/Skeleton';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/common/Table';
import JoogtoCardView from '../components/joogto/JoogtoCardView';
import { fetchMyBookings } from '../features/bookings/bookingSlice';
import { bookingApi } from '../api/bookingApi';
import { groupBookings, isHoldExpired } from '../lib/bookingGroups';

const PAGE_SIZE = 8;

const TABS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'joogto', label: 'Ciyaaraha Joogto (VIP Pass)' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function MyBookings() {
  const dispatch = useDispatch();
  const { items: bookings, status } = useSelector((state) => state.bookings);
  const [joogtoCards, setJoogtoCards] = useState([]);
  const [tab, setTab] = useState('upcoming');
  const [view, setView] = useState('cards');
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchMyBookings());
    bookingApi
      .getCaptainJoogtoCards()
      .then((res) => setJoogtoCards(res.data.data?.cards || []))
      .catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    setPage(1);
  }, [tab, view]);

  const grouped = useMemo(() => groupBookings(bookings), [bookings]);
  const visible = grouped[tab] || [];

  const tabsWithCount = TABS.map((t) => {
    if (t.key === 'joogto') return { ...t, count: joogtoCards.length };
    return { ...t, count: grouped[t.key]?.length || 0 };
  });
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const paginated = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PageTransition>
      <PageHeader
        title="My Bookings & Matches"
        description="Track your regular matches, VIP permanent cards (Joogto), and match history."
        breadcrumbs={[{ label: 'Dashboard', to: '/app' }, { label: 'Bookings' }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-dark-border p-0.5">
              <button type="button" onClick={() => setView('cards')} className={`focus-ring rounded-md p-2 ${view === 'cards' ? 'bg-brand-green/15 text-brand-green' : 'text-dark-muted'}`} aria-label="Card view"><FiGrid size={16} /></button>
              <button type="button" onClick={() => setView('table')} className={`focus-ring rounded-md p-2 ${view === 'table' ? 'bg-brand-green/15 text-brand-green' : 'text-dark-muted'}`} aria-label="Table view"><FiList size={16} /></button>
            </div>
            <Button as={Link} to="/app/join-match" variant="outline" icon={<FiKey />}>
              Dhammee lacagta
            </Button>
            <Button as={Link} to="/stadiums">Book a field</Button>
          </div>
        }
      />

      <PillTabs tabs={tabsWithCount} active={tab} onChange={setTab} fullWidth className="max-w-xl" variant="brand" />

      {/* JOOGTO VIP MEMBERSHIP CARDS VIEW */}
      {tab === 'joogto' && (
        <div className="mt-6 space-y-5">
          {joogtoCards.length === 0 ? (
            <EmptyState
              icon={<FiAward size={24} />}
              title="Ma lihid Kaar Joogto ah weli"
              description="Kooxdaadu weli kuma jirto kooxaha joogtada ah ee garoomada. La xiriir maamulka garoonka si laguugu sameeyo Kaar Joogto ah (Monthly VIP Pass)."
              action={<Button as={Link} to="/stadiums">Eeg Garoomada</Button>}
            />
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {joogtoCards.map((card) => (
                <JoogtoCardView
                  key={card._id}
                  membership={card}
                  showActions={true}
                  isManager={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab !== 'joogto' && status === 'loading' && (
        <div className="mt-6 grid gap-3">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
      )}

      {tab !== 'joogto' && status !== 'loading' && bookings.length === 0 && (
        <div className="mt-8">
          <EmptyState icon={<FiCalendar size={22} />} title="No bookings yet" description="Find a field and lock in your first match." action={<Button as={Link} to="/stadiums">Find a field</Button>} />
        </div>
      )}

      {tab !== 'joogto' && status !== 'loading' && bookings.length > 0 && visible.length === 0 && (
        <div className="mt-8">
          <EmptyState icon={<FiCalendar size={22} />} title={`No ${tab} bookings`} description="Check another tab, or find a new field to book." />
        </div>
      )}

      {tab !== 'joogto' && visible.length > 0 && view === 'cards' && (
        <div className="mt-6 space-y-3">
          {paginated.map((booking) => <BookingCard key={booking._id} booking={booking} onDark />)}
        </div>
      )}

      {tab !== 'joogto' && visible.length > 0 && view === 'table' && (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableHead>Stadium</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {paginated.map((b) => (
                <TableRow key={b._id}>
                  <TableCell className="font-medium">{b.stadium?.name || '—'}</TableCell>
                  <TableCell className="text-muted dark:text-dark-muted">{b.field?.name || '—'}</TableCell>
                  <TableCell className="text-muted dark:text-dark-muted">
                    {new Date(b.startTime).toLocaleDateString()} · {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell><Badge status={isHoldExpired(b) ? 'EXPIRED' : b.status} /></TableCell>
                  <TableCell className="text-right">
                    <Link to={`/app/bookings/${b._id}`} className="text-sm font-medium text-brand-green">Details</Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {visible.length > PAGE_SIZE && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted dark:text-dark-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visible.length)} of {visible.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<FiChevronLeft />} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} />
            <span className="text-sm font-medium">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" icon={<FiChevronRight />} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} />
          </div>
        </div>
      )}
    </PageTransition>
  );
}
