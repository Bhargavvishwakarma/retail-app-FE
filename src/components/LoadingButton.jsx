export default function LoadingButton({ loading = false, loadingText, children, className = '', disabled, ...props }) {
  return (
    <button
      {...props}
      className={`loading-button${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className="button-spinner" aria-hidden="true" />}
      <span aria-live={loading ? 'polite' : undefined}>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}
