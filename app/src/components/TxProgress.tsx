import { useEffect, useState } from 'react';
import { TX_STAGES, type ProverChoice, type TxStage } from '../chain/port';

const ROWS: Record<TxStage, { label: string; sub?: (prover: ProverChoice) => string }> = {
  proving: { label: 'Making the zero-knowledge proof', sub: (p) => (p === 'local' ? 'On this computer' : 'In 1AM') },
  confirm: { label: 'Confirm in 1AM', sub: () => '1AM pays the fee.' },
  sending: { label: 'Sending to Midnight' },
  waiting: { label: 'Waiting for a block' },
};

/** Whole seconds since `key` last changed. */
const useSecondsSince = (key: unknown): number => {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [key]);
  return seconds;
};

/**
 * Where a transaction is, row by row (user moments spec §3.4). Finished rows show a check, the current
 * row a pulsing dot (in flight) and its own seconds, later rows are dim. Marks are CSS, not lights.
 */
export const TxProgress = ({ stage, prover }: { stage?: TxStage; prover: ProverChoice }) => {
  const current = TX_STAGES.indexOf(stage ?? 'proving');
  const seconds = useSecondsSince(current);
  return (
    <div className="space-y-2 text-left">
      <p role="status" className="sr-only">
        {ROWS[TX_STAGES[current]].label}
      </p>
      <ol aria-label="Transaction progress" className="space-y-2.5">
        {TX_STAGES.map((s, i) => {
          const state = i < current ? 'done' : i === current ? 'now' : 'later';
          const row = ROWS[s];
          return (
            <li key={s} data-state={state} className="tx-row flex items-start gap-3">
              <span className="tx-mark" aria-hidden="true" />
              <span className="flex-1">
                <span className={state === 'later' ? 'text-paper-dim' : 'text-paper'}>{row.label}</span>
                <span className="sr-only">{state === 'done' ? ', done' : state === 'now' ? ', in progress' : ''}</span>
                {row.sub && <span className="block text-sm text-paper-dim">{row.sub(prover)}</span>}
              </span>
              {state === 'now' && (
                <span className="text-sm text-paper-dim" aria-hidden="true">
                  {seconds} s
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
