import { FiHeart } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import PageTransition from '../components/common/PageTransition';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';

export default function Favorites() {
  return (
    <PageTransition>
      <PageHeader
        title="Favorites"
        description="Fields you've saved for quick rebooking."
        breadcrumbs={[{ label: 'Dashboard', to: '/app' }, { label: 'Favorites' }]}
        actions={<Badge variant="info">Coming soon</Badge>}
      />
      <EmptyState
        icon={<FiHeart size={22} />}
        title="Saved fields coming soon"
        description="Tap the heart icon on any field to save it here. Syncing favorites across devices is on the way."
        action={<Button as={Link} to="/stadiums">Browse fields</Button>}
      />
    </PageTransition>
  );
}
