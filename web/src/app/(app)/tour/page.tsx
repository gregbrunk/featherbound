import Tour from '../welcome/Tour';

export const metadata = { title: 'Tour · Featherbound' };

/** The product tour on its own, replayable any time. Key setup isn't part of it. */
export default function TourPage() {
  return (
    <main className="page page-narrow onboarding">
      <header className="onboarding-head">
        <h1>A quick tour</h1>
      </header>
      <Tour finishLabel="Back to my library" skipLabel="Close tour" exitHref="/" />
    </main>
  );
}
