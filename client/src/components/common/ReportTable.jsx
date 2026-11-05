import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

function columnId(column, index) {
  if (column.id != null && column.id !== '') return String(column.id);
  if (column.accessorKey != null) return String(column.accessorKey);
  return `col-${index}`;
}

function getRowValue(row, column) {
  if (typeof column.accessorFn === 'function') return column.accessorFn(row);
  if (column.accessorKey != null) return row?.[column.accessorKey];
  return undefined;
}

function canSortColumn(column) {
  if (column.enableSorting === false) return false;
  return Boolean(column.accessorFn || column.accessorKey);
}

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const aTime = a instanceof Date ? a.getTime() : Date.parse(a);
  const bTime = b instanceof Date ? b.getTime() : Date.parse(b);
  if (Number.isFinite(aTime) && Number.isFinite(bTime) && String(a).length >= 8 && String(b).length >= 8) {
    return aTime - bTime;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function renderHeader(column) {
  const header = column.header;
  if (typeof header === 'function') return header();
  return header ?? null;
}

function renderCell(column, row, rowIndex) {
  if (typeof column.cell === 'function') {
    return column.cell({
      getValue: () => getRowValue(row, column),
      row: { original: row, index: rowIndex },
      column,
    });
  }
  const value = getRowValue(row, column);
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return null;
  return value;
}

export default function ReportTable({
  columns = [],
  data,
  getRowId,
  emptyLabel = 'No data yet.',
  minWidth = '640px',
  className = '',
}) {
  const rows = Array.isArray(data) ? data : [];
  const [sorting, setSorting] = useState(null);

  const sortedRows = useMemo(() => {
    if (!sorting) return rows;
    const col = columns.find((column, index) => columnId(column, index) === sorting.id);
    if (!col) return rows;
    const next = [...rows];
    next.sort((a, b) => {
      const dir = compareValues(getRowValue(a, col), getRowValue(b, col));
      return sorting.desc ? -dir : dir;
    });
    return next;
  }, [rows, columns, sorting]);

  const toggleSort = (id) => {
    setSorting((prev) => {
      if (!prev || prev.id !== id) return { id, desc: false };
      if (!prev.desc) return { id, desc: true };
      return null;
    });
  };

  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-muted dark:text-dark-muted">{emptyLabel}</p>;
  }

  return (
    <div className={clsx('overflow-x-auto', className)}>
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        <thead>
          <tr className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted dark:text-dark-muted">
            {columns.map((column, index) => {
              const id = columnId(column, index);
              const sortable = canSortColumn(column);
              const sorted = sorting?.id === id ? (sorting.desc ? 'desc' : 'asc') : false;
              const align = column.meta?.align;
              return (
                <th
                  key={id}
                  className={clsx('pb-4 pe-4 font-semibold last:pe-0', align === 'right' && 'text-right')}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 transition-colors hover:text-[#176B45] dark:hover:text-dark-primary"
                      onClick={() => toggleSort(id)}
                    >
                      {renderHeader(column)}
                      {sorted === 'asc' ? (
                        <FiChevronUp className="opacity-70" />
                      ) : sorted === 'desc' ? (
                        <FiChevronDown className="opacity-70" />
                      ) : null}
                    </button>
                  ) : (
                    renderHeader(column)
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, rowIndex) => {
            const rowKey = getRowId ? getRowId(row, rowIndex) : rowIndex;
            return (
              <tr
                key={rowKey}
                className="border-t border-[#18201C]/[0.06] transition-colors hover:bg-[#176B45]/[0.03] dark:border-dark-border dark:hover:bg-white/[0.03]"
              >
                {columns.map((column, index) => {
                  const id = columnId(column, index);
                  const align = column.meta?.align;
                  return (
                    <td
                      key={id}
                      className={clsx(
                        'py-4 pe-4 align-middle text-sm text-[#18201C] last:pe-0 dark:text-dark-text',
                        align === 'right' && 'text-right',
                        column.meta?.cellClassName
                      )}
                    >
                      {renderCell(column, row, rowIndex)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
