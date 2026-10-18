import { afterEach, describe, expect, it } from 'vitest';
import { noticeEmail, notify } from './notify';

describe('notice emails', () => {
  const d = { title: 'The Wonderful Wizard of Oz', edition: 'Age 7 · Read-aloud', editionId: 'e1' };
  it('links each notice to the right screen', () => {
    expect(noticeEmail('samples-ready', d).html).toContain('/editions/e1/samples');
    expect(noticeEmail('ready', d).html).toContain('/read/edition/e1');
    expect(noticeEmail('paused-cap', d).html).toContain('/editions/e1/progress');
    expect(noticeEmail('failed', { ...d, detail: 'x' }).subject).toContain('stuck');
  });
  it('escapes titles', () => {
    expect(noticeEmail('ready', { ...d, title: '<script>x</script>' }).html).not.toContain('<script>');
  });
  afterEach(() => { delete process.env.RESEND_API_KEY; });
  it('sends nothing without a Resend key, and never throws', async () => {
    delete process.env.RESEND_API_KEY;
    expect(await notify('e1', 'ready')).toEqual({ sent: false, reason: 'no key' });
  });
});
