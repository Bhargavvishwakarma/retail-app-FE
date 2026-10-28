export default function LoadingButton({ loading = false, loadingText, children, className = '', disabled, ...props }) {
  return (
    <button
      {...props}
      className={`loading-button${className ? ` ${className}` : ''}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {loading && loadingText
        ? <span aria-live="polite">{loadingText}</span>
        : children}
    </button>
  );
}
