import { requireAccount } from '@/lib/session';
import { SignOutButton } from './AuthButtons';

export default async function AccountMenu() {
  const { email, image } = await requireAccount();
  return (
    <details className="account-menu">
      <summary className="avatar" title={email} aria-label="Account">
        {/* Google profile photo; tiny and external, so next/image isn't worth configuring. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img src={image} alt="" referrerPolicy="no-referrer" /> : email[0]?.toUpperCase()}
      </summary>
      <div className="popover">
        <p className="small muted ellipsis">{email}</p>
        <SignOutButton className="btn btn-secondary btn-sm" />
      </div>
    </details>
  );
}
