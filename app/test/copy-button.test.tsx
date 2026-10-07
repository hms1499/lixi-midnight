// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CopyButton } from '../src/components/CopyButton';

afterEach(cleanup);

describe('CopyButton', () => {
  it('says the copy failed when the browser has no Clipboard API, instead of doing nothing', async () => {
    const before = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    try {
      render(<CopyButton text="https://lixi.test/c#secret" label="Copy link" />);
      fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
      await screen.findByText('Copy failed: select it and copy');
    } finally {
      if (before) Object.defineProperty(navigator, 'clipboard', before);
      else delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });
});
