import { useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Input,
  Pill,
  Section,
  PermissionState,
} from '../components/ui';
import { useSession, ROLE_LABEL } from '../demo/session';
import { AUDIT, branchById } from '../demo/data';

/**
 * The audit log.
 *
 * Normally this renders in context — a member's history on the member, a
 * payment's reversal on the payment. This global view exists for the other
 * question: "what did this person do", rather than "what happened to this
 * record".
 *
 * Financial entries are never hard-deleted. A correction posts a reversal,
 * and both the original and the reversal stay visible here.
 */
export function AuditLog() {
  const { allowed, branchId, canRollUp, branches } = useSession();
  const [q, setQ] = useState('');

  if (!allowed('audit_log.view')) {
    return (
      <div className="page">
        <PermissionState what="the audit log" who="an Admin or the accountant" />
      </div>
    );
  }

  const scope = canRollUp ? branchId : (branches[0]?.id ?? null);
  const rows = AUDIT.filter((a) => {
    if (scope && a.branchId !== scope) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return (
      a.actor.toLowerCase().includes(t) ||
      a.action.toLowerCase().includes(t) ||
      a.detail.toLowerCase().includes(t)
    );
  });

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">{scope ? branchById(scope).name : 'All branches'}</span>
          <h1 className="page__title">Audit log</h1>
          <p className="page__lede">
            Every change, who made it, and when. It cannot be switched off — MCA rules require it,
            and a cash business needs it.
          </p>
        </div>
        <div className="page__actions">
          <Button variant="secondary" icon="download">
            Export
          </Button>
        </div>
      </div>

      <Input
        icon="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by person, action, or detail…"
        aria-label="Search the audit log"
      />

      <Section eyebrow={`${rows.length} entries`} title="Recent activity">
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon="book"
              title={`Nothing matches “${q}”`}
              body="Try a person's name, or an action like payment.reverse."
            />
          </Card>
        ) : (
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            {rows.map((a, i) => (
              <div className="audit rise" key={a.id} style={{ '--i': i } as React.CSSProperties}>
                <span className={`attention__icon ${a.reversal ? 'attention__icon--bad' : 'attention__icon--neutral'}`}>
                  <Icon name={a.reversal ? 'refresh' : 'check'} size={17} />
                </span>
                <div className="audit__body">
                  <div className="audit__head">
                    <span style={{ fontWeight: 'var(--w-semibold)' }}>{a.actor}</span>
                    <Pill tone="neutral" small icon="shield">
                      {ROLE_LABEL[a.actorRole]}
                    </Pill>
                    <code className="audit__action">{a.action}</code>
                    {a.reversal ? (
                      <Pill tone="bad" small icon="refresh">
                        Reversal
                      </Pill>
                    ) : null}
                  </div>
                  <div className="audit__detail">{a.detail}</div>
                </div>
                <div className="audit__meta">
                  <span>{a.at}</span>
                  <span>{branchById(a.branchId).short}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Card pad>
        <p className="card__sub" style={{ maxWidth: '72ch' }}>
          Financial records are never hard-deleted. When a receipt is wrong, a credit note is
          posted against it and both entries remain — which is what makes the books trustworthy
          rather than merely tidy.
        </p>
      </Card>
    </div>
  );
}
