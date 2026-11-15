import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Dashboard } from '../lib/types';

type CountGroup = { label: string; statuses: string[] };

const groups: CountGroup[] = [
  { label: 'Pending', statuses: ['PENDING'] },
  { label: 'Approved', statuses: ['APPROVED', 'READY_FOR_RELEASE'] },
  { label: 'In use', statuses: ['RELEASED'] },
  { label: 'Finished', statuses: ['COMPLETED', 'RETURNED'] },
  { label: 'Closed', statuses: ['CANCELLED', 'REJECTED'] },
];

const colors = { facility: '#e85002', asset: '#82b7e7' };

function sum(counts: Record<string, number>, statuses: string[]) {
  return statuses.reduce((total, status) => total + Number(counts[status] || 0), 0);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function DashboardInsights({ data }: { data: Dashboard }) {
  const reducedMotion = useReducedMotion();
  const facilities = data.facility_bookings ?? {};
  const assets = data.asset_bookings ?? {};
  const known = new Set(groups.flatMap(group => group.statuses));
  const unknown = [...new Set([...Object.keys(facilities), ...Object.keys(assets)])].filter(status => !known.has(status));
  const rows = [...groups, ...(unknown.length ? [{ label: 'Other', statuses: unknown }] : [])].map(group => ({
    name: group.label,
    Facilities: sum(facilities, group.statuses),
    Assets: sum(assets, group.statuses),
  }));
  const facilityTotal = Object.values(facilities).reduce((total, value) => total + Number(value || 0), 0);
  const assetTotal = Object.values(assets).reduce((total, value) => total + Number(value || 0), 0);
  const total = facilityTotal + assetTotal;
  const visibleRows = rows.filter(row => row.Facilities || row.Assets);
  const pieData = [
    { name: 'Facilities', value: facilityTotal, color: colors.facility },
    { name: 'Assets', value: assetTotal, color: colors.asset },
  ].filter(item => item.value);

  return (
    <section className="dashboard-insights" aria-labelledby="dashboard-insights-title">
      <div className="insights-heading">
        <div>
          <p className="eyebrow">Booking insights</p>
          <h2 id="dashboard-insights-title">Where bookings stand</h2>
          <p className="muted">Counts by current status for bookings overlapping the selected period.</p>
        </div>
        <strong className="insights-total">{total}<span>total bookings</span></strong>
      </div>
      {total ? (
        <div className="insights-grid">
          <div className="insights-chart" role="img" aria-label={visibleRows.map(row => `${row.name}: ${row.Facilities} facility bookings and ${row.Assets} asset bookings`).join('; ')}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 6 }} barCategoryGap="30%" accessibilityLayer>
                <CartesianGrid horizontal={false} stroke="#303030" />
                <XAxis type="number" allowDecimals={false} tick={{ fill: '#a7a7a7', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={72} tick={{ fill: '#d6d6d6', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#ffffff0b' }} contentStyle={{ background: '#242424', border: '1px solid #4b4b4b', borderRadius: 8, color: '#f4f4f3' }} />
                <Bar dataKey="Facilities" stackId="bookings" fill={colors.facility} radius={[0, 0, 0, 0]} isAnimationActive={!reducedMotion} animationDuration={550} />
                <Bar dataKey="Assets" stackId="bookings" fill={colors.asset} radius={[0, 4, 4, 0]} isAnimationActive={!reducedMotion} animationDuration={550} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="insights-mix">
            <h3>Booking mix</h3>
            <div className="insights-donut" role="img" aria-label={`${facilityTotal} facility bookings and ${assetTotal} asset bookings`}>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={75} stroke="none" isAnimationActive={!reducedMotion} animationDuration={650}>
                    {pieData.map(item => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <span className="insights-donut-total" aria-hidden="true">{total}</span>
            </div>
            <dl className="insights-legend">
              <div><dt><i className="insights-key facility-key" />Facilities</dt><dd>{facilityTotal}</dd></div>
              <div><dt><i className="insights-key asset-key" />Assets</dt><dd>{assetTotal}</dd></div>
            </dl>
          </div>
        </div>
      ) : (
        <p className="insights-empty">No bookings overlap this period yet.</p>
      )}
    </section>
  );
}
