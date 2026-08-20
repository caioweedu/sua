// Esqueleto de carregamento da administração. Como fica dentro do layout
// (AdminShell), a sidebar continua na tela e só a área de conteúdo mostra este
// placeholder — o clique num menu responde na hora, mesmo com o banco acordando.
export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="h-4 w-72 rounded bg-slate-100" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
              <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
              <div className="space-y-2.5">
                <div className="h-4 w-full rounded bg-slate-100" />
                <div className="h-4 w-5/6 rounded bg-slate-100" />
                <div className="h-4 w-4/6 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="mb-4 h-5 w-32 rounded bg-slate-200" />
            <div className="space-y-2.5">
              <div className="h-9 w-full rounded-lg bg-slate-100" />
              <div className="h-9 w-full rounded-lg bg-slate-100" />
              <div className="h-9 w-2/3 rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
