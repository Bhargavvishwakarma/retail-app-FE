import { useEffect, useState } from 'react';
import api from '../api';
import { useLanguage } from '../i18n';
import { useAuth } from '../auth';
import useSessionState from '../useSessionState';
import LoadingButton from '../components/LoadingButton';
import LoadingStatus from '../components/LoadingStatus';

export default function Pos() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const draftKey = user.id || user.email || 'current-user';
  const [products, setProducts] = useState(/** @type {import('../types').Product[]} */ ([]));
  const [customers, setCustomers] = useState(/** @type {import('../types').Customer[]} */ ([]));
  const [productsLoading, setProductsLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [search, setSearch] = useSessionState(`retail-draft:${draftKey}:pos-search`, '');
  const [cart, setCart] = useSessionState(`retail-draft:${draftKey}:pos-cart`, []);
  const [customerId, setCustomerId] = useSessionState(`retail-draft:${draftKey}:pos-customer`, '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [activeCustomerIndex, setActiveCustomerIndex] = useState(0);
  const [paymentMethod, setPaymentMethod] = useSessionState(`retail-draft:${draftKey}:pos-payment`, 'CASH');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);

  const loadProducts = async () => {
    const config = search ? { params: { search } } : {};
    setProductsLoading(true);
    try {
      const response = await api.get('/products', config);
      setProducts(response.data.filter(p => p.active));
    } catch (err) {
      setError(err.response?.data?.error || t('Request failed'));
    } finally {
      setProductsLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, [search]);
  useEffect(() => {
    api.get('/customers')
      .then(response => setCustomers(response.data))
      .catch(err => setError(err.response?.data?.error || t('Request failed')))
      .finally(() => setCustomersLoading(false));
  }, []);

  const getError = (err) =>
    err.response && err.response.data && err.response.data.error ? err.response.data.error : t('Checkout failed');

  const minimumPriceFor = product => Math.ceil((Number(product.cost || 0) * 1.15 - Number.EPSILON) * 100) / 100;

  const addToCart = (p) => {
    setMessage('');
    setError('');
    setCart(prev => {
      const found = prev.find(c => c.product.id === p.id);
      if (found) {
        if (found.quantity + 1 > p.stockQuantity) {
          setError(`${t('Only')} ${p.stockQuantity} ${t('in stock for')} ${p.name}`);
          return prev;
        }
        return prev.map(c => c.product.id === p.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product: p, quantity: 1, unitPrice: Number(p.price) }];
    });
  };

  const changeQty = (id, qty) => {
    setError('');
    setCart(prev => prev.map(c => {
      if (c.product.id !== id) return c;
      const q = Math.max(1, qty);
      if (q > c.product.stockQuantity) {
        setError(`${t('Only')} ${c.product.stockQuantity} ${t('in stock for')} ${c.product.name}`);
        return c;
      }
      return { ...c, quantity: q };
    }));
  };

  const removeItem = (id) => setCart(prev => prev.filter(c => c.product.id !== id));

  const changePrice = (id, value) => {
    setError('');
    setCart(prev => prev.map(item => item.product.id === id ? { ...item, unitPrice: value } : item));
  };

  const total = cart.reduce((sum, c) => sum + Number(c.unitPrice || 0) * c.quantity, 0);
  const selectedCustomer = customers.find(c => c.id === customerId);
  const normalizedCustomerSearch = customerSearch.trim().toLocaleLowerCase();
  const matchingCustomers = customers.filter(c =>
    !normalizedCustomerSearch || [c.name, c.phone, c.email].some(value =>
      String(value || '').toLocaleLowerCase().includes(normalizedCustomerSearch)
    )
  );

  const chooseCustomer = customer => {
    setCustomerId(customer ? customer.id : '');
    setCustomerSearch('');
    setCustomerPickerOpen(false);
    setActiveCustomerIndex(0);
  };

  const resetSale = () => {
    setSearch('');
    setCart([]);
    setCustomerId('');
    setCustomerSearch('');
    setCustomerPickerOpen(false);
    setPaymentMethod('CASH');
    setMessage('');
    setError('');
  };

  const handleCustomerKeyDown = event => {
    if (event.key === 'Escape') {
      setCustomerPickerOpen(false);
      setCustomerSearch('');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCustomerPickerOpen(true);
      setActiveCustomerIndex(index => Math.min(index + 1, matchingCustomers.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveCustomerIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && customerPickerOpen) {
      event.preventDefault();
      if (activeCustomerIndex === 0) chooseCustomer(null);
      else if (matchingCustomers[activeCustomerIndex - 1]) chooseCustomer(matchingCustomers[activeCustomerIndex - 1]);
    }
  };

  const checkout = async () => {
    if (checkingOut) return;
    setError('');
    setMessage('');
    if (cart.length === 0) { setError(t('Cart is empty')); return; }
    const belowMinimum = cart.find(item => Number(item.unitPrice) < minimumPriceFor(item.product));
    if (belowMinimum) {
      setError(`${belowMinimum.product.name}: ${t('Price must be at least')} Rs. ${minimumPriceFor(belowMinimum.product).toFixed(2)} (${t('cost plus 15% profit')}).`);
      return;
    }
    setCheckingOut(true);
    try {
      /** @type {import('../types').SaleRequest} */
      const payload = {
        customerId: customerId || null,
        paymentMethod: paymentMethod,
        items: cart.map(c => ({ productId: c.product.id, quantity: c.quantity, unitPrice: Number(c.unitPrice) }))
      };
      const res = await api.post('/sales', payload);
      setMessage(`${t('Sale')} ${res.data.saleNumber} ${t('completed. Total Rs.')} ${Number(res.data.totalAmount).toFixed(2)}`);
      setCart([]);
      setCustomerId('');
      await loadProducts();
    } catch (err) {
      setError(getError(err));
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="pos-page">
      <header className="pos-heading">
        <div>
          <span className="eyebrow">POINT OF SALE</span>
          <h1>{t('New Sale (POS)')}</h1>
          <p>Find an item and add it to the customer’s order.</p>
        </div>
        <div className="pos-live"><span /> Ready to sell</div>
      </header>
      {message && <p className="success" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="pos">
        <div className="pos-left">
          <div className="catalog-heading">
            <div><h2>{t('Products')}</h2><p>{products.length} {products.length === 1 ? 'item' : 'items'} available</p></div>
          </div>
          <div className="pos-search">
            <span aria-hidden="true">⌕</span>
            <input aria-label={t('Search products by name or SKU...')} placeholder={t('Search products by name or SKU...')} value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button type="button" className="clear-search" onClick={() => setSearch('')} aria-label="Clear search">×</button>}
          </div>
          <div className="product-grid" aria-busy={productsLoading}>
            {productsLoading && <LoadingStatus className="catalog-loading">{t('Loading products...')}</LoadingStatus>}
            {!productsLoading && products.map(p => (
              <button key={p.id} type="button" className={'product-card' + (p.stockQuantity === 0 ? ' out' : '')}
                      onClick={() => p.stockQuantity > 0 && addToCart(p)} disabled={p.stockQuantity === 0 || checkingOut}
                      aria-label={`${p.name}, Rs. ${Number(p.price).toFixed(2)}, ${p.stockQuantity} in stock`}>
                <span className="product-card-top">
                  <span className="product-symbol" aria-hidden="true">✦</span>
                  <span className={'stock-badge' + (p.stockQuantity === 0 ? ' stock-empty' : '')}>{p.stockQuantity === 0 ? 'Out of stock' : `${p.stockQuantity} in stock`}</span>
                </span>
                <strong>{p.name}</strong>
                <span className="product-meta">{p.sku || 'No SKU'}{p.size ? ` · ${p.size}` : ''}</span>
                <span className="product-price">Rs. {Number(p.price).toFixed(2)}</span>
                <span className="product-add">{p.stockQuantity > 0 ? '+ Add to cart' : 'Unavailable'}</span>
              </button>
            ))}
            {!productsLoading && products.length === 0 && <div className="catalog-empty"><span aria-hidden="true">⌕</span><strong>No products found</strong><p>Try another name or SKU.</p></div>}
          </div>
        </div>

        <div className="pos-right">
          <div className="cart-heading">
            <div><span className="eyebrow">CURRENT ORDER</span><h2>{t('Cart')}</h2></div>
            <div className="cart-heading-actions"><span className="cart-count">{cart.reduce((count, item) => count + item.quantity, 0)}</span><button type="button" className="muted" onClick={resetSale} disabled={checkingOut}>{t('Reset')}</button></div>
          </div>
          {cart.length === 0 && <div className="cart-empty"><span className="cart-empty-icon" aria-hidden="true">＋</span><strong>{t('No items yet. Click a product to add.')}</strong><p>Select an item to get started.</p></div>}
          {cart.map(c => (
            <div key={c.product.id} className="cart-row">
              <span className="cart-item-info"><strong>{c.product.name}</strong><small>{t('Default')}: Rs. {Number(c.product.price).toFixed(2)}</small></span>
              <label className="cart-price-field"><span>{t('Sale price')}</span><input aria-label={`${t('Sale price')} for ${c.product.name}`} type="number" min={minimumPriceFor(c.product)} step="0.01" value={c.unitPrice} onChange={e => changePrice(c.product.id, e.target.value)} disabled={checkingOut} /><small>{t('Min')}: Rs. {minimumPriceFor(c.product).toFixed(2)}</small></label>
              <input aria-label={`Quantity of ${c.product.name}`} type="number" min="1" value={c.quantity}
                     onChange={e => changeQty(c.product.id, parseInt(e.target.value, 10) || 1)} disabled={checkingOut} />
              <strong className="cart-item-total">Rs. {(Number(c.unitPrice || 0) * c.quantity).toFixed(2)}</strong>
              <button type="button" className="remove-item" aria-label={`Remove ${c.product.name}`} onClick={() => removeItem(c.product.id)} disabled={checkingOut}>×</button>
            </div>
          ))}
          <div className="cart-summary"><div className="subtotal-line"><span>{t('Subtotal')}</span><span>Rs. {total.toFixed(2)}</span></div><div className="total-line"><span>{t('Total')}</span><strong>Rs. {total.toFixed(2)}</strong></div></div>

          <label htmlFor="customer-search">{t('Customer')}</label>
          <div className="customer-picker">
            <input
              id="customer-search"
              role="combobox"
              aria-label={t('Search customers')}
              aria-autocomplete="list"
              aria-expanded={customerPickerOpen}
              aria-controls="customer-options"
              aria-activedescendant={customerPickerOpen ? `customer-option-${activeCustomerIndex}` : undefined}
              placeholder={t('Search customers by name, phone, or email...')}
              value={customerPickerOpen ? customerSearch : (selectedCustomer?.name || '')}
              onFocus={() => { setCustomerSearch(''); setCustomerPickerOpen(true); setActiveCustomerIndex(0); }}
              onChange={event => { setCustomerSearch(event.target.value); setCustomerPickerOpen(true); setActiveCustomerIndex(0); }}
              onKeyDown={handleCustomerKeyDown}
              onBlur={() => setTimeout(() => setCustomerPickerOpen(false), 120)}
              disabled={checkingOut}
            />
            {customerPickerOpen && (
              <div className="customer-options" id="customer-options" role="listbox" aria-busy={customersLoading}>
                {customersLoading && <div className="customer-empty"><LoadingStatus className="loading-status-compact">{t('Loading customers...')}</LoadingStatus></div>}
                {!customersLoading && <>
                <button
                  type="button"
                  id="customer-option-0"
                  role="option"
                  aria-selected={activeCustomerIndex === 0}
                  className={'customer-option' + (activeCustomerIndex === 0 ? ' active' : '')}
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => chooseCustomer(null)}
                >{t('Walk-in customer')}</button>
                {matchingCustomers.map((customer, index) => (
                  <button
                    type="button"
                    key={customer.id}
                    id={`customer-option-${index + 1}`}
                    role="option"
                    aria-selected={activeCustomerIndex === index + 1}
                    className={'customer-option' + (activeCustomerIndex === index + 1 ? ' active' : '')}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => chooseCustomer(customer)}
                  >
                    <span>{customer.name}</span>
                    {(customer.phone || customer.email) && <small>{[customer.phone, customer.email].filter(Boolean).join(' · ')}</small>}
                  </button>
                ))}
                {matchingCustomers.length === 0 && <div className="customer-empty">{t('No customers found')}</div>}
                </>}
              </div>
            )}
          </div>

          <label htmlFor="payment-method">{t('Payment')}</label>
          <select id="payment-method" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} disabled={checkingOut}>
            <option value="CASH">{t('Cash')}</option>
            <option value="CARD">{t('Card')}</option>
            <option value="UPI">{t('UPI')}</option>
          </select>

          <LoadingButton className="primary checkout-button" loading={checkingOut} loadingText={t('Completing sale...')} onClick={checkout} disabled={cart.length === 0}>{t('Checkout')} <span aria-hidden="true">→</span></LoadingButton>
          <p className="secure-note">Review the order before completing payment.</p>
        </div>
      </div>
    </div>
  );
}
