const cellWidths = [68, 54, 62, 46, 73, 58, 42, 64, 51];

export default function SkeletonTableRows({ columns, rows = 6, label = 'Loading...' }) {
  return <>
    <tr className="skeleton-table-status-row">
      <td colSpan={columns}><span className="visually-hidden" role="status">{label}</span></td>
    </tr>
    {Array.from({ length: rows }, (_, row) => (
      <tr className="skeleton-table-row" aria-hidden="true" key={row}>
        {Array.from({ length: columns }, (_, column) => {
          const width = cellWidths[(column + row) % cellWidths.length] - (row % 2 ? 8 : 0);
          return <td key={column}><span className="skeleton-block skeleton-table-cell" style={{ width: `${width}%` }} /></td>;
        })}
      </tr>
    ))}
  </>;
}
