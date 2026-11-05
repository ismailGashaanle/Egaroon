import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiCalendar,
  FiCheckCircle,
  FiXCircle,
  FiClipboard,
  FiPlus,
  FiAward,
  FiUserPlus,
  FiChevronRight,
  FiMapPin,
  FiStar,
  FiActivity,
  FiKey,
} from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import PageHeader from '../components/common/PageHeader';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '../components/common/Table';
import { useAuth } from '../hooks/useAuth';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { fetchMyBookings } from '../features/bookings/bookingSlice';
import { fetchMyTeams } from '../features/teams/teamSlice';
import { fetchStadiums } from '../features/stadiums/stadiumSlice';
import { groupBookings } from '../lib/bookingGroups';
import FreeMatchGiftCard from '../components/common/FreeMatchGiftCard';
import WeatherAlertStrip from '../components/weather/WeatherAlertStrip';
import JoogtoCardView from '../components/joogto/JoogtoCardView';
import { bookingApi } from '../api/bookingApi';

function MiniBarChart() {
  const bars = [35, 55, 40, 70, 50, 85, 60, 90, 75, 65, 80, 95];
  return (
    <div className="flex h-32 items-end gap-1.5">
      {bars.map((h, i) => (
        <div key={i} className="flex-1 rounded-t-md bg-brand-green/20" style={{ height: `${h}%` }}>
          <div className="h-full w-full rounded-t-md bg-brand-gradient opacity-70" style={{ height: `${h * 0.7}%`, marginTop: `${h * 0.3}%` }} />
        </div>
      ))}
    </div>
  );
}

function UpcomingBookingCard({ booking }) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);
  const image = booking.stadium?.images?.[0];

  return (
    <Link to={`/app/bookings/${booking._id}`} className="group block overflow-hidden rounded-2xl bg-white shadow-card-on-dark transition-shadow hover:shadow-lifted">
      <div className="relative h-40 w-full overflow-hidden bg-brand-gradient">
        {image ? (
          <img src={image} alt={booking.stadium?.name || 'Stadium'} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #1a6b3c 0px, #1a6b3c 28px, #237848 28px, #237848 56px)' }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
        <Badge status={booking.status} className="absolute right-3 top-3" />
      </div>
      <div className="p-4">
        <h3 className="font-display font-bold text-charcoal dark:text-dark-text">{booking.stadium?.name || 'Stadium'}</h3>
        <p className="mt-1 text-sm text-muted dark:text-dark-muted">
          {booking.field?.name || 'Field'} · {start.toLocaleDateString()} · {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </Link>
  );
}

export default function CaptainDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items: bookings } = useSelector((state) => state.bookings);
  const { items: teams } = useSelector((state) => state.teams);
  const { items: stadiums } = useSelector((state) => state.stadiums);
  const [joogtoCards, setJoogtoCards] = useState([]);

  useEffect(() => {
    dispatch(fetchMyBookings()).unwrap().catch((msg) => toast.error(msg));
    dispatch(fetchMyTeams()).unwrap().catch((msg) => toast.error(msg));
    dispatch(fetchStadiums({})).unwrap().catch((msg) => toast.error(msg));
    bookingApi
      .getCaptainJoogtoCards()
      .then((res) => setJoogtoCards(res.data.data?.cards || []))
      .catch(() => {});
  }, [dispatch]);

  const grouped = useMemo(() => groupBookings(bookings), [bookings]);
  const upcomingBooking = useMemo(() => [...grouped.upcoming].sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0], [grouped.upcoming]);
  const recentBookings = useMemo(() => [...bookings].sort((a, b) => new Date(b.createdAt || b.startTime) - new Date(a.createdAt || a.startTime)).slice(0, 5), [bookings]);
  const popularFields = useMemo(() => [...stadiums].sort((a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0)).slice(0, 4), [stadiums]);

  return (
    <PageTransition>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.name?.split(' ')[0]}. Here's what's happening with your team.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              as={Link}
              to="/app/join-match"
              variant="outline"
              icon={<FiKey />}
            >
              Dhammee lacagta
            </Button>
            <Button icon={<FiPlus />} onClick={() => navigate('/stadiums')}>
              Book a Field
            </Button>
          </div>
        }
      />

      <WeatherAlertStrip className="mb-6" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<FiClipboard />} label="Total Bookings" value={bookings.length} trend={12} trendLabel="vs last month" />
        <StatCard icon={<FiCalendar />} label="Upcoming" value={grouped.upcoming.length} accent="blue" />
        <StatCard icon={<FiCheckCircle />} label="Completed" value={grouped.completed.length} accent="green" trend={8} trendLabel="vs last month" />
        <StatCard icon={<FiXCircle />} label="Cancelled" value={grouped.cancelled.length} accent="accent" />
      </div>

      {/* Joogto VIP Membership Cards */}
      {joogtoCards.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
              <FiAward className="text-emerald-400" />
              Kaarkaaga Joogtada ah (VIP Membership Pass)
            </h2>
            <Link to="/app/bookings" className="text-xs font-semibold text-emerald-400 hover:underline">
              Eeg dhammaan
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {joogtoCards.map((card) => (
              <JoogtoCardView
                key={card._id}
                membership={card}
                showActions={true}
                isManager={false}
              />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card padding>
            <CardHeader className="flex-row items-center justify-between pb-0">
              <CardTitle>Booking Activity</CardTitle>
              <span className="flex items-center gap-1 text-xs text-muted dark:text-dark-muted"><FiActivity size={12} /> Last 12 weeks</span>
            </CardHeader>
            <CardContent className="mt-4">
              <MiniBarChart />
            </CardContent>
          </Card>

          <Card padding>
            <CardHeader className="flex-row items-center justify-between pb-0">
              <CardTitle>Upcoming Match</CardTitle>
              <Link to="/app/bookings" className="flex items-center gap-1 text-sm font-medium text-brand-green">View all <FiChevronRight size={14} /></Link>
            </CardHeader>
            <CardContent className="mt-4">
              {upcomingBooking ? <UpcomingBookingCard booking={upcomingBooking} /> : (
                <EmptyState compact icon={<FiCalendar size={20} />} title="No upcoming matches" description="Book a field to get your next match on the calendar." action={<Button as={Link} to="/stadiums" size="sm">Book a field</Button>} />
              )}
            </CardContent>
          </Card>

          <Card padding>
            <CardHeader className="flex-row items-center justify-between pb-0">
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="mt-4">
              {recentBookings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableHead>Stadium</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableHeader>
                  <TableBody>
                    {recentBookings.map((b) => (
                      <TableRow key={b._id}>
                        <TableCell className="font-medium">{b.stadium?.name || '—'}</TableCell>
                        <TableCell className="text-muted dark:text-dark-muted">{new Date(b.startTime).toLocaleDateString()}</TableCell>
                        <TableCell><Badge status={b.status} /></TableCell>
                        <TableCell className="text-right">
                          <Link to={`/app/bookings/${b._id}`} className="text-sm font-medium text-brand-green">View</Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <EmptyState compact icon={<FiCalendar size={20} />} title="No bookings yet" description="Your booking history will show up here." />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <FreeMatchGiftCard />

          <Card padding>
            <CardTitle>Quick Actions</CardTitle>
            <div className="mt-4 space-y-2">
              <Button
                as={Link}
                to="/app/join-match"
                icon={<FiKey />}
                className="w-full justify-start"
              >
                Dhammee lacagta
              </Button>
              <Button as={Link} to="/stadiums" icon={<FiPlus />} variant="outline" className="w-full justify-start">
                Book a Field
              </Button>
              <Button as={Link} to="/app/tournaments" variant="outline" icon={<FiAward />} className="w-full justify-start">
                Tournaments
              </Button>
              <Button as={Link} to="/app/teams" variant="outline" icon={<FiUserPlus />} className="w-full justify-start">
                Manage Team
              </Button>
            </div>
          </Card>

          <Card padding>
            <CardHeader className="flex-row items-center justify-between pb-0">
              <CardTitle>Popular Fields</CardTitle>
              <Link to="/stadiums" className="text-sm text-brand-green">View all</Link>
            </CardHeader>
            <CardContent className="mt-3 space-y-1">
              {popularFields.map((s) => (
                <Link key={s._id} to={`/stadiums/${s._id}`} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-warmwhite dark:hover:bg-white/5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-green/10 text-brand-green">
                    {s.images?.[0] ? <img src={s.images[0]} alt="" className="h-full w-full object-cover" /> : <FiMapPin />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{s.name}</p>
                    {s.ratingAverage > 0 && <p className="flex items-center gap-1 text-xs text-muted"><FiStar className="text-accent" /> {s.ratingAverage.toFixed(1)}</p>}
                  </div>
                  {typeof s.startingPrice === 'number' && (
                    <span className="text-sm font-semibold text-brand-green">
                      from ${Number(s.startingPrice).toFixed(0)}/team
                    </span>
                  )}
                </Link>
              ))}
              {popularFields.length === 0 && <p className="text-sm text-muted">No fields available yet.</p>}
            </CardContent>
          </Card>

          <Card className="overflow-hidden bg-brand-gradient p-6 text-white">
            <p className="text-overline text-white/60">Your Teams</p>
            <p className="mt-1 font-display text-3xl font-bold">{teams.length}</p>
            <p className="mt-1 text-sm text-white/70">{teams.reduce((n, t) => n + (t.players?.length || 0), 0)} total players</p>
            <Button as={Link} to="/app/teams" size="sm" className="mt-4 bg-white/15 text-white hover:bg-white/25">Manage teams</Button>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
