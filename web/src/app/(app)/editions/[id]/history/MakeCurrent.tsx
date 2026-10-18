'use client';

import { useState, useTransition } from 'react';
import Icon from '@/components/Icon';
import { Modal, ModalHead } from '@/components/ui';
import { makeVersionCurrent } from '../../../books/edition-actions';

export function MakeCurrentButton({ editionId, number, name, current }: { editionId: string; number: string; name: string; current: { number: string; name: string } }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}><Icon name="history" size={16} /> Make this current</button>
      {open && (
        <Modal onClose={() => setOpen(false)} label="Make version current">
          <ModalHead title={`Go back to v${number}?`} pose="think" onClose={() => setOpen(false)} />
          <div className="stack">
            <p>“{name}” becomes the version you read and download. <strong>Nothing is deleted.</strong> v{current.number} “{current.name}” stays in the history, and you can switch back any time.</p>
            <p className="small muted">Reading progress stays on the same chapter.</p>
            {message && <p className="small status-bad">{message}</p>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => {
                const r = await makeVersionCurrent(editionId, number);
                if (!r.ok) setMessage(r.message); else setOpen(false);
              })}>{pending ? 'Switching…' : `Make v${number} current`}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
