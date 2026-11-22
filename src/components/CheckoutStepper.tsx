import React from 'react';
import { Check } from 'lucide-react';

export interface CheckoutStepMeta {
  number: number;
  shortTitle: string;
  title: string;
  subtitle: string;
}

interface CheckoutStepperProps {
  steps: CheckoutStepMeta[];
  currentStep: number;
  maxReachedStep: number;
  onStepSelect: (step: number) => void;
}

export const CheckoutStepper: React.FC<CheckoutStepperProps> = ({
  steps,
  currentStep,
  maxReachedStep,
  onStepSelect,
}) => {
  const activeStep = steps.find((s) => s.number === currentStep) || steps[0];
  const remaining = Math.max(0, steps.length - currentStep);

  return (
    <nav aria-label="Checkout progress" className="space-y-4">
      {/* 1 — 2 — 3 — 4 — 5 Horizontal Progress Rail */}
      <ol className="flex items-start justify-between w-full">
        {steps.map((step, idx) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;
          const isClickable =
            step.number < currentStep ||
            (step.number <= maxReachedStep && step.number !== currentStep);

          return (
            <React.Fragment key={step.number}>
              <li className="flex flex-col items-center text-center shrink-0">
                <button
                  type="button"
                  disabled={!isClickable}
                  onClick={() => isClickable && onStepSelect(step.number)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Step ${step.number}: ${step.title}${
                    isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''
                  }`}
                  className={`h-10 w-10 sm:h-11 sm:w-11 rounded-full font-mono text-xs font-semibold tabular-nums flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform] duration-180 focus-visible:outline-2 focus-visible:outline-[#0A0A0A] focus-visible:outline-offset-2 ${
                    isCurrent
                      ? 'bg-[#0A0A0A] text-white border border-[#0A0A0A] ring-4 ring-[#0A0A0A]/12 cursor-default'
                      : isCompleted
                      ? 'bg-[#0A0A0A] text-white border border-[#0A0A0A] hover:bg-[#292929] active:scale-95 cursor-pointer'
                      : isClickable
                      ? 'bg-white text-[#0A0A0A] border border-[#5C5C5C] hover:border-[#0A0A0A] active:scale-95 cursor-pointer'
                      : 'bg-white text-[#808080] border border-[#D9D9D9] cursor-not-allowed'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" strokeWidth={2.25} />
                  ) : (
                    <span>{step.number}</span>
                  )}
                </button>
                <span
                  className={`hidden sm:block mt-2 text-[11px] tracking-[0.04em] whitespace-nowrap transition-colors ${
                    isCurrent
                      ? 'font-semibold text-[#0A0A0A]'
                      : isCompleted
                      ? 'font-medium text-[#292929]'
                      : 'font-normal text-[#808080]'
                  }`}
                >
                  {step.shortTitle}
                </span>
              </li>

              {idx < steps.length - 1 && (
                <li
                  aria-hidden="true"
                  className="flex-1 flex items-center h-10 sm:h-11 px-1.5 sm:px-3"
                >
                  <div className="w-full h-[1.5px] bg-[#D9D9D9] overflow-hidden rounded-full">
                    <div
                      className="h-full bg-[#0A0A0A] transition-transform duration-250 ease-out origin-left"
                      style={{
                        transform:
                          step.number < currentStep ? 'scaleX(1)' : 'scaleX(0)',
                      }}
                    />
                  </div>
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>

      {/* Current Step Context Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs border-t border-[#D9D9D9]/80">
        <div className="flex items-center gap-2 text-[#0A0A0A]">
          <span className="font-mono font-semibold tabular-nums uppercase tracking-[0.12em] text-[11px]">
            Step {currentStep} of {steps.length}
          </span>
          <span aria-hidden="true" className="text-[#808080]">
            ·
          </span>
          <span className="font-medium text-[#292929]">{activeStep.title}</span>
        </div>
        <span className="font-mono text-[11px] text-[#5C5C5C] tabular-nums">
          {remaining === 0
            ? 'Final step'
            : `${remaining} step${remaining === 1 ? '' : 's'} remaining`}
        </span>
      </div>
    </nav>
  );
};
