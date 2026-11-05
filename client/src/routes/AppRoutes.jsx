import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import PublicLayout from '../components/layout/PublicLayout';
import AuthLayout from '../components/layout/AuthLayout';
import CaptainLayout from '../components/layout/CaptainLayout';
import OwnerLayout from '../components/layout/OwnerLayout';
import AdminLayout from '../components/layout/AdminLayout';
import SuperAdminLayout from '../components/layout/SuperAdminLayout';

import ProtectedRoute from './ProtectedRoute';
import RoleRoute from './RoleRoute';
import { FullPageSpinner } from '../components/common/Spinner';
import { ROLES } from '../lib/roles';

const Home = lazy(() => import('../pages/Home'));
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));
const Stadiums = lazy(() => import('../pages/Stadiums'));
const StadiumBookingSearch = lazy(() => import('../pages/StadiumBookingSearch'));
const StadiumDetails = lazy(() => import('../pages/StadiumDetails'));
const Tournaments = lazy(() => import('../pages/Tournaments'));
const HowItWorks = lazy(() => import('../pages/HowItWorks'));
const Services = lazy(() => import('../pages/Services'));
const Pricing = lazy(() => import('../pages/Pricing'));
const About = lazy(() => import('../pages/About'));
const ProblemsSolved = lazy(() => import('../pages/ProblemsSolved'));
const Contact = lazy(() => import('../pages/Contact'));
const TeamLineups = lazy(() => import('../pages/TeamLineups'));
const OAuthCallback = lazy(() => import('../pages/OAuthCallback'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const ChangePassword = lazy(() => import('../pages/ChangePassword'));
const NotFound = lazy(() => import('../pages/NotFound'));

const MyTeams = lazy(() => import('../pages/MyTeams'));
const TeamDetails = lazy(() => import('../pages/TeamDetails'));
const MyBookings = lazy(() => import('../pages/MyBookings'));
const BookingDetails = lazy(() => import('../pages/BookingDetails'));
const JoinMatchCode = lazy(() => import('../pages/JoinMatchCode'));
const CaptainDashboard = lazy(() => import('../pages/CaptainDashboard'));
const Favorites = lazy(() => import('../pages/Favorites'));
const CaptainSettings = lazy(() => import('../pages/CaptainSettings'));
const CaptainTournaments = lazy(() => import('../pages/CaptainTournaments'));
const CaptainPayments = lazy(() => import('../pages/CaptainPayments'));
const CaptainMessages = lazy(() => import('../pages/CaptainMessages'));

const OwnerDashboard = lazy(() => import('../pages/owner/OwnerDashboard'));
const OwnerStadiumForm = lazy(() => import('../pages/owner/OwnerStadiumForm'));
const OwnerStadiumDetail = lazy(() => import('../pages/owner/OwnerStadiumDetail'));
const OwnerTournaments = lazy(() => import('../pages/owner/OwnerTournaments'));
const OwnerBookings = lazy(() => import('../pages/owner/OwnerBookings'));
const OwnerBookingDetail = lazy(() => import('../pages/owner/OwnerBookingDetail'));
const OwnerReports = lazy(() => import('../pages/owner/OwnerReports'));
const OwnerSlots = lazy(() => import('../pages/owner/OwnerSlots'));
const OwnerPayments = lazy(() => import('../pages/owner/OwnerPayments'));
const OwnerManagers = lazy(() => import('../pages/owner/OwnerManagers'));
const OwnerWallet = lazy(() => import('../pages/owner/OwnerWallet'));
const OwnerVerification = lazy(() => import('../pages/owner/OwnerVerification'));

const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'));
const AdminStadiums = lazy(() => import('../pages/admin/AdminStadiums'));
const AdminBookings = lazy(() => import('../pages/admin/AdminBookings'));
const AdminPayments = lazy(() => import('../pages/admin/AdminPayments'));
const AdminFinancePortal = lazy(() => import('../pages/admin/AdminFinancePortal'));

const SuperAdminDashboard = lazy(() => import('../pages/superadmin/SuperAdminDashboard'));
const PlatformSettings = lazy(() => import('../pages/superadmin/PlatformSettings'));
const SiteContentEditor = lazy(() => import('../pages/superadmin/SiteContentEditor'));
const SuperAdminProfitReports = lazy(() => import('../pages/superadmin/SuperAdminProfitReports'));
const SuperAdminBusinessPlanner = lazy(() => import('../pages/superadmin/SuperAdminBusinessPlanner'));
const SuperAdminGiftCampaigns = lazy(() => import('../pages/superadmin/SuperAdminGiftCampaigns'));
const OwnerOnboardingList = lazy(() => import('../pages/superadmin/OwnerOnboardingList'));
const OwnerOnboardingWizard = lazy(() => import('../pages/superadmin/OwnerOnboardingWizard'));
const SuperAdminAgreements = lazy(() => import('../pages/superadmin/SuperAdminAgreements'));
const SuperAdminSubscriptions = lazy(() => import('../pages/superadmin/SuperAdminSubscriptions'));
const OwnerAgreements = lazy(() => import('../pages/owner/OwnerAgreements'));
const OwnerSubscriptions = lazy(() => import('../pages/owner/OwnerSubscriptions'));
const OwnerJoogto = lazy(() => import('../pages/owner/OwnerJoogto'));
const TournamentDetail = lazy(() => import('../pages/TournamentDetail'));

export default function AppRoutes() {
  const location = useLocation();

  return (
    <Suspense fallback={<FullPageSpinner />}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public site */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/stadiums" element={<Stadiums />} />
            <Route path="/search-fields" element={<StadiumBookingSearch />} />
            <Route path="/book" element={<StadiumBookingSearch />} />
            <Route path="/stadiums/:stadiumId" element={<StadiumDetails />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournaments/:tournamentId" element={<TournamentDetail />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/services" element={<Services />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/about" element={<About />} />
            <Route path="/problems-we-solved" element={<ProblemsSolved />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/lineups" element={<TeamLineups />} />
          </Route>

          {/* Auth */}
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AuthLayout />}>
              <Route path="/change-password" element={<ChangePassword />} />
            </Route>

            <Route element={<RoleRoute roles={[ROLES.TEAM_CAPTAIN]} />}>
              <Route element={<CaptainLayout />}>
                <Route path="/app" element={<CaptainDashboard />} />
                <Route path="/app/bookings" element={<MyBookings />} />
                <Route path="/app/bookings/:bookingId" element={<BookingDetails />} />
                <Route path="/app/join-match" element={<JoinMatchCode />} />
                <Route path="/app/teams" element={<MyTeams />} />
                <Route path="/app/teams/:teamId" element={<TeamDetails />} />
                <Route path="/app/favorites" element={<Favorites />} />
                <Route path="/app/tournaments" element={<CaptainTournaments />} />
                <Route path="/app/payments" element={<CaptainPayments />} />
                <Route path="/app/messages" element={<CaptainMessages />} />
                <Route path="/app/settings" element={<CaptainSettings />} />
              </Route>
            </Route>

            <Route element={<RoleRoute roles={[ROLES.STADIUM_OWNER, ROLES.STADIUM_MANAGER]} />}>
              <Route element={<OwnerLayout />}>
                <Route path="/owner" element={<OwnerDashboard />} />
                <Route path="/owner/stadiums/new" element={<OwnerStadiumForm />} />
                <Route path="/owner/stadiums/:stadiumId" element={<OwnerStadiumDetail />} />
                <Route path="/owner/slots" element={<OwnerSlots />} />
                <Route path="/owner/joogto" element={<OwnerJoogto />} />
                <Route path="/owner/wallet" element={<OwnerWallet />} />
                <Route path="/owner/verification" element={<OwnerVerification />} />
                <Route path="/owner/bookings" element={<OwnerBookings />} />
                <Route path="/owner/bookings/:bookingId" element={<OwnerBookingDetail />} />
                <Route path="/owner/payments" element={<OwnerPayments />} />
                <Route path="/owner/managers" element={<OwnerManagers />} />
                <Route path="/owner/tournaments" element={<OwnerTournaments />} />
                <Route path="/owner/reports" element={<OwnerReports />} />
                <Route path="/owner/agreements" element={<OwnerAgreements />} />
                <Route path="/owner/subscriptions" element={<OwnerSubscriptions />} />
              </Route>
            </Route>

            <Route element={<RoleRoute roles={[ROLES.ADMIN, ROLES.SUPER_ADMIN]} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/stadiums" element={<AdminStadiums />} />
                <Route path="/admin/bookings" element={<AdminBookings />} />
                <Route path="/admin/payments" element={<AdminPayments />} />
                <Route path="/admin/finance" element={<AdminFinancePortal />} />
              </Route>
            </Route>

            <Route element={<RoleRoute roles={[ROLES.SUPER_ADMIN]} />}>
              <Route element={<SuperAdminLayout />}>
                <Route path="/super-admin" element={<SuperAdminDashboard />} />
                <Route path="/super-admin/finance" element={<AdminFinancePortal />} />
                <Route path="/super-admin/profit" element={<SuperAdminProfitReports />} />
                <Route path="/super-admin/planner" element={<SuperAdminBusinessPlanner />} />
                <Route path="/super-admin/gifts" element={<SuperAdminGiftCampaigns />} />
                <Route path="/super-admin/owner-onboardings" element={<OwnerOnboardingList />} />
                <Route path="/super-admin/owner-onboardings/new" element={<OwnerOnboardingWizard />} />
                <Route path="/super-admin/owner-onboardings/:onboardingId" element={<OwnerOnboardingWizard />} />
                <Route path="/super-admin/users" element={<AdminUsers />} />
                <Route path="/super-admin/stadiums" element={<AdminStadiums />} />
                <Route path="/super-admin/settings" element={<PlatformSettings />} />
                <Route path="/super-admin/site-content" element={<SiteContentEditor />} />
                <Route path="/super-admin/agreements" element={<SuperAdminAgreements />} />
                <Route path="/super-admin/subscriptions" element={<SuperAdminSubscriptions />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
    </Suspense>
  );
}
