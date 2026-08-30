export function StaticPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <div className="prose prose-slate mt-6 max-w-none text-[13px] leading-relaxed text-slate-600">{children}</div>
      </div>
    </div>
  );
}
