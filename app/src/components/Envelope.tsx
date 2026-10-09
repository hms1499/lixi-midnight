import type { ReactNode } from 'react';

export type EnvelopeState = 'sealed' | 'opening' | 'opened' | 'out';

/** The large envelope on the Claim page. `opened` fades the flap and seal and lifts the slip out. */
export const Envelope = ({ state, label, children }: { state: EnvelopeState; label: string; children?: ReactNode }) => (
  <div className="envelope-xl" data-state={state} role="img" aria-label={label}>
    <span className="slip" aria-hidden="true">
      {children}
    </span>
    <span className="body" aria-hidden="true" />
    <span className="flap" aria-hidden="true" />
    <span className="seal" aria-hidden="true" />
  </div>
);

/** The claim page while it looks at the envelope; also what /c shows while its code loads (user moments spec §3.1). */
export const EnvelopeChecking = () => (
  <>
    <Envelope state="sealed" label="A sealed lì xì" />
    <p className="pt-4 text-paper-soft">Looking at the envelope…</p>
  </>
);
