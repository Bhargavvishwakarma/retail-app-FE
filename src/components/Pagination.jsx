import { useLanguage } from '../i18n';

export default function Pagination({ page, size, total, onPageChange }) {
  const { t } = useLanguage();
  const pageCount = Math.ceil(total / size);
  if (pageCount < 2) return null;

  return (
    <nav className="pagination" aria-label={t('Pagination')}>
      <button type="button" className="muted" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
        {t('Previous')}
      </button>
      <span>{t('Page')} {page + 1} {t('of')} {pageCount}</span>
      <button type="button" className="muted" onClick={() => onPageChange(page + 1)} disabled={page + 1 >= pageCount}>
        {t('Next')}
      </button>
    </nav>
  );
}
