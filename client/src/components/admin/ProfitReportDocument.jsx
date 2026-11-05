const PERIOD_LABELS = {
  day: 'Today',
  week: 'Last 7 days',
  month: 'Last 30 days',
  quarter: 'Last 90 days',
  semiannual: 'Last 6 months',
  year: 'Last 12 months',
  custom: 'Custom range',
};

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function dateOnly(iso) {
  if (!iso) return '—';
  return String(iso).slice(0, 10);
}

function formatGeneratedAt(iso) {
  try {
    return `${new Date(iso || Date.now()).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
  } catch {
    return String(iso || '');
  }
}

function periodLabel(report) {
  const base = PERIOD_LABELS[report?.period] || report?.period || '—';
  return `${base} · ${dateOnly(report?.from)} → ${dateOnly(report?.to)}`;
}

function sum(rows, key) {
  return (rows || []).reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

/**
 * Printable on-screen layout mirroring the Platform Profit PDF.
 */
export default function ProfitReportDocument({ report }) {
  if (!report) return null;

  const series = report.series || [];
  const byStadium = report.byStadium || [];
  const byField = report.byField || [];

  return (
    <article
      id="profit-report-print"
      className="profit-report-doc mx-auto max-w-[210mm] bg-[#FFFEFA] text-[#1A1A1A]"
    >
      <header className="bg-[#1B5E3B] px-8 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xl font-bold tracking-wide">E-GAROON</p>
            <p className="mt-1 text-xs text-[#D4E8DC]">Stadium booking platform · Somalia</p>
          </div>
          <p className="text-right text-xs font-semibold text-white/90">Super Admin · Confidential</p>
        </div>
      </header>

      <div className="px-8 py-6">
        <h1 className="text-center font-display text-2xl font-bold text-[#1A1A1A]">
          Platform Profit Report
        </h1>
        <p className="mt-2 text-center text-sm text-[#555]">{periodLabel(report)}</p>
        <p className="text-center text-xs text-[#555]">
          Generated {formatGeneratedAt(report.generatedAt)}
        </p>
        <p className="mt-2 text-center text-[11px] text-[#555]">
          Commission policy {report.policy?.platformCommissionPercent}%
          {report.policy?.fieldSubscriptionEnabled
            ? ` · Field subscription $${Number(report.policy.fieldSubscriptionAmount || 0).toFixed(2)}/mo`
            : ' · Field subscription off'}
          {` · ${report.totals?.bookingCount ?? 0} eligible bookings`}
        </p>

        <section className="mt-6">
          <h2 className="border-b border-[#C8D5CC] pb-1 text-sm font-bold uppercase tracking-wide text-[#1B5E3B]">
            Summary
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Commission', value: money(report.totals?.commission) },
              { label: 'Subscription paid', value: money(report.totals?.subscriptionPaid) },
              { label: 'Total profit', value: money(report.totals?.profit) },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-md border border-[#C8D5CC] bg-[#E8F2EC] px-4 py-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#555]">
                  {card.label}
                </p>
                <p className="mt-1 text-lg font-bold text-[#0F4A2C]">{card.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[#555]">
            Gross collected {money(report.totals?.collected)} · Sub owed{' '}
            {money(report.totals?.subscriptionOwed)} · Sub waived{' '}
            {money(report.totals?.subscriptionWaived)} · Inventory {report.inventory?.stadiums}{' '}
            stadiums / {report.inventory?.activeFields} active fields
          </p>
          <p className="text-[11px] text-[#555]">
            Commission sources: {report.commissionSources?.storedSnapshots ?? 0} stored ·{' '}
            {report.commissionSources?.estimated ?? 0} estimated
          </p>
        </section>

        <section className="mt-6">
          <h2 className="border-b border-[#C8D5CC] pb-1 text-sm font-bold uppercase tracking-wide text-[#1B5E3B]">
            Profit over time
          </h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1B5E3B] text-white">
                  <th className="px-2 py-2 text-left font-semibold">Date</th>
                  <th className="px-2 py-2 text-right font-semibold">Commission</th>
                  <th className="px-2 py-2 text-right font-semibold">Subscription paid</th>
                  <th className="px-2 py-2 text-right font-semibold">Profit</th>
                </tr>
              </thead>
              <tbody>
                {series.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2 text-[#555]" colSpan={4}>
                      No data in this range
                    </td>
                  </tr>
                ) : (
                  series.map((r) => (
                    <tr key={r.key} className="odd:bg-[#F7FAF8]">
                      <td className="px-2 py-1.5">{r.key}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{money(r.commission)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(r.subscriptionPaid)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                        {money(r.profit)}
                      </td>
                    </tr>
                  ))
                )}
                {series.length > 0 && (
                  <tr className="bg-[#E8F2EC] font-bold text-[#0F4A2C]">
                    <td className="px-2 py-2">TOTAL</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {money(report.totals?.commission)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {money(report.totals?.subscriptionPaid)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(report.totals?.profit)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="border-b border-[#C8D5CC] pb-1 text-sm font-bold uppercase tracking-wide text-[#1B5E3B]">
            By stadium
          </h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1B5E3B] text-white">
                  <th className="px-2 py-2 text-left font-semibold">Stadium</th>
                  <th className="px-2 py-2 text-right font-semibold">Bookings</th>
                  <th className="px-2 py-2 text-right font-semibold">Commission</th>
                  <th className="px-2 py-2 text-right font-semibold">Sub owed</th>
                  <th className="px-2 py-2 text-right font-semibold">Sub paid</th>
                  <th className="px-2 py-2 text-right font-semibold">Profit</th>
                </tr>
              </thead>
              <tbody>
                {byStadium.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2 text-[#555]" colSpan={6}>
                      No stadium breakdown
                    </td>
                  </tr>
                ) : (
                  byStadium.map((r) => (
                    <tr key={r.stadiumId} className="odd:bg-[#F7FAF8]">
                      <td className="px-2 py-1.5 font-medium">{r.stadiumName}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.bookings}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{money(r.commission)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(r.subscriptionOwed)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(r.subscriptionPaid)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                        {money(r.profit)}
                      </td>
                    </tr>
                  ))
                )}
                {byStadium.length > 0 && (
                  <tr className="bg-[#E8F2EC] font-bold text-[#0F4A2C]">
                    <td className="px-2 py-2">TOTAL</td>
                    <td className="px-2 py-2 text-right tabular-nums">{sum(byStadium, 'bookings')}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {money(sum(byStadium, 'commission'))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {money(sum(byStadium, 'subscriptionOwed'))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {money(sum(byStadium, 'subscriptionPaid'))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {money(sum(byStadium, 'profit'))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6">
          <h2 className="border-b border-[#C8D5CC] pb-1 text-sm font-bold uppercase tracking-wide text-[#1B5E3B]">
            By field
          </h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1B5E3B] text-white">
                  <th className="px-2 py-2 text-left font-semibold">Field</th>
                  <th className="px-2 py-2 text-left font-semibold">Stadium</th>
                  <th className="px-2 py-2 text-right font-semibold">Bookings</th>
                  <th className="px-2 py-2 text-right font-semibold">Commission</th>
                  <th className="px-2 py-2 text-right font-semibold">Sub paid</th>
                  <th className="px-2 py-2 text-right font-semibold">Profit</th>
                </tr>
              </thead>
              <tbody>
                {byField.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2 text-[#555]" colSpan={6}>
                      No field breakdown
                    </td>
                  </tr>
                ) : (
                  byField.map((r) => (
                    <tr key={r.fieldId} className="odd:bg-[#F7FAF8]">
                      <td className="px-2 py-1.5 font-medium">{r.fieldName}</td>
                      <td className="px-2 py-1.5">{r.stadiumName}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.bookings}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{money(r.commission)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {money(r.subscriptionPaid)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums font-medium">
                        {money(r.profit)}
                      </td>
                    </tr>
                  ))
                )}
                {byField.length > 0 && (
                  <tr className="bg-[#E8F2EC] font-bold text-[#0F4A2C]">
                    <td className="px-2 py-2">TOTAL</td>
                    <td className="px-2 py-2" />
                    <td className="px-2 py-2 text-right tabular-nums">{sum(byField, 'bookings')}</td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {money(sum(byField, 'commission'))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {money(sum(byField, 'subscriptionPaid'))}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(sum(byField, 'profit'))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-6 text-[10px] leading-relaxed text-[#555]">
          Profit = booking commission revenue + field subscription paid. Figures use stored
          commissionAmount when available; otherwise estimated from paid payments and policy rates.
        </p>

        <footer className="mt-8 flex items-center justify-between border-t border-[#C8D5CC] pt-3 text-[10px] text-[#555]">
          <span>E-Garoon · Platform Profit Report · Confidential</span>
          <span className="hidden print:inline">Printed from Super Admin</span>
        </footer>
      </div>
    </article>
  );
}
