import { useEffect, useState } from 'react';
import api from '../api';
import { useLanguage } from '../i18n';
import { useAuth } from '../auth';
import useSessionState from '../useSessionState';

const emptyForm = {
  name: '', sku: '', description: '', size: '', color: '',
  price: '', cost: '', stockQuantity: 0, category: '', active: true
};

export default function Products() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isOwner = user.role === 'OWNER';
  const draftKey = user.id || user.email || 'current-user';
  const [products, setProducts] = useState(/** @type {import('../types').Product[]} */ ([]));
  const [categories, setCategories] = useState(/** @type {import('../types').Category[]} */ ([]));
  const [search, setSearch] = useSessionState(`retail-draft:${draftKey}:products-search`, '');
  const [form, setForm] = useSessionState(`retail-draft:${draftKey}:product-form`, emptyForm);
  const [editingId, setEditingId] = useSessionState(`retail-draft:${draftKey}:product-editing`, null);
  const [error, setError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(/** @type {import('../types').Product | null} */ (null));
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const minimumPrice = Math.ceil((Number(form.cost || 0) * 1.15 - Number.EPSILON) * 100) / 100;

  const load = () => {
    const config = search ? { params: { search } } : {};
    api.get('/products', config).then(r => setProducts(r.data));
  };

  useEffect(() => { load(); }, [search]);
  useEffect(() => { api.get('/categories').then(r => setCategories(r.data)); }, []);

  const getError = (err) =>
    err.response && err.response.data && err.response.data.error ? err.response.data.error : t('Request failed');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const resetPage = () => {
    setSearch('');
    setForm(emptyForm);
    setEditingId(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
    try {
      if (editingId) await api.put('/products/' + editingId, payload);
      else await api.post('/products', payload);
      setForm(emptyForm);
      setEditingId(null);
      load();
    } catch (err) {
      setError(getError(err));
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
      load();
    } catch (err) {
      setDeleteError(getError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="products-page">
      <header className="products-heading">
        <div><span className="eyebrow">{t('INVENTORY')}</span><h1>{t('Products')}</h1><p>{t('Manage your products, stock, and selling prices.')}</p></div>
        <div className="products-count"><strong>{products.length}</strong><span>{t('products')}</span></div>
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
            <button type="button" className="danger" disabled={deleting} onClick={handleDelete}>{deleting ? '…' : t('Archive')}</button>
          </div>
        </section>
      </div>}

      {isOwner && <form className="form-grid product-form" onSubmit={handleSubmit}>
        <div className="product-form-title"><div><h2>{t(editingId ? 'Edit product' : 'Add a product')}</h2><p>{t('Set your default selling price and stock details.')}</p></div>{editingId && <span className="editing-badge">{t('Editing')}</span>}</div>
        <label className="product-field"><span>{t('Name *')}</span><input name="name" placeholder={t('e.g. Silk saree')} value={form.name} onChange={handleChange} required /></label>
        <label className="product-field"><span>{t('SKU')}</span><input name="sku" placeholder={t('Optional product code')} value={form.sku} onChange={handleChange} /></label>
        <label className="product-field"><span>{t('Price *')}</span><input name="price" type="number" min={minimumPrice} step="0.01" placeholder="0.00" value={form.price} onChange={handleChange} required /><small>{t('Default selling price')}</small></label>
        <label className="product-field"><span>{t('Cost')}</span><input name="cost" type="number" min="0" step="0.01" placeholder="0.00" value={form.cost} onChange={handleChange} /><small>{t('Minimum price')}: Rs. {minimumPrice.toFixed(2)}</small></label>
        <label className="product-field"><span>{t('Stock Qty')}</span><input name="stockQuantity" type="number" min="0" placeholder="0" value={form.stockQuantity} onChange={handleChange} /></label>
        <label className="product-field"><span>{t('Size (S/M/L/XL)')}</span><input name="size" placeholder={t('e.g. S / M / XL')} value={form.size} onChange={handleChange} /></label>
        <label className="product-field"><span>{t('Color')}</span><input name="color" placeholder={t('e.g. Maroon')} value={form.color} onChange={handleChange} /></label>
        <label className="product-field"><span>{t('Category')}</span><select name="category" value={form.category} onChange={handleChange}>
          <option value="">{t('No category')}</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
        <label className="product-field product-description"><span>{t('Description')}</span><input name="description" placeholder={t('Optional details')} value={form.description} onChange={handleChange} /></label>
        <div className="product-form-footer"><label className="checkbox-label"><input type="checkbox" name="active" checked={form.active} onChange={handleChange} /> {t('Active')}</label>
          <div className="form-actions"><button type="submit">{t(editingId ? 'Update Product' : 'Add Product')}</button>{editingId && <button type="button" className="muted" onClick={() => { setEditingId(null); setForm(emptyForm); }}>{t('Cancel')}</button>}</div>
        </div>
      </form>}

      <div className="products-list-heading"><div><h2>{t('Product list')}</h2><p>{t('Search and update your inventory.')}</p></div><div className="products-list-controls"><input className="search-box" aria-label={t('Search by name or SKU...')} placeholder={t('Search by name or SKU...')} value={search} onChange={e => setSearch(e.target.value)} /><button type="button" className="muted" onClick={resetPage}>{t('Reset')}</button></div></div>

      <div className="table-wrap"><table className="products-table">
        <thead><tr><th>{t('Name')}</th><th>{t('SKU')}</th><th>{t('Category')}</th><th>{t('Size (S/M/L/XL)')}</th><th>{t('Color')}</th><th>{t('Price')}</th><th>{t('Stock')}</th><th>{t('Status')}</th>{isOwner && <th>{t('Actions')}</th>}</tr></thead>
        <tbody>
          {products.length === 0 && <tr><td className="products-empty" colSpan={isOwner ? 9 : 8}>{t('No products found')}</td></tr>}
          {products.map(p => (
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
    </div>
  );
}
