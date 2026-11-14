import { Link } from 'react-router-dom';
import { formatCurrency, formatDateTime } from '../dashboardUtils';
import { DashboardIcon, DashboardPanel } from './DashboardVisuals';

const numberFormat = new Intl.NumberFormat('en-IN');

export function TopProductsPanel({ products = [], mode, onModeChange, t }) {
  const maximum = Math.max(1, ...products.map(product => mode === 'quantity' ? product.unitsSold : Number(product.revenue)));
  return <DashboardPanel eyebrow={t('PRODUCT PERFORMANCE')} title={t('Top-selling products')}>
    <div className="dashboard-panel-tools">
      <span>{t('Top 5 in the selected period')}</span>
      <div className="dashboard-segmented dashboard-segmented-small" role="group" aria-label={t('Sort top products')}>
        <button type="button" className={mode === 'quantity' ? 'active' : ''} aria-pressed={mode === 'quantity'} onClick={() => onModeChange('quantity')}>{t('Units sold')}</button>
        <button type="button" className={mode === 'revenue' ? 'active' : ''} aria-pressed={mode === 'revenue'} onClick={() => onModeChange('revenue')}>{t('Revenue')}</button>
      </div>
    </div>
    {products.length ? <ol className="dashboard-product-list">
      {products.map((product, index) => {
        const value = mode === 'quantity' ? Number(product.unitsSold) : Number(product.revenue);
        return <li key={`${product.name}-${product.sku || index}`}>
          <span className="dashboard-product-rank">{String(index + 1).padStart(2, '0')}</span>
          <div className="dashboard-product-copy">
            <div className="dashboard-product-title"><strong>{product.name}</strong><span>{product.category || t('Uncategorized')}</span></div>
            <div className="dashboard-product-bar"><span style={{ width: `${Math.max(4, (value / maximum) * 100)}%` }} /></div>
          </div>
          <div className="dashboard-product-result"><strong>{mode === 'quantity' ? numberFormat.format(product.unitsSold) : formatCurrency(product.revenue)}</strong><span>{formatCurrency(product.revenue)}</span></div>
        </li>;
      })}
    </ol> : <EmptyState title={t('No product sales in this period')} detail={t('Products will be ranked after completed sales are recorded.')} />}
  </DashboardPanel>;
}

export function PaymentsPanel({ payments = [], t }) {
  const total = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  return <DashboardPanel eyebrow={t('PAYMENTS')} title={t('Recorded sales by payment method')}>
    <p className="dashboard-panel-note">{t('Breakdown uses the payment method recorded on each sale.')}</p>
    {payments.length ? <div className="dashboard-payment-list">
      {payments.map(payment => {
        const share = total > 0 ? Number(payment.amount) / total * 100 : 0;
        return <div className="dashboard-payment-row" key={payment.method}>
          <div className="dashboard-payment-label"><span>{formatPaymentMethod(payment.method, t)}</span><strong>{formatCurrency(payment.amount)}</strong></div>
          <div className="dashboard-payment-track"><span style={{ width: `${share}%` }} /></div>
          <div className="dashboard-payment-meta"><span>{numberFormat.format(payment.transactions)} {t('transactions')}</span><span>{share.toFixed(1)}%</span></div>
        </div>;
      })}
      <p className="dashboard-method-note">{t('Payment status and unpaid balances are not stored.')}</p>
    </div> : <EmptyState title={t('No payments recorded in this period')} detail={t('Recorded sale payments will appear here.')} />}
  </DashboardPanel>;
}

export function InventoryPanel({ inventory, attention = [], slowMoving = [], t }) {
  const outOfStock = Number(inventory?.outOfStockProducts) || 0;
  const lowStock = Number(inventory?.lowStockProducts) || 0;
  return <DashboardPanel eyebrow={t('INVENTORY HEALTH')} title={t('Stock that needs attention')} className="dashboard-inventory-panel"
    action={<Link className="dashboard-view-all" to="/products?filter=low-stock">{t('View inventory')} <span aria-hidden="true">→</span></Link>}>
    <div className="dashboard-inventory-summary">
      <SummaryTile label={t('Active products')} value={inventory?.totalProducts || 0} tone="blue" icon={<DashboardIcon name="inventory" />} />
      <SummaryTile label={t('Low stock')} value={lowStock} tone="warning" />
      <SummaryTile label={t('Out of stock')} value={outOfStock} tone="danger" />
      <SummaryTile label={t('Stock at recorded cost')} value={inventory?.inventoryCostValue == null ? t('Unavailable') : formatCurrency(inventory.inventoryCostValue)} tone="neutral" />
    </div>
    <div className="dashboard-alert-strip" aria-label={t('Business alerts')}>
      <span className="dashboard-alert-icon"><DashboardIcon name="alert" /></span>
      <div><strong>{t('Inventory alerts')}</strong><p>{formatAlertText(inventory, t)}</p></div>
      {(lowStock > 0 || outOfStock > 0) && <Link to="/products?filter=low-stock">{t('Review stock')}</Link>}
    </div>
    {attention.length ? <div className="dashboard-table-wrap">
      <table className="dashboard-table dashboard-inventory-table">
        <thead><tr><th>{t('Product')}</th><th>{t('SKU')}</th><th>{t('Available')}</th><th>{t('Reorder at')}</th><th>{t('Stock status')}</th></tr></thead>
        <tbody>{attention.map(product => <tr key={product.id}>
          <td><Link to="/products?filter=low-stock" className="dashboard-product-link">{product.name}</Link></td>
          <td>{product.sku || '—'}</td>
          <td><strong>{product.quantity}</strong></td>
          <td>{product.reorderThreshold} {t('units')}</td>
          <td><span className={`dashboard-stock-status ${product.quantity === 0 ? 'is-out' : 'is-low'}`}><i />{product.quantity === 0 ? t('Out of stock') : t('Low stock')}</span></td>
        </tr>)}</tbody>
      </table>
      {lowStock + outOfStock > attention.length && <p className="dashboard-table-caption">{t('Showing the first 8 products needing restock.')}</p>}
    </div> : <EmptyState title={t('Inventory is healthy')} detail={t('No products are below the five-unit reorder threshold.')} />}
    <div className="dashboard-slow-movers">
      <div className="dashboard-slow-movers-heading"><strong>{t('Slow-moving stock')}</strong><span>{t('No sales in the last 30 days')}</span></div>
      {slowMoving.length ? <ul>{slowMoving.map(product => <li key={product.id}>
        <Link to="/products" className="dashboard-product-link">{product.name}</Link>
        <span>{product.category || t('Uncategorized')}</span>
        <strong>{product.quantity} {t('in stock')}</strong>
      </li>)}</ul> : <p>{t('No established products have gone without sales for 30 days.')}</p>}
    </div>
  </DashboardPanel>;
}

export function RecentActivityPanel({ activities = [], totalCustomers = 0, locale, t }) {
  return <DashboardPanel eyebrow={t('LATEST ACTIVITY')} title={t('Recent business activity')} action={<div className="dashboard-panel-actions">
    <Link to="/customers" className="dashboard-customer-count">{numberFormat.format(totalCustomers)} {t('customers')} <span aria-hidden="true">→</span></Link>
    <Link to="/sales" className="dashboard-view-all">{t('Sales history')} <span aria-hidden="true">→</span></Link>
  </div>}>
    {activities.length ? <ol className="dashboard-activity-list">
      {activities.map(activity => <li key={`${activity.type}-${activity.id}`}>
        <Link className={`dashboard-activity-icon activity-${activity.type.toLowerCase()}`} to={activityLink(activity.type)} aria-label={`${activityTitle(activity, t)} · ${activity.title}`}>
          <span aria-hidden="true">{activity.type === 'SALE' ? '↗' : activity.type === 'CUSTOMER' ? '＋' : '◇'}</span>
        </Link>
        <div className="dashboard-activity-copy">
          <strong>{activityTitle(activity, t)} · {activity.title}</strong>
          <span>{activity.detail}</span>
          <small>{formatDateTime(activity.occurredAt, locale)}{activity.paymentMethod ? ` · ${formatPaymentMethod(activity.paymentMethod, t)}` : ''}</small>
        </div>
        {activity.amount !== null && activity.amount !== undefined && <strong className="dashboard-activity-amount">{formatCurrency(activity.amount)}</strong>}
      </li>)}
    </ol> : <EmptyState title={t('No recent activity')} detail={t('Sales and new records will appear here.')} />}
    <p className="dashboard-activity-note">{t('This feed includes sales, customer registrations, and products added. Stock edits and returns are not recorded in the activity history.')}</p>
  </DashboardPanel>;
}

function SummaryTile({ label, value, tone, icon }) {
  return <div className={`dashboard-summary-tile tone-${tone}`}>
    {icon && <span className="dashboard-summary-icon" aria-hidden="true">{icon}</span>}
    <span>{label}</span><strong>{typeof value === 'number' ? numberFormat.format(value) : value}</strong>
  </div>;
}

function EmptyState({ title, detail }) {
  return <div className="dashboard-empty-state"><strong>{title}</strong><span>{detail}</span></div>;
}

function formatPaymentMethod(method, t) {
  const labels = { CASH: 'Cash', UPI: 'UPI', CARD: 'Card', UNSPECIFIED: 'Unspecified' };
  return t(labels[method] || method);
}

function activityTitle(activity, t) {
  return t(({ SALE: 'Sale completed', CUSTOMER: 'Customer registered', PRODUCT: 'Product added' })[activity.type] || 'Business activity');
}

function activityLink(type) {
  if (type === 'SALE') return '/sales?range=30';
  if (type === 'CUSTOMER') return '/customers';
  return '/products';
}

function formatAlertText(inventory, t) {
  const out = Number(inventory?.outOfStockProducts) || 0;
  const low = Number(inventory?.lowStockProducts) || 0;
  if (!out && !low) return t('All active products are at or above the five-unit threshold.');
  const parts = [];
  if (out) parts.push(`${out} ${t('out of stock')}`);
  if (low) parts.push(`${low} ${t('below reorder level')}`);
  return parts.join(' · ');
}
