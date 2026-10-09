import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withoutUrls } from '../lib/redact.ts';

test('error text loses every URL, so a claim link and its secret never reach the terminal', () => {
  const e = new Error(
    'page.goto: net::ERR_FAILED at https://lixi-3nv.pages.dev/c#v1.SECRET\nnavigating to "https://x.dev/c#g1.S"',
  );
  const out = withoutUrls(e);
  assert.doesNotMatch(out.message, /SECRET|#v1|#g1|https?:/);
  assert.match(out.message, /page\.goto: net::ERR_FAILED at <url>/);
});
