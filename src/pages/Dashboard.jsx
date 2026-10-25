import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useLanguage } from '../i18n';

const metrics = [
  { key: 'revenue', label: "Today's Revenue", value: summary => `Rs. ${Number(summary.todayRevenue).toFixed(2)}`, tone: 'revenue' },
  { key: 'sales', label: "Today's Sales", value: summary => summary.todaySalesCount },
  { key: 'products', label: 'Products', value: summary => summary.totalProducts },
  { key: 'stock', label: 'Low Stock (<5)', value: summary => summary.lowStockCount, tone: 'stock' },
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
    return <section className="dashboard-state" role="status"><span className="dashboard-state-mark" aria-hidden="true">…</span><p>{t('Loading...')}</p></section>;
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
        {metrics.map(metric => (
          <article className={`dashboard-metric ${metric.tone ? `dashboard-metric-${metric.tone}` : ''}`} key={metric.key}>
            <h2>{t(metric.label)}</h2>
            <p>{metric.value(summary)}</p>
          </article>
        ))}
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
