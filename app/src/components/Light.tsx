import type { CSSProperties } from 'react';

/** What a light says about its lì xì (frontend spec §3). */
export type LightState = 'lit' | 'out' | 'home' | 'ghost' | 'pending';

type LightProps = {
  readonly state: LightState;
  readonly size?: 'sm' | 'md' | 'lg';
  /** Accessible name, for example "Lì xì 2: 1.2 tNIGHT, waiting". Without one the light is decoration. */
  readonly label?: string;
  /** Focusable with a tooltip (Dashboard). */
  readonly focusable?: boolean;
  readonly className?: string;
  readonly style?: CSSProperties;
};

/** One lì xì as a small glowing envelope. */
export const Light = ({ state, size = 'md', label, focusable = false, className = '', style }: LightProps) => (
  <span
    className={`light ${className}`}
    data-state={state}
    data-size={size}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    tabIndex={focusable ? 0 : undefined}
    style={style}
  >
    {focusable && label && (
      <span className="tip" aria-hidden="true">
        {label}
      </span>
    )}
  </span>
);
