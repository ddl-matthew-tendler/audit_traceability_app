import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hoverable info icon that explains what "Usage class" means,
 * how it's inferred, and what each value represents.
 */
export function UsageClassInfo({ compact = false }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (!visible || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      tooltipRef.current.style.left = 'auto';
      tooltipRef.current.style.right = '0';
      tooltipRef.current.style.transform = 'none';
    }
    if (rect.left < 8) {
      tooltipRef.current.style.left = '0';
      tooltipRef.current.style.right = 'auto';
      tooltipRef.current.style.transform = 'none';
    }
  }, [visible]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline-flex cursor-help items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <svg
        className={`shrink-0 text-[#9B9BAF] ${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-[9999] mb-2 w-80 -translate-x-1/2 rounded-lg border border-[#E0E0E0] bg-white p-4 shadow-xl"
        >
          <p className="mb-2 text-sm font-semibold text-[#2E2E38]">What is Usage Class?</p>
          <p className="mb-3 text-xs leading-relaxed text-[#3F4547]">
            Usage class is an <strong>inferred label</strong> applied to each execution record
            to identify whether the run used <strong>SAS</strong> (SAS Institute software) or{' '}
            <strong>SLC</strong> (SAS Language Compiler / Altair SLC — a SAS-language alternative).
            It helps track SAS-to-SLC migration progress.
          </p>

          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#7F8385]">
            How it's measured
          </p>
          <p className="mb-3 text-xs leading-relaxed text-[#3F4547]">
            Each run is classified by pattern-matching three fields in priority order:
          </p>
          <ol className="mb-3 space-y-1.5 text-xs text-[#3F4547]">
            <li className="flex gap-2">
              <span className="shrink-0 font-semibold text-[#543FDE]">1.</span>
              <span><strong>Command</strong> — the run command or script name (highest priority)</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-semibold text-[#543FDE]">2.</span>
              <span><strong>Environment</strong> — the Domino environment name</span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 font-semibold text-[#543FDE]">3.</span>
              <span><strong>Target name</strong> — the workspace or job name (lowest priority)</span>
            </li>
          </ol>

          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#7F8385]">
            Classification values
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-[#543FDE]" />
              <span>
                <strong>SAS</strong> — matched keywords: <code className="rounded bg-[#F5F5F7] px-1 text-[11px]">sas</code>,{' '}
                <code className="rounded bg-[#F5F5F7] px-1 text-[11px]">proc</code>,{' '}
                <code className="rounded bg-[#F5F5F7] px-1 text-[11px]">libname</code>,{' '}
                <code className="rounded bg-[#F5F5F7] px-1 text-[11px]">data ... ;</code>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-[#0070CC]" />
              <span>
                <strong>SLC</strong> — matched keywords: <code className="rounded bg-[#F5F5F7] px-1 text-[11px]">slc</code>,{' '}
                <code className="rounded bg-[#F5F5F7] px-1 text-[11px]">altair</code>,{' '}
                <code className="rounded bg-[#F5F5F7] px-1 text-[11px]">wps</code>,{' '}
                <code className="rounded bg-[#F5F5F7] px-1 text-[11px]">hubcli</code>
              </span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm bg-[#C0C0C0]" />
              <span>
                <strong>Unknown</strong> — no SAS or SLC keywords detected (e.g. Python, R, Jupyter, or missing data)
              </span>
            </div>
          </div>

          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-[#E0E0E0] bg-white" />
        </div>
      )}
    </span>
  );
}
