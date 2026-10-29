import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useLanguage } from '../i18n';

const metrics = [
  { key: 'sales', label: "Today's Sales", value: data => data.todaySalesCount, to: '/pos', tone: 'revenue' },
  { key: 'products', label: 'Products', value: data => data.totalProducts, to: '/products' },
  { key: 'stock', label: 'Low Stock (<5)', value: data => data.lowStockCount, to: '/products?filter=low-stock', tone: 'stock' },
  { key: 'customers', label: 'Customers', value: data => data.totalCustomers, to: '/customers' }
];

export default function OperationalDashboard() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('/dashboard/operational');
      setSummary(response.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  if (loading) return <main className="dashboard-page dashboard-skeleton" aria-busy="true">
    <span className="visually-hidden" role="status">{t('Loading...')}</span>
    <header className="dashboard-heading"><div><span className="eyebrow">{t('STORE OVERVIEW')}</span><h1>{t('Dashboard')}</h1><p>Today at a glance.</p></div></header>
    <section className="dashboard-metrics operational-dashboard-metrics" aria-hidden="true">{metrics.map(metric => <div className="skeleton-block dashboard-metric" key={metric.key} />)}</section>
  </main>;

  if (error || !summary) return <section className="dashboard-state dashboard-state-error" role="alert">
    <span className="dashboard-state-mark" aria-hidden="true">!</span>
    <h1>{t('Dashboard')}</h1>
    <p>{t('Dashboard data could not be loaded.')}</p>
    <button type="button" onClick={loadSummary}>{t('Try again')}</button>
  </section>;

  return <div className="dashboard-page">
    <header className="dashboard-heading">
      <div><span className="eyebrow">{t('STORE OVERVIEW')}</span><h1>{t('Dashboard')}</h1><p>Operational totals for today.</p></div>
      <Link to="/pos" className="dashboard-view-all">Start a sale <span aria-hidden="true">→</span></Link>
    </header>
    <section className="dashboard-metrics operational-dashboard-metrics" aria-label={t('Store summary')}>
      {metrics.map(metric => <Link className={`dashboard-metric dashboard-metric-link${metric.tone ? ` dashboard-metric-${metric.tone}` : ''}`} to={metric.to} key={metric.key}>
        <h2>{t(metric.label)}</h2><p>{metric.value(summary)}</p>
      </Link>)}
    </section>
  </div>;
}
