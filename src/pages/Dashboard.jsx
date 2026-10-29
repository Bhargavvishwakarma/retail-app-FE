import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useLanguage } from '../i18n';

const metrics = [
  { key: 'revenue', label: "Today's Revenue", value: summary => `Rs. ${Number(summary.todayRevenue).toFixed(2)}`, tone: 'revenue' },
  { key: 'sales', label: "Today's Sales", value: summary => summary.todaySalesCount, to: '/sales?range=1' },
  { key: 'products', label: 'Products', value: summary => summary.totalProducts },
  { key: 'stock', label: 'Low Stock (<5)', value: summary => summary.lowStockCount, tone: 'stock', to: '/products?filter=low-stock' },
  { key: 'customers', label: 'Customers', value: summary => summary.totalCustomers },
];

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('/dashboard/summary');
      setSummary(response.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  if (loading) {
    return <DashboardSkeleton t={t} />;
  }

  if (error || !summary) {
    return (
      <section className="dashboard-state dashboard-state-error" role="alert">
        <span className="dashboard-state-mark" aria-hidden="true">!</span>
        <h1>{t('Dashboard')}</h1>
        <p>{t('Dashboard data could not be loaded.')}</p>
        <button type="button" onClick={loadSummary}>{t('Try again')}</button>
      </section>
    );
  }

  const sales = summary.recentSales || [];

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <span className="eyebrow">{t('STORE OVERVIEW')}</span>
          <h1>{t('Dashboard')}</h1>
          <p>{t('A quick look at your store today.')}</p>
        </div>
      </header>

      <section className="dashboard-metrics" aria-label={t('Store summary')}>
        {metrics.map(metric => {
          const className = `dashboard-metric ${metric.tone ? `dashboard-metric-${metric.tone}` : ''}`;
          const content = <><h2>{t(metric.label)}</h2><p>{metric.value(summary)}</p></>;

          return metric.to
            ? <Link className={`${className} dashboard-metric-link`} to={metric.to} key={metric.key}>{content}</Link>
            : <article className={className} key={metric.key}>{content}</article>;
        })}
      </section>

      <section className="dashboard-sales" aria-labelledby="recent-sales-heading">
        <div className="dashboard-section-heading">
          <div>
            <span className="eyebrow">{t('LATEST TRANSACTIONS')}</span>
            <h2 id="recent-sales-heading">{t('Recent Sales')}</h2>
          </div>
          <Link to="/sales" className="dashboard-view-all">{t('View all sales')}<span aria-hidden="true">→</span></Link>
        </div>

        <div className="dashboard-table-wrap">
          {sales.length === 0 ? (
            <div className="dashboard-empty">
              <strong>{t('No sales yet')}</strong>
              <p>{t('Completed sales will appear here.')}</p>
            </div>
          ) : (
            <table className="dashboard-table">
              <thead><tr><th>{t('Sale #')}</th><th>{t('Date')}</th><th>{t('Payment')}</th><th className="dashboard-total-column">{t('Total')}</th></tr></thead>
              <tbody>
                {sales.map(sale => (
                  <tr key={sale.id}>
                    <td className="dashboard-sale-number">{sale.saleNumber}</td>
                    <td>{new Date(sale.saleDate).toLocaleString(language === 'kn' ? 'kn-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td><span className="dashboard-payment">{sale.paymentMethod}</span></td>
                    <td className="dashboard-total-column">Rs. {Number(sale.totalAmount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function DashboardSkeleton({ t }) {
  return (
    <div className="dashboard-page dashboard-skeleton" aria-busy="true" aria-label={t('Loading dashboard')}>
      <span className="visually-hidden" role="status">{t('Loading...')}</span>
      <header className="dashboard-heading">
        <div>
          <span className="eyebrow">{t('STORE OVERVIEW')}</span>
          <h1>{t('Dashboard')}</h1>
          <p>{t('A quick look at your store today.')}</p>
        </div>
      </header>

      <section className="dashboard-metrics" aria-hidden="true">
        {metrics.map(metric => (
          <div className={`dashboard-metric ${metric.tone ? `dashboard-metric-${metric.tone}` : ''}`} key={metric.key}>
            <span className="skeleton-block dashboard-skeleton-label" />
            <span className="skeleton-block dashboard-skeleton-value" />
          </div>
        ))}
      </section>

      <section className="dashboard-sales" aria-hidden="true">
        <div className="dashboard-section-heading">
          <div>
            <span className="eyebrow">{t('LATEST TRANSACTIONS')}</span>
            <h2>{t('Recent Sales')}</h2>
          </div>
          <span className="skeleton-block dashboard-skeleton-link" />
        </div>
        <div className="dashboard-table-wrap">
          <table className="dashboard-table">
            <thead><tr><th>{t('Sale #')}</th><th>{t('Date')}</th><th>{t('Payment')}</th><th className="dashboard-total-column">{t('Total')}</th></tr></thead>
            <tbody>
              {[0, 1, 2, 3].map(row => (
                <tr key={row}>
                  <td><span className="skeleton-block dashboard-skeleton-cell dashboard-skeleton-cell-sale" /></td>
                  <td><span className="skeleton-block dashboard-skeleton-cell dashboard-skeleton-cell-date" /></td>
                  <td><span className="skeleton-block dashboard-skeleton-cell dashboard-skeleton-cell-payment" /></td>
                  <td className="dashboard-total-column"><span className="skeleton-block dashboard-skeleton-cell dashboard-skeleton-cell-total" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
