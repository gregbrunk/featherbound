import ErrorState from '@/components/ErrorState';

export default function NotFound() {
  return <ErrorState pose="think" title="I can’t find that page" message="It may have been deleted, or the link is out of date. Everything in your library is still where you left it." />;
}
