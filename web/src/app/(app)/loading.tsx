import PageLoading from '@/components/PageLoading';

// Gives every signed-in page its own Suspense boundary, so navigation shows Tuft instantly
// while the page reads the session and the database.
export default PageLoading;
