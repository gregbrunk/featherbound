'use client';

import { useState } from 'react';
import KeySetup from './KeySetup';
import Tour from './Tour';

/** First run for a new account: the tour, then key setup (which only ever runs once). */
export default function Onboarding({ first, saved }: { first?: string; saved: { gateway?: string; anthropic?: string } }) {
  const [phase, setPhase] = useState<'tour' | 'keys'>('tour');
  const toKeys = () => { setPhase('keys'); window.scrollTo({ top: 0 }); };
  return (
    <main className="page page-narrow onboarding">
      <header className="onboarding-head">
        <h1>{phase === 'tour' ? `Welcome${first ? `, ${first}` : ''}!` : 'One last thing'}</h1>
        <ol className="onboarding-phases" aria-label="Setup">
          <li className={phase === 'tour' ? 'now' : 'done'} aria-current={phase === 'tour' ? 'step' : undefined}>1 · Quick tour</li>
          <li className={phase === 'keys' ? 'now' : ''} aria-current={phase === 'keys' ? 'step' : undefined}>2 · Your AI key</li>
        </ol>
      </header>
      {phase === 'tour'
        ? <Tour onFinish={toKeys} finishLabel="Set up my key" onSkip={toKeys} skipLabel="Skip tour" />
        : <KeySetup saved={saved} onBack={() => setPhase('tour')} />}
    </main>
  );
}
