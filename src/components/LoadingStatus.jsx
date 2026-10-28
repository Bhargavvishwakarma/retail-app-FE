export default function LoadingStatus({ children, className = '' }) {
  return (
    <div className={`loading-status${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
