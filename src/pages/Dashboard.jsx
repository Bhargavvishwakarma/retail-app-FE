import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api';
import { useLanguage } from '../i18n';
import {
  DATE_RANGE_OPTIONS,
  formatCurrency,
  formatDateTime,
  formatStoreDate,
  getComparison,
  getPresetRange,
  isValidDashboardRange,
  storeDateKey
} from '../dashboardUtils';
import {
  DashboardIcon,
  DashboardMetricCard,
  DashboardPanel,
  SalesTrendChart
} from '../components/DashboardVisuals';
import {
  InventoryPanel,
  PaymentsPanel,
  RecentActivityPanel,
  TopProductsPanel
} from '../components/DashboardSections';

const numberFormat = new Intl.NumberFormat('en-IN');

function getGreeting(locale) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23'
  }).format(new Date()));
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return locale === 'kn'
    ? ({ 'Good morning': 'ಶುಭೋದಯ', 'Good afternoon': 'ಶುಭ ಮಧ್ಯಾಹ್ನ', 'Good evening': 'ಶುಭ ಸಂಜೆ' })[greeting]
    : greeting;
}

function getRangeHeading(preset, t) {
  if (preset === 'today') return t("Today's Revenue");
  if (preset === 'yesterday') return t("Yesterday's Revenue");
  const labels = {
    '7days': 'Revenue · Last 7 days',
    '30days': 'Revenue · Last 30 days',
    thisMonth: 'Revenue · This month',
    lastMonth: 'Revenue · Last month',
    custom: 'Revenue · Selected period'
  };
  return t(labels[preset] || 'Revenue');
}

function dateAtNoon(dateKey) {
  return new Date(`${dateKey}T12:00:00+05:30`);
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const locale = language === 'kn' ? 'kn-IN' : 'en-IN';
  const initialRange = useMemo(() => getPresetRange('today'), []);
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [data, setData] = useState(null);
  const [dataRange, setDataRange] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [chartMode, setChartMode] = useState('revenue');
  const [topMode, setTopMode] = useState('quantity');
  const validRange = isValidDashboardRange(from, to);
  const dataMatchesSelection = dataRange?.from === from && dataRange?.to === to;
  const rangeError = !from || !to || from > to
    ? 'Choose a valid start and end date.'
    : 'The selected date range cannot exceed 366 days.';

  useEffect(() => {
    let current = true;
    const controller = new AbortController();
    if (!validRange) {
      setError(rangeError);
      setRefreshing(false);
      return () => { current = false; };
    }

    setError('');
    setRefreshing(Boolean(dataMatchesSelection));
    api.get('/dashboard/analytics', { params: { from, to }, signal: controller.signal })
      .then(response => {
        if (current) {
          setData(response.data);
          setDataRange({ from, to });
        }
      })
      .catch(requestError => {
        if (current) setError(requestError.response?.data?.detail || 'Dashboard data could not be loaded.');
      })
      .finally(() => {
        if (current) {
          setRefreshing(false);
        }
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [from, to, refreshKey, validRange]);

  const selectPreset = value => {
    setPreset(value);
    if (value !== 'custom') {
      const range = getPresetRange(value);
      setFrom(range.from);
      setTo(range.to);
    }
  };

  const refresh = useCallback(() => setRefreshKey(value => value + 1), []);
  const current = data?.current;
  const previous = data?.previous;
  const averageBill = current?.transactions ? current.revenue / current.transactions : null;
  const previousAverage = previous?.transactions ? previous.revenue / previous.transactions : null;
  const productList = topMode === 'quantity' ? data?.topProductsByQuantity : data?.topProductsByRevenue;
  const formattedLastUpdated = data?.generatedAt ? formatDateTime(data.generatedAt, locale) : '';

  if (!validRange) return <section className="dashboard-state dashboard-state-error" role="alert">
    <span className="dashboard-state-mark" aria-hidden="true">!</span>
    <h1>{t('Dashboard')}</h1>
    <p>{t(rangeError)}</p>
  </section>;
  if (!dataMatchesSelection && !error) return <DashboardSkeleton t={t} />;
  if (error && !dataMatchesSelection) return <section className="dashboard-state dashboard-state-error" role="alert">
    <span className="dashboard-state-mark" aria-hidden="true">!</span>
    <h1>{t('Dashboard')}</h1>
    <p>{t(error)}</p>
    <button type="button" onClick={refresh}>{t('Try again')}</button>
  </section>;

  return <div className="dashboard-page" aria-busy={refreshing}>
    <header className="dashboard-heading dashboard-pro-heading">
      <div>
        <span className="eyebrow">{t('STORE OVERVIEW')}</span>
        <h1>{t('Dashboard')}</h1>
        <p>{getGreeting(language)} · {formatStoreDate(new Date(), locale)}</p>
      </div>
      <div className="dashboard-toolbar">
        <label className="dashboard-range-label">
          <span>{t('Date range')}</span>
          <select aria-label={t('Date range')} value={preset} onChange={event => selectPreset(event.target.value)}>
            {DATE_RANGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
          </select>
        </label>
        {preset === 'custom' && <div className="dashboard-custom-range">
          <label><span className="visually-hidden">{t('From')}</span><input type="date" aria-label={t('From')} max={storeDateKey()} value={from} onChange={event => setFrom(event.target.value)} /></label>
          <span aria-hidden="true">–</span>
          <label><span className="visually-hidden">{t('To')}</span><input type="date" aria-label={t('To')} max={storeDateKey()} value={to} onChange={event => setTo(event.target.value)} /></label>
        </div>}
        <button className="dashboard-refresh" type="button" onClick={refresh} disabled={refreshing} aria-label={t('Refresh dashboard data')}>
          <span aria-hidden="true" className={refreshing ? 'is-refreshing' : ''}>↻</span>{t('Refresh')}
        </button>
      </div>
      <div className="dashboard-updated" aria-live="polite">
        {error ? <span className="dashboard-inline-error" role="alert">{t(error)}</span>
          : refreshing ? <span>{t('Refreshing dashboard data...')}</span>
            : <span>{t('Last updated')}: {formattedLastUpdated || '—'}</span>}
      </div>
    </header>

    <section className="dashboard-kpis" aria-label={t('Business performance')} aria-busy={refreshing}>
      <DashboardMetricCard title={getRangeHeading(preset, t)} value={formatCurrency(current?.revenue)} icon={<DashboardIcon name="revenue" />} tone="revenue"
        comparison={getComparison(current?.revenue, previous?.revenue)} description={t('Sum of recorded sale totals for this date range.')} />
      <DashboardMetricCard title={t('Gross profit')} value={t('Unavailable')} icon={<DashboardIcon name="profit" />} tone="muted"
        unavailableNote={t('Sale-time product costs are not recorded.')} description={t('Gross profit needs product costs saved with each sale item.')} />
      <DashboardMetricCard title={t('Sales transactions')} value={numberFormat.format(current?.transactions || 0)} icon={<DashboardIcon name="transactions" />} tone="blue"
        comparison={getComparison(current?.transactions, previous?.transactions)} description={t('Count of sales records in this date range.')} />
      <DashboardMetricCard title={t('Average bill value')} value={averageBill === null ? '—' : formatCurrency(averageBill)} icon={<DashboardIcon name="average" />} tone="neutral"
        comparison={averageBill === null || previousAverage === null ? null : getComparison(averageBill, previousAverage)} description={t('Recorded revenue divided by sales transactions.')} />
      <DashboardMetricCard title={t('Outstanding customer payments')} value={t('Unavailable')} icon={<DashboardIcon name="outstanding" />} tone="muted"
        unavailableNote={t('The app does not record unpaid balances.')} description={t('Unpaid balances need payment status and amount-paid data.')} />
    </section>

    <DashboardPanel className="dashboard-sales-panel" eyebrow={t('SALES PERFORMANCE')} title={t('Sales over time')}>
      <p className="dashboard-panel-note dashboard-sales-data-note">{t('Revenue uses recorded sale totals; returns and cancellations are not tracked.')}</p>
      <div className="dashboard-chart-toolbar">
        <p>{formatStoreDate(dateAtNoon(from), locale, { month: 'short', day: 'numeric' })} – {formatStoreDate(dateAtNoon(to), locale, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        <div className="dashboard-segmented" role="group" aria-label={t('Chart metric')}>
          <button type="button" className={chartMode === 'revenue' ? 'active' : ''} aria-pressed={chartMode === 'revenue'} onClick={() => setChartMode('revenue')}>{t('Revenue')}</button>
          <button type="button" className={chartMode === 'transactions' ? 'active' : ''} aria-pressed={chartMode === 'transactions'} onClick={() => setChartMode('transactions')}>{t('Transactions')}</button>
        </div>
      </div>
      <SalesTrendChart current={data?.dailySales} previous={data?.previousDailySales} mode={chartMode} locale={language} t={t} />
      <div className="dashboard-chart-legend"><span><i className="legend-current" />{t('Selected period')}</span><span><i className="legend-previous" />{t('Previous period')}</span></div>
    </DashboardPanel>

    <div className="dashboard-two-column dashboard-insights-row">
      <TopProductsPanel products={productList} mode={topMode} onModeChange={setTopMode} t={t} />
      <PaymentsPanel payments={data?.payments} t={t} />
    </div>

    <div className="dashboard-two-column dashboard-operations-row">
      <InventoryPanel inventory={data?.inventory} attention={data?.inventoryAttention} slowMoving={data?.slowMovingProducts} t={t} />
      <RecentActivityPanel activities={data?.recentActivity} totalCustomers={data?.totalCustomers} locale={locale} t={t} />
    </div>
  </div>;
}

function DashboardSkeleton({ t }) {
  return <div className="dashboard-page dashboard-skeleton" aria-busy="true">
    <span className="visually-hidden" role="status">{t('Loading...')}</span>
    <header className="dashboard-heading"><div><span className="eyebrow">{t('STORE OVERVIEW')}</span><h1>{t('Dashboard')}</h1><p>{t('A quick look at your store today.')}</p></div></header>
    <section className="dashboard-kpis" aria-hidden="true">{[0, 1, 2, 3, 4].map(item => <div className="skeleton-block dashboard-kpi-skeleton" key={item} />)}</section>
    <div className="skeleton-block dashboard-panel-skeleton" />
    <div className="dashboard-two-column"><div className="skeleton-block dashboard-panel-skeleton" /><div className="skeleton-block dashboard-panel-skeleton" /></div>
  </div>;
}
