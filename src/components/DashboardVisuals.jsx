import { formatCurrency, formatDateLabel } from '../dashboardUtils';

export function DashboardIcon({ name }) {
  const paths = {
    revenue: <><path d="M12 2v20" /><path d="M17 6.5c-.7-1.1-2.2-1.7-4.1-1.7-2.2 0-3.8 1.1-3.8 2.8 0 4.2 8.8 1.9 8.8 6.4 0 1.8-1.7 3.2-4.3 3.2-2.1 0-3.8-.7-4.7-2" /></>,
    profit: <><path d="m4 16 5-5 4 3 7-8" /><path d="M14 6h6v6" /></>,
    transactions: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h4" /></>,
    average: <><path d="M4 18V6m0 12h16" /><path d="m7 14 4-4 3 2 5-6" /></>,
    outstanding: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    inventory: <><path d="m3 7 9-4 9 4-9 4-9-4Z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>,
    alert: <><path d="M12 3 2.7 20h18.6L12 3Z" /><path d="M12 9v5m0 3h.01" /></>
  };
  return <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><g>{paths[name]}</g></svg>;
}

export function DashboardPanel({ eyebrow, title, action, className = '', children }) {
  return <section className={`dashboard-panel ${className}`}>
    <div className="dashboard-panel-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </section>;
}

export function SalesTrendChart({ current = [], previous = [], mode = 'revenue', locale = 'en-IN', t = value => value }) {
  const values = series => series.map(day => mode === 'revenue' ? Number(day.revenue) || 0 : Number(day.transactions) || 0);
  const currentValues = values(current);
  const previousValues = values(previous);
  const maxValue = Math.max(1, ...currentValues, ...previousValues);
  const width = 740;
  const height = 260;
  const left = 58;
  const right = 16;
  const top = 18;
  const bottom = 36;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const pointFor = (value, index, count) => ({
    x: left + (count <= 1 ? chartWidth / 2 : (index / (count - 1)) * chartWidth),
    y: top + chartHeight - (value / maxValue) * chartHeight
  });
  const pathFor = series => series.map((value, index) => {
    const point = pointFor(value, index, series.length);
    return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(' ');
  const hasSales = currentValues.some(value => value > 0) || previousValues.some(value => value > 0);
  const tickIndices = [...new Set([0, Math.floor((current.length - 1) / 2), current.length - 1])].filter(index => index >= 0);
  const localeDate = locale === 'kn' ? 'kn-IN' : 'en-IN';
  const valueLabel = value => mode === 'revenue' ? formatCurrency(value) : new Intl.NumberFormat(localeDate).format(value);

  if (!hasSales) return <div className="dashboard-chart-empty"><strong>{t('No sales in this date range')}</strong><span>{t('Sales will appear here when transactions are recorded.')}</span></div>;

  return <div className="dashboard-chart" role="img" aria-label={t(mode === 'revenue' ? 'Daily revenue compared with the previous period' : 'Daily transactions compared with the previous period')}>
    <span className="visually-hidden">Current period: {currentValues.map((value, index) => `${formatDateLabel(current[index].date, localeDate)} ${valueLabel(value)}`).join(', ')}.</span>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {[0, 1, 2, 3].map(tick => {
        const value = maxValue * tick / 3;
        const y = top + chartHeight - chartHeight * tick / 3;
        return <g key={tick}>
          <line className="dashboard-chart-gridline" x1={left} x2={width - right} y1={y} y2={y} />
          <text className="dashboard-chart-y-label" x={left - 10} y={y + 4} textAnchor="end">{mode === 'revenue' ? formatCurrency(value, { compact: true }) : Math.round(value)}</text>
        </g>;
      })}
      {previousValues.length > 0 && <path className="dashboard-chart-previous" d={pathFor(previousValues)} />}
      {currentValues.length > 0 && <path className="dashboard-chart-current" d={pathFor(currentValues)} />}
      {currentValues.map((value, index) => {
        const point = pointFor(value, index, currentValues.length);
        const day = current[index];
        return <circle key={day.date} className="dashboard-chart-point" cx={point.x} cy={point.y} r="3.5">
          <title>{`${formatDateLabel(day.date, localeDate, { year: 'numeric' })}: ${valueLabel(value)}${day.transactions ? ` · ${day.transactions} transactions` : ''}`}</title>
        </circle>;
      })}
      {tickIndices.map(index => {
        const point = pointFor(0, index, Math.max(1, current.length));
        return <text className="dashboard-chart-x-label" key={current[index]?.date || index} x={point.x} y={height - 9} textAnchor={index === 0 ? 'start' : index === current.length - 1 ? 'end' : 'middle'}>
          {current[index] ? formatDateLabel(current[index].date, localeDate) : ''}
        </text>;
      })}
    </svg>
  </div>;
}

export function DashboardMetricCard({ title, value, icon, comparison, tone = 'neutral', unavailableNote, description }) {
  return <article className={`dashboard-kpi dashboard-kpi-${tone}`}>
    <div className="dashboard-kpi-top">
      <h2 title={title}>{title}</h2>
      {description && <span className="dashboard-kpi-help" tabIndex="0" role="img" title={description} aria-label={description}>i</span>}
      <span className="dashboard-kpi-icon" aria-hidden="true">{icon}</span>
    </div>
    <p className={unavailableNote ? 'dashboard-kpi-value is-unavailable' : 'dashboard-kpi-value'}>{value}</p>
    {comparison && <span className={`dashboard-kpi-comparison is-${comparison.direction}`} title={comparison.label}>
      <span aria-hidden="true">{comparison.direction === 'positive' ? '↑' : comparison.direction === 'negative' ? '↓' : '•'}</span>
      {comparison.label}
    </span>}
    {unavailableNote && <span className="dashboard-kpi-note">{unavailableNote}</span>}
  </article>;
}
