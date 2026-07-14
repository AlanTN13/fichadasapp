const FLOW_STEPS = ['Sede', 'DNI', 'Foto', 'Confirmacion'];

export default function FlowStepIndicator({ currentStep = 0 }) {
  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-4 gap-1 rounded-2xl border border-slate-200 bg-white/80 px-2 py-2.5 sm:gap-2 sm:px-4 sm:py-3">
      {FLOW_STEPS.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div key={step} className="flex min-w-0 items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                isCompleted
                  ? 'bg-emerald-100 text-emerald-700'
                  : isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {index + 1}
            </div>
            <span
              className={`hidden min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.18em] sm:block ${
                isActive ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              {step}
            </span>
            {index < FLOW_STEPS.length - 1 && (
              <div className="hidden h-px flex-1 bg-slate-200 md:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}
