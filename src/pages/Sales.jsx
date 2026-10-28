import { useEffect, useState } from 'react';
import api from '../api';
import { useLanguage } from '../i18n';
import { useAuth } from '../auth';
import useSessionState from '../useSessionState';
import LoadingButton from '../components/LoadingButton';
import LoadingStatus from '../components/LoadingStatus';
import Pagination from '../components/Pagination';

const formatLocalDate = date => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateRangeParams = range => {
  if (range === 'all') return {};
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - Number(range) + 1);
  return { from: formatLocalDate(start), to: formatLocalDate(end) };
};

export default function Sales() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const draftKey = user.id || user.email || 'current-user';
  const [sales, setSales] = useState(/** @type {import('../types').Sale[]} */ ([]));
  const [salesTotal, setSalesTotal] = useState(0);
  const [salesPage, setSalesPage] = useState(0);
  const [dateRange, setDateRange] = useState('1');
  const [loadingSales, setLoadingSales] = useState(true);
  const [selected, setSelected] = useState(/** @type {import('../types').Sale | null} */ (null));
  const [selectedSaleId, setSelectedSaleId] = useSessionState(`retail-draft:${draftKey}:selected-sale`, '');
  const [loadingSaleId, setLoadingSaleId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setLoadingSales(true);
    api.get('/sales', { params: { page: salesPage, size: 25, ...getDateRangeParams(dateRange) } })
      .then(response => {
        if (!current) return;
        setSales(response.data.content);
        setSalesTotal(response.data.totalElements);
      })
      .catch(err => { if (current) setError(err.response?.data?.error || t('Request failed')); })
      .finally(() => { if (current) setLoadingSales(false); });
    return () => { current = false; };
  }, [salesPage, dateRange, t]);

  useEffect(() => {
    if (selectedSaleId) {
      setLoadingSaleId(selectedSaleId);
      api.get('/sales/' + selectedSaleId)
        .then(response => setSelected(response.data))
        .catch(() => setSelectedSaleId(''))
        .finally(() => setLoadingSaleId(''));
    }
  }, []);

  const view = async (id) => {
    if (loadingSaleId) return;
    setError('');
    setLoadingSaleId(id);
    try {
      const response = await api.get('/sales/' + id);
      setSelected(response.data);
      setSelectedSaleId(id);
    } catch (err) {
      setError(err.response?.data?.error || t('Request failed'));
    } finally {
      setLoadingSaleId('');
    }
  };

  return (
    <div className="sales-page">
      <div className="sales-toolbar">
        <h1>{t('Sales History')}</h1>
        <label className="sales-date-filter">
          <span>{t('Date range')}</span>
          <select value={dateRange} onChange={event => { setDateRange(event.target.value); setSalesPage(0); }}>
            <option value="1">{t('Today')}</option>
            <option value="7">{t('Last 7 days')}</option>
            <option value="30">{t('Last 30 days')}</option>
            <option value="90">{t('Last 90 days')}</option>
            <option value="all">{t('All time')}</option>
          </select>
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="table-wrap sales-table-wrap"><table className="sales-table" aria-busy={loadingSales}>
        <thead><tr><th>{t('Sale #')}</th><th>{t('Date')}</th><th>{t('Customer')}</th><th>{t('Payment')}</th><th>{t('Total')}</th><th></th></tr></thead>
        <tbody>
          {loadingSales && <tr><td className="products-empty" colSpan="6"><LoadingStatus className="loading-status-compact">{t('Loading sales...')}</LoadingStatus></td></tr>}
          {!loadingSales && sales.length === 0 && <tr><td className="products-empty" colSpan="6">{t('No sales yet')}</td></tr>}
          {!loadingSales && sales.map(s => (
            <tr key={s.id}>
              <td>{s.saleNumber}</td>
              <td>{new Date(s.saleDate).toLocaleString()}</td>
              <td>{s.customerName || t('Walk-in')}</td>
              <td>{s.paymentMethod}</td>
              <td>Rs. {Number(s.totalAmount).toFixed(2)}</td>
              <td><LoadingButton type="button" loading={loadingSaleId === s.id} loadingText={t('Loading...')} disabled={Boolean(loadingSaleId) && loadingSaleId !== s.id} onClick={() => view(s.id)}>{t('View')}</LoadingButton></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {!loadingSales && <Pagination page={salesPage} size={25} total={salesTotal} onPageChange={setSalesPage} />}

      {loadingSaleId && !selected && <LoadingStatus>Loading sale details...</LoadingStatus>}

      {selected && (
        <div className="detail">
          <h2>{t('Sale')} {selected.saleNumber}</h2>
          <p>{t('Date')}: {new Date(selected.saleDate).toLocaleString()}</p>
          <p>{t('Customer')}: {selected.customer ? selected.customer.name : t('Walk-in')}</p>
          <p>{t('Payment')}: {selected.paymentMethod}</p>
          <div className="table-wrap sale-items-table-wrap"><table className="sale-items-table">
            <thead><tr><th>{t('Product')}</th><th>{t('Qty')}</th><th>{t('Unit Price')}</th><th>{t('Subtotal')}</th></tr></thead>
            <tbody>
              {selected.items.map(it => (
                <tr key={it.id}>
                  <td>{it.product.name}</td>
                  <td>{it.quantity}</td>
                  <td>Rs. {Number(it.unitPrice).toFixed(2)}</td>
                  <td>Rs. {Number(it.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <h3>{t('Total')}: Rs. {Number(selected.totalAmount).toFixed(2)}</h3>
          <button onClick={() => { setSelected(null); setSelectedSaleId(''); }}>{t('Close')}</button>
        </div>
      )}
    </div>
  );
}
