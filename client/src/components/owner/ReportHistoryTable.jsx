import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../common/Badge';
import ReportTable from '../common/ReportTable';
import { labelForStatus } from '../../lib/statusStyles';

function formatWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ReportHistoryTable({ rows = [], t }) {
  const columns = useMemo(
    () => [
      {
        accessorKey: 'startTime',
        header: t('owner.when'),
        cell: (info) => {
          const row = info.row.original;
          const label = formatWhen(row.startTime);
          return row.id ? (
            <Link
              to={`/owner/bookings/${row.id}`}
              className="font-medium hover:text-[#176B45] dark:hover:text-dark-primary"
            >
              {label}
            </Link>
          ) : (
            <span className="font-medium">{label}</span>
          );
        },
      },
      {
        id: 'venue',
        accessorFn: (row) => `${row.stadium || ''} ${row.field || ''}`,
        header: t('owner.venue'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <span className="text-muted dark:text-dark-muted">
              <span className="font-medium text-[#18201C] dark:text-dark-text">{row.stadium || '—'}</span>
              {row.field ? <span className="block text-xs">{row.field}</span> : null}
            </span>
          );
        },
      },
      {
        id: 'teams',
        accessorFn: (row) => `${row.teamA || ''} ${row.teamB || ''}`,
        header: t('owner.teams'),
        cell: (info) => {
          const row = info.row.original;
          return (
            <>
              {row.teamA || '—'}
              {row.teamB ? <span className="text-muted"> vs {row.teamB}</span> : null}
            </>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('owner.filterStatus'),
        enableSorting: false,
        cell: (info) => (
          <Badge status={info.getValue()} dot>
            {labelForStatus(info.getValue())}
          </Badge>
        ),
      },
    ],
    [t]
  );

  return (
    <ReportTable
      columns={columns}
      data={rows}
      getRowId={(row, i) => row.id || `hist-${i}`}
      emptyLabel={t('owner.noData')}
    />
  );
}
