import { useEffect, useState } from 'react';
import { TX_STAGES, type ProverChoice, type TxStage } from '../chain/port';

const ROWS: Record<TxStage, { label: string; sub?: (prover: ProverChoice) => string }> = {
  proving: { label: 'Making the zero-knowledge proof', sub: (p) => (p === 'local' ? 'On this computer' : 'In 1AM') },
  confirm: { label: 'Confirm in 1AM', sub: () => '1AM pays the fee.' },
  sending: { label: 'Sending to Midnight' },
  waiting: { label: 'Waiting for a block' },
};

/** Whole seconds since `key` last changed. A new key shows 0 on its first paint, before the timer restarts. */
const useSecondsSince = (key: unknown): number => {
  const [count, setCount] = useState({ key, seconds: 0 });
  useEffect(() => {
    const timer = setInterval(() => setCount((c) => ({ key, seconds: c.key === key ? c.seconds + 1 : 1 })), 1000);
    return () => clearInterval(timer);
  }, [key]);
  return count.key === key ? count.seconds : 0;
};

/**
 * Where a transaction is, row by row (user moments spec §3.4). Finished rows show a check, the current
 * row a pulsing dot (in flight) and its own seconds, later rows are dim. Marks are CSS, not lights.
 */
export const TxProgress = ({ stage, prover }: { stage?: TxStage; prover: ProverChoice }) => {
  const current = TX_STAGES.indexOf(stage ?? 'proving');
  const seconds = useSecondsSince(current);
  // Screen readers often skip what a live region holds when it is inserted, so it starts empty and fills after.
  const label = ROWS[TX_STAGES[current]].label;
  const [announced, setAnnounced] = useState('');
  useEffect(() => setAnnounced(label), [label]);
  return (
    <div className="space-y-2 text-left">
      <p role="status" className="sr-only">
        {announced}
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
