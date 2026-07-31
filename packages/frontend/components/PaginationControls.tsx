export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export default function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination: PaginationState;
  onPageChange: (page: number) => void;
}) {
  if (pagination.total_pages <= 1) return null;

  return (
    <nav
      aria-label="Result pages"
      className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4"
    >
      <button
        type="button"
        disabled={pagination.page <= 1}
        onClick={() => onPageChange(pagination.page - 1)}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous page
      </button>
      <p className="text-sm text-slate-600">
        Page {pagination.page} of {pagination.total_pages} · {pagination.total}{" "}
        words
      </p>
      <button
        type="button"
        disabled={pagination.page >= pagination.total_pages}
        onClick={() => onPageChange(pagination.page + 1)}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next page
      </button>
    </nav>
  );
}
