import { Link } from 'react-router-dom';
import { FiCheck, FiHome, FiUsers, FiZap } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';

const PLANS = [
  {
    name: 'Team Captain',
    price: 'Free',
    period: 'to book',
    icon: <FiUsers />,
    popular: true,
    features: ['No booking fees for teams', 'Secure escrow payments', 'Digital match pass', 'Team roster management', 'Split payment with opponents'],
    cta: { to: '/stadiums', label: 'Find a field' },
  },
  {
    name: 'Stadium Owner',
    price: '4%',
    period: 'commission',
    icon: <FiHome />,
    popular: false,
    features: ['Free to list stadiums & fields', 'Commission only on completed matches', 'Owner dashboard & analytics', 'Automatic payout settlement', 'Verification & support'],
    cta: { to: '/register', label: 'List your stadium', variant: 'outline' },
  },
];

export default function Pricing() {
  return (
    <PageTransition className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <Badge variant="forest" className="mb-4">Pricing</Badge>
        <h1 className="text-display text-charcoal dark:text-dark-text">Simple, transparent pricing</h1>
        <p className="mt-4 text-body text-muted dark:text-dark-muted">
          No subscriptions. Pay only when you play or when you earn. Built for scale from day one.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-2">
        {PLANS.map((plan) => (
          <Card key={plan.name} className={`relative overflow-hidden p-8 ${plan.popular ? 'ring-2 ring-forest dark:ring-dark-primary' : ''}`} hover>
            {plan.popular && (
              <span className="absolute right-4 top-4 rounded-full bg-forest px-3 py-1 text-xs font-semibold text-white dark:bg-dark-primary">Most popular</span>
            )}
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest/10 text-xl text-forest dark:bg-dark-primary/10 dark:text-dark-primary">{plan.icon}</div>
            <h3 className="mt-5 text-h2 text-charcoal dark:text-dark-text">{plan.name}</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="font-display text-4xl font-bold text-charcoal dark:text-dark-text">{plan.price}</span>
              <span className="text-sm text-muted dark:text-dark-muted">{plan.period}</span>
            </div>
            <ul className="mt-6 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-charcoal dark:text-dark-text">
                  <FiCheck className="mt-0.5 shrink-0 text-forest dark:text-dark-primary" /> {f}
                </li>
              ))}
            </ul>
            <Button as={Link} to={plan.cta.to} variant={plan.cta.variant || 'primary'} className="mt-8 w-full" size="lg">{plan.cta.label}</Button>
          </Card>
        ))}
      </div>

      <Card className="mt-12 p-8 text-center">
        <FiZap className="mx-auto text-2xl text-accent" />
        <h3 className="mt-3 text-h3 text-charcoal dark:text-dark-text">Enterprise & leagues</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted dark:text-dark-muted">
          Running a league or federation? Custom pricing, white-label options, and API access — contact us for enterprise plans.
        </p>
        <Button variant="outline" className="mt-5" onClick={() => {}}>Contact sales</Button>
      </Card>
    </PageTransition>
  );
}
