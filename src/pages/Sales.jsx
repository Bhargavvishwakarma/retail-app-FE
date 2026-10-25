import { useEffect, useState } from 'react';
import api from '../api';
import { useLanguage } from '../i18n';
import { useAuth } from '../auth';
import useSessionState from '../useSessionState';

export default function Sales() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const draftKey = user.id || user.email || 'current-user';
  const [sales, setSales] = useState(/** @type {import('../types').Sale[]} */ ([]));
  const [selected, setSelected] = useState(/** @type {import('../types').Sale | null} */ (null));
  const [selectedSaleId, setSelectedSaleId] = useSessionState(`retail-draft:${draftKey}:selected-sale`, '');

  const load = () => api.get('/sales').then(r => setSales(r.data));
  useEffect(() => {
    load();
    if (selectedSaleId) api.get('/sales/' + selectedSaleId).then(res => setSelected(res.data)).catch(() => setSelectedSaleId(''));
  }, []);

  const view = async (id) => {
    const res = await api.get('/sales/' + id);
    setSelected(res.data);
    setSelectedSaleId(id);
  };

  return (
    <div>
      <h1>{t('Sales History')}</h1>
      <table>
        <thead><tr><th>{t('Sale #')}</th><th>{t('Date')}</th><th>{t('Customer')}</th><th>{t('Payment')}</th><th>{t('Total')}</th><th></th></tr></thead>
        <tbody>
          {sales.map(s => (
            <tr key={s.id}>
              <td>{s.saleNumber}</td>
              <td>{new Date(s.saleDate).toLocaleString()}</td>
              <td>{s.customer ? s.customer.name : t('Walk-in')}</td>
              <td>{s.paymentMethod}</td>
              <td>Rs. {Number(s.totalAmount).toFixed(2)}</td>
              <td><button onClick={() => view(s.id)}>{t('View')}</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div className="detail">
          <h2>{t('Sale')} {selected.saleNumber}</h2>
          <p>{t('Date')}: {new Date(selected.saleDate).toLocaleString()}</p>
          <p>{t('Customer')}: {selected.customer ? selected.customer.name : t('Walk-in')}</p>
          <p>{t('Payment')}: {selected.paymentMethod}</p>
          <table>
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
          </table>
          <h3>{t('Total')}: Rs. {Number(selected.totalAmount).toFixed(2)}</h3>
          <button onClick={() => { setSelected(null); setSelectedSaleId(''); }}>{t('Close')}</button>
        </div>
      )}
    </div>
  );
}
