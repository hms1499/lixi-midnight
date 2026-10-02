import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { Light } from './Light';

export type Tone = 'primary' | 'quiet' | 'home';

const TONES: Record<Tone, string> = {
  primary: 'bg-lantern-deep text-white hover:bg-[#bd2334]',
  quiet: 'border border-white/15 text-paper hover:border-lantern',
  home: 'bg-seal text-seal-ink hover:bg-[#e7b53d]',
};

export const buttonClass = (tone: Tone = 'primary', extra = '') =>
  `inline-flex items-center justify-center gap-2 rounded-md px-4 py-2.5 font-semibold transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 ${TONES[tone]} ${extra}`;

export const Button = ({
  tone = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) => (
  <button {...props} className={buttonClass(tone, className)} />
);

/** A react-router link that looks like a button. */
export const ButtonLink = ({ tone = 'primary', className = '', ...props }: LinkProps & { tone?: Tone }) => (
  <Link {...props} className={buttonClass(tone, className)} />
);

const NOTICE: Record<'info' | 'warn' | 'error', { light: 'lit' | 'home' | 'out'; text: string }> = {
  info: { light: 'lit', text: 'text-paper-soft' },
  warn: { light: 'home', text: 'text-seal' },
  error: { light: 'out', text: 'text-error' },
};

/** A message with a small light as its glyph: no boxes, no coloured rules (spec §5.5). */
export const Notice = ({ tone = 'info', children }: { tone?: keyof typeof NOTICE; children: ReactNode }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-3 ${NOTICE[tone].text}`}>
    <Light state={NOTICE[tone].light} size="sm" className="mt-1" />
    <div>{children}</div>
  </div>
);

export const Working = ({ children }: { children: ReactNode }) => (
  <p role="status" className="flex items-center gap-3 text-paper-soft">
    <Light state="pending" size="sm" />
    {children}
  </p>
);

/** A Vietnamese greeting in Playwrite VN (spec §4.2). */
export const Greeting = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <p lang="vi" className={`font-hand text-lg font-extralight text-seal ${className}`}>
    {children}
  </p>
);

/** An external place as an icon with its name on hover and focus (spec §5.4). */
export const IconLink = ({
  label,
  href,
  children,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { label: string; href: string; children: ReactNode }) => (
  <a {...rest} href={href} target="_blank" rel="noreferrer" aria-label={label} className="icon-link">
    {children}
    <span className="tip" aria-hidden="true">
      {label}
    </span>
  </a>
);
