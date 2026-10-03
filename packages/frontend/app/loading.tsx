export default function Loading() {
  return (
    <div role="status" className="mx-auto max-w-4xl p-8">
      <p className="text-sm text-slate-600">Opening your learning space…</p>
      <div aria-hidden="true" className="mt-8 space-y-4">
        <div className="skeleton h-10 w-2/3" />
        <div className="skeleton h-48" />
        <div className="skeleton h-24" />
      </div>
    </div>
  );
}
