import { requireAccount } from '@/lib/session';
import { accountPrefix } from '@/lib/storage';
import AddBook from './AddBook';

// Reads the session on every request; see the note in (app)/layout.tsx.
export const instant = false;

export const metadata = { title: 'Add a book · Featherbound' };

export default async function AddPage() {
  const { userId } = await requireAccount();
  return <AddBook uploadPrefix={`${accountPrefix(userId)}uploads/`} />;
}
