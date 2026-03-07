import type { ExecutiveInsightReport } from '../utils/executiveInsights';
import { useAppStore } from '../store/useAppStore';

interface ExecutiveBriefingProps {
  report: ExecutiveInsightReport;
}

export function ExecutiveBriefing({ report }: ExecutiveBriefingProps) {
  const setViewMode = useAppStore((state) => state.setViewMode);

  return (
    <section className="mb-8 overflow-hidden rounded-xl border border-[#D9DDF6] bg-[linear-gradient(135deg,#F8F8FF_0%,#EEF2FF_45%,#FFFFFF_100%)] shadow-sm">
      <div className="border-b border-[#D9DDF6] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#C7CEFA] bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4D46D8]">
            AI Briefing
          </span>
          <span className="text-xs text-[#6C7280]">Generated from current audit, run, adoption, and coverage signals</span>
        </div>
        <h3 className="mt-3 text-xl font-semibold text-[#242938]">{report.headline}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#596071]">{report.summary}</p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1.5fr_1fr]">
        <div className="border-b border-[#D9DDF6] px-5 py-5 lg:border-b-0 lg:border-r">
          <h4 className="text-sm font-semibold text-[#2E3442]">What matters now</h4>
          <div className="mt-3 space-y-3">
            {report.findings.map((finding) => (
              <div key={finding} className="rounded-lg border border-white/80 bg-white/80 px-4 py-3 text-sm leading-6 text-[#3F4547] shadow-sm">
                {finding}
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-5">
          <h4 className="text-sm font-semibold text-[#2E3442]">Recommended next steps</h4>
          <div className="mt-3 space-y-3">
            {report.recommendations.map((recommendation) => (
              <button
                key={recommendation.title}
                type="button"
                onClick={() => setViewMode(recommendation.targetView)}
                className="w-full rounded-lg border border-[#D9DDF6] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[#B9C2F7] hover:bg-[#F8F9FF]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#2E3442]">{recommendation.title}</p>
                  <span className="rounded-full bg-[#EEF1FF] px-2 py-1 text-[11px] font-medium text-[#4D46D8]">
                    Open view
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-[#5F6677]">{recommendation.body}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
