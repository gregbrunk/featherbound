import Link from 'next/link';
import Icon from './Icon';

type Budget = { budget: number; spent: number; month: string };
const money = (n: number) => `$${n < 10 ? n.toFixed(2) : n.toFixed(0)}`;

/** A gentle warning when this run would take the month past the budget set in Settings. */
export default function BudgetNote({ status, cost }: { status: Budget | null; cost: number }) {
  if (!status) return null;
  const after = status.spent + cost;
  if (after < status.budget * 0.9) return null;
  const over = after > status.budget;
  return (
    <p className={`small budget-note ${over ? 'over' : ''}`} role="note">
      <Icon name="info" size={14} />{' '}
      {over
        ? <>This would bring {status.month} to about {money(after)}, over your {money(status.budget)} monthly budget. </>
        : <>This would bring {status.month} to about {money(after)} of your {money(status.budget)} monthly budget. </>}
      <Link href="/settings?tab=usage">See usage</Link>
    </p>
  );
}
