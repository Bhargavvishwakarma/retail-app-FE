import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import { useLanguage } from '../i18n';
import { useAuth } from '../auth';
import useSessionState from '../useSessionState';
import LoadingButton from '../components/LoadingButton';
import LoadingStatus from '../components/LoadingStatus';
import Pagination from '../components/Pagination';

const emptyForm = {
  name: '', sku: '', description: '', size: '', color: '',
  price: '', cost: '', stockQuantity: 0, category: '', active: true
};
const PRODUCT_LIST_PAGE_SIZE = 10;

export default function Products() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const lowStockOnly = searchParams.get('filter') === 'low-stock';
  const isOwner = user.role === 'OWNER';
  const draftKey = user.id || user.email || 'current-user';
  const [search, setSearch] = useSessionState(`retail-draft:${draftKey}:products-search`, '');
  const [products, setProducts] = useState(/** @type {import('../types').Product[]} */ ([]));
  const [lowStockProducts, setLowStockProducts] = useState(/** @type {import('../types').Product[]} */ ([]));
  const [productTotal, setProductTotal] = useState(0);
  const [productPage, setProductPage] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [reloadProducts, setReloadProducts] = useState(0);
  const [categories, setCategories] = useState(/** @type {import('../types').Category[]} */ ([]));
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [form, setForm] = useSessionState(`retail-draft:${draftKey}:product-form`, emptyForm);
  const [editingId, setEditingId] = useSessionState(`retail-draft:${draftKey}:product-editing`, null);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(/** @type {import('../types').Product | null} */ (null));
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const minimumPrice = Math.ceil((Number(form.cost || 0) * 1.15 - Number.EPSILON) * 100) / 100;
  const visibleProducts = lowStockOnly
    ? lowStockProducts.filter(product => !debouncedSearch || `${product.name} ${product.sku || ''}`.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : products;
  const visibleProductTotal = lowStockOnly ? visibleProducts.length : productTotal;

  const getError = err => err.response?.data?.error || t('Request failed');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setProductPage(0);
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!lowStockOnly) return undefined;
    let current = true;
    setLoadingProducts(true);
    api.get('/products/low-stock', { params: { threshold: 5 } })
      .then(response => {
        if (!current) return;
        setLowStockProducts(response.data);
      })
      .catch(err => { if (current) setError(getError(err)); })
      .finally(() => { if (current) setLoadingProducts(false); });
    return () => { current = false; };
  }, [lowStockOnly, reloadProducts, t]);

  useEffect(() => {
    if (lowStockOnly) return undefined;
    let current = true;
    setLoadingProducts(true);
    api.get('/products', { params: { search: debouncedSearch, page: productPage, size: PRODUCT_LIST_PAGE_SIZE } })
      .then(response => {
        if (!current) return;
        setProducts(response.data.content);
        setProductTotal(response.data.totalElements);
      })
      .catch(err => { if (current) setError(getError(err)); })
      .finally(() => { if (current) setLoadingProducts(false); });
    return () => { current = false; };
  }, [debouncedSearch, lowStockOnly, productPage, reloadProducts, t]);

  useEffect(() => {
    setProductPage(0);
    if (lowStockOnly) {
      setSearch('');
      setDebouncedSearch('');
    }
  }, [lowStockOnly]);

  useEffect(() => {
    if (!lowStockOnly) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('product-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [lowStockOnly]);

  const reload = () => setReloadProducts(value => value + 1);
  useEffect(() => {
    api.get('/categories')
      .then(response => setCategories(response.data))
      .catch(err => setError(getError(err)))
      .finally(() => setCategoriesLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const resetPage = () => {
    setSearch('');
    setProductPage(0);
    if (lowStockOnly) setSearchParams({}, { replace: true });
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  };

  const changeStockFilter = value => {
    setSearch('');
    setProductPage(0);
    setSearchParams(value === 'low-stock' ? { filter: value } : {}, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError('');
    if (Number(form.price) < minimumPrice) {
      setError(`${t('Price must be at least')} Rs. ${minimumPrice.toFixed(2)} (${t('cost plus 15% profit')}).`);
      return;
    }
    /** @type {import('../types').ProductRequest} */
    const payload = {
      name: form.name,
      sku: form.sku,
      description: form.description,
      size: form.size,
      color: form.color,
      price: parseFloat(form.price),
      cost: form.cost ? parseFloat(form.cost) : 0,
      stockQuantity: parseInt(form.stockQuantity || '0', 10),
      active: form.active,
      category: form.category ? { id: form.category } : null
    };
    setSaving(true);
    try {
      if (editingId) await api.put('/products/' + editingId, payload);
      else await api.post('/products', payload);
      setForm(emptyForm);
      setEditingId(null);
      setProductPage(0);
      reload();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      sku: p.sku || '',
      description: p.description || '',
      size: p.size || '',
      color: p.color || '',
      price: p.price,
      cost: p.cost,
      stockQuantity: p.stockQuantity,
      category: p.category ? p.category.id : '',
      active: p.active
    });
  };

  const handleDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete('/products/' + pendingDelete.id);
      setPendingDelete(null);
      setProductPage(0);
      reload();
    } catch (err) {
      setDeleteError(getError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="products-page">
      <header className="products-heading">
        <div><span className="eyebrow">{t('INVENTORY')}</span><h1>{t('Products')}</h1><p>{lowStockOnly ? t('Showing products with fewer than 5 in stock.') : t('Manage your products, stock, and selling prices.')}</p></div>
        <div className="products-count"><strong>{visibleProductTotal}</strong><span>{t('products')}</span></div>
      </header>
      {error && <p className="error">{error}</p>}

      {pendingDelete && <div className="confirm-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !deleting) setPendingDelete(null); }} onKeyDown={event => { if (event.key === 'Escape' && !deleting) setPendingDelete(null); }}>
        <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-product-title" aria-describedby="delete-product-description archive-product-note">
          <div className="confirm-icon" aria-hidden="true">!</div>
          <div className="confirm-copy">
            <h2 id="delete-product-title">{t('Archive this product?')}</h2>
            <p id="delete-product-description">{pendingDelete.name}{pendingDelete.sku ? ` · ${pendingDelete.sku}` : ''}</p>
            <p id="archive-product-note">{t('Archived products leave active inventory; past sales keep their product details.')}</p>
          </div>
          {deleteError && <p className="error confirm-error">{deleteError}</p>}
          <div className="confirm-actions">
            <button type="button" className="muted" autoFocus disabled={deleting} onClick={() => setPendingDelete(null)}>{t('Cancel')}</button>
            <LoadingButton type="button" className="danger" loading={deleting} loadingText={t('Deleting...')} onClick={handleDelete}>{t('Archive')}</LoadingButton>
          </div>
        </section>
      </div>}

      {isOwner && <form className="form-grid product-form" aria-busy={saving} onSubmit={handleSubmit}>
        <div className="product-form-title"><div><h2>{t(editingId ? 'Edit product' : 'Add a product')}</h2><p>{t('Set your default selling price and stock details.')}</p></div>{editingId && <span className="editing-badge">{t('Editing')}</span>}</div>
        <label className="product-field"><span>{t('Name *')}</span><input name="name" placeholder={t('e.g. Silk saree')} value={form.name} onChange={handleChange} required /></label>
        <label className="product-field"><span>{t('SKU')}</span><input name="sku" placeholder={t('Optional product code')} value={form.sku} onChange={handleChange} /></label>
        <label className="product-field"><span>{t('Price *')}</span><input name="price" type="number" min={minimumPrice} step="0.01" placeholder="0.00" value={form.price} onChange={handleChange} required /><small>{t('Default selling price')}</small></label>
        <label className="product-field"><span>{t('Cost')}</span><input name="cost" type="number" min="0" step="0.01" placeholder="0.00" value={form.cost} onChange={handleChange} /><small>{t('Minimum price')}: Rs. {minimumPrice.toFixed(2)}</small></label>
        <label className="product-field"><span>{t('Stock Qty')}</span><input name="stockQuantity" type="number" min="0" placeholder="0" value={form.stockQuantity} onChange={handleChange} /></label>
        <label className="product-field"><span>{t('Size (S/M/L/XL)')}</span><input name="size" placeholder={t('e.g. S / M / XL')} value={form.size} onChange={handleChange} /></label>
        <label className="product-field"><span>{t('Color')}</span><input name="color" placeholder={t('e.g. Maroon')} value={form.color} onChange={handleChange} /></label>
        <label className="product-field"><span>{t('Category')}</span><select name="category" value={form.category} onChange={handleChange} disabled={categoriesLoading} aria-busy={categoriesLoading}>
          <option value="">{categoriesLoading ? t('Loading categories...') : t('No category')}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
        <label className="product-field product-description"><span>{t('Description')}</span><input name="description" placeholder={t('Optional details')} value={form.description} onChange={handleChange} /></label>
        <div className="product-form-footer"><label className="checkbox-label"><input type="checkbox" name="active" checked={form.active} onChange={handleChange} disabled={saving} /> {t('Active')}</label>
          <div className="form-actions"><LoadingButton type="submit" loading={saving} loadingText={t('Saving...')}>{t(editingId ? 'Update Product' : 'Add Product')}</LoadingButton>{editingId && <button type="button" className="muted" disabled={saving} onClick={() => { setEditingId(null); setForm(emptyForm); }}>{t('Cancel')}</button>}</div>
        </div>
      </form>}

      <div id="product-list" className="products-list-heading"><div><h2>{t('Product list')}</h2><p>{lowStockOnly ? t('Search within low stock products.') : t('Search and update your inventory.')}</p></div><div className="products-list-controls"><input className="search-box" aria-label={t('Search by name or SKU...')} placeholder={t('Search by name or SKU...')} value={search} onChange={e => setSearch(e.target.value)} /><details className="stock-filter-menu" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false; }}><summary aria-label={t('Filter products by stock')}><span>{t(lowStockOnly ? 'Low stock (<5)' : 'All stock')}</span><span className="stock-filter-chevron" aria-hidden="true" /></summary><div className="stock-filter-options" role="group" aria-label={t('Filter products by stock')}><button type="button" aria-pressed={!lowStockOnly} onClick={event => { changeStockFilter('all'); event.currentTarget.closest('details').open = false; }}>{t('All stock')}{!lowStockOnly && <span aria-hidden="true">✓</span>}</button><button type="button" aria-pressed={lowStockOnly} onClick={event => { changeStockFilter('low-stock'); event.currentTarget.closest('details').open = false; }}>{t('Low stock (<5)')}{lowStockOnly && <span aria-hidden="true">✓</span>}</button></div></details><button type="button" className="muted" onClick={resetPage}>{t('Reset')}</button></div></div>

      <div className="table-wrap products-table-wrap"><table className="products-table">
        <thead><tr><th>{t('Name')}</th><th>{t('SKU')}</th><th>{t('Category')}</th><th>{t('Size (S/M/L/XL)')}</th><th>{t('Color')}</th><th>{t('Price')}</th><th>{t('Stock')}</th><th>{t('Status')}</th>{isOwner && <th>{t('Actions')}</th>}</tr></thead>
        <tbody aria-busy={loadingProducts}>
          {loadingProducts && <tr><td className="products-empty" colSpan={isOwner ? 9 : 8}><LoadingStatus className="loading-status-compact">{t('Loading products...')}</LoadingStatus></td></tr>}
          {!loadingProducts && visibleProducts.length === 0 && <tr><td className="products-empty" colSpan={isOwner ? 9 : 8}>{lowStockOnly ? t('No low stock products found') : t('No products found')}</td></tr>}
          {!loadingProducts && visibleProducts.map(p => (
            <tr key={p.id} className={p.stockQuantity < 5 ? 'low-stock' : ''}>
              <td>{p.name}</td>
              <td>{p.sku}</td>
              <td>{p.category ? p.category.name : '-'}</td>
              <td>{p.size}</td>
              <td>{p.color}</td>
              <td>Rs. {Number(p.price).toFixed(2)}</td>
              <td>{p.stockQuantity}</td>
              <td>{t(p.active ? 'Active' : 'Inactive')}</td>
              {isOwner && <td>
                <button onClick={() => handleEdit(p)}>{t('Edit')}</button>{' '}
                <button className="danger" onClick={() => { setDeleteError(''); setPendingDelete(p); }}>{t('Archive')}</button>
              </td>}
            </tr>
          ))}
        </tbody>
      </table></div>
      {!lowStockOnly && !loadingProducts && <Pagination page={productPage} size={PRODUCT_LIST_PAGE_SIZE} total={productTotal} onPageChange={setProductPage} />}
    </div>
  );
}
