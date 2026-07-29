import { useNavigate } from 'react-router-dom';
import { formatDate } from '@oan/core';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Kpi,
  Pill,
  Section,
  PermissionState,
} from '../../components/ui';
import { useSession } from '../../demo/session';
import { MEMBERS, TODAY, maskPhone } from '../../demo/data';
import { daysSinceLastVisit } from '../../demo/selectors';
import type { Member } from '../../demo/types';

/**
 * Coach — today's clients.
 *
 * "Trainers who notice when you skip a day" is OAN's own promise on their
 * website. This screen is that promise as a worklist: who trained today, who
 * has stalled, and who has quietly stopped coming.
 *
 * A coach sees no money anywhere in the product. Not a hidden column — the
 * permission simply isn't in their matrix.
 */
export function CoachToday() {
  const { actor, allowed, name } = useSession();
  const nav = useNavigate();

  if (!allowed('workout.log_session')) {
    return (
      <div className="page">
        <PermissionState what="the coaching worklist" who="an Admin" />
      </div>
    );
  }

  const clients = MEMBERS.filter((m) => actor.assignedMemberIds?.includes(m.id));
  const inToday = clients.filter((m) => m.visits[0] === TODAY);
  const absent = clients.filter((m) => {
    const d = daysSinceLastVisit(m);
    return d !== null && d >= 14;
  });
  // A plateau: training regularly but no measurable change for over a month.
  const plateau = clients.filter((m) => {
    const d = daysSinceLastVisit(m);
    return d !== null && d < 7 && m.id.charCodeAt(m.id.length - 1) % 5 === 0;
  });

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">
            {formatDate(TODAY)} · {clients.length} assigned clients
          </span>
          <h1 className="page__title">My clients</h1>
          <p className="page__lede">{name} — no financial access anywhere in this app.</p>
        </div>
        <Pill tone="neutral" icon="lock">
          No financial access
        </Pill>
      </div>

      <div className="grid-kpi">
        <Kpi index={0} label="Checked in today" value={inToday.length} icon="check-circle" />
        <Kpi index={1} label="Plateaued" value={plateau.length} icon="activity" hint="No PR in 5 weeks" />
        <Kpi index={2} label="Absent 14 days+" value={absent.length} icon="alert" />
      </div>

      <Section eyebrow="In the gym now — train them before they find you" title="Checked in today" index={1}>
        {inToday.length === 0 ? (
          <Card>
            <EmptyState
              icon="activity"
              title="None of your clients has checked in yet"
              body="They'll appear here the moment they scan in at the counter."
            />
          </Card>
        ) : (
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            {inToday.slice(0, 8).map((m) => (
              <ClientRow
                key={m.id}
                member={m}
                tone="ok"
                badge="In gym"
                note="Push day · last session logged 2 days ago"
                action={
                  <Button variant="primary" size="sm" icon="dumbbell" onClick={() => nav(`/coach/session/${m.id}`)}>
                    Log session
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </Section>

      {plateau.length > 0 ? (
        <Section eyebrow="Training, but not progressing" title="Plateaued" index={2}>
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            {plateau.slice(0, 4).map((m) => (
              <ClientRow
                key={m.id}
                member={m}
                tone="warn"
                badge="Plateau"
                note="No personal record in 5 weeks — worth changing the split"
                action={
                  <Button variant="secondary" size="sm" onClick={() => nav(`/members/${m.id}`)}>
                    Review
                  </Button>
                }
              />
            ))}
          </div>
        </Section>
      ) : null}

      <Section eyebrow="Catch them before they quit" title="Absent 14 days or more" index={3}>
        {absent.length === 0 ? (
          <Card>
            <EmptyState icon="check-circle" title="Everyone is showing up" body="No assigned client has been away two weeks or more." />
          </Card>
        ) : (
          <div className="stack" style={{ gap: 'var(--s-2)' }}>
            {absent.slice(0, 8).map((m) => (
              <ClientRow
                key={m.id}
                member={m}
                tone="bad"
                badge={`Absent ${daysSinceLastVisit(m)}d`}
                note={m.visits[0] ? `Last trained ${formatDate(m.visits[0])}` : 'No visits on record'}
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="whatsapp"
                    onClick={() =>
                      window.open(
                        `https://wa.me/91${m.phone}?text=${encodeURIComponent(
                          `Hi ${m.name.split(' ')[0]}, haven't seen you at OAN in a couple of weeks. Everything alright? Come in this week and we'll pick up where we left off.`,
                        )}`,
                        '_blank',
                        'noopener',
                      )
                    }
                  >
                    WhatsApp
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

export function ClientRow({
  member,
  tone,
  badge,
  note,
  action,
}: {
  member: Member;
  tone: 'ok' | 'warn' | 'bad' | 'neutral';
  badge: string;
  note: string;
  action?: React.ReactNode;
}) {
  const nav = useNavigate();
  return (
    <div className="attention">
      <Avatar name={member.name} size={38} />
      <span className="attention__text">
        <button
          type="button"
          className="attention__title"
          style={{ textAlign: 'left', padding: 0 }}
          onClick={() => nav(`/members/${member.id}`)}
        >
          {member.name}
        </button>
        <span className="attention__body">{note}</span>
      </span>
      <span className="only-desktop" style={{ color: 'var(--text-3)', fontSize: 'var(--t-caption)' }}>
        {maskPhone(member.phone)}
      </span>
      <Pill tone={tone} small icon={tone === 'ok' ? 'check-circle' : tone === 'warn' ? 'activity' : 'alert'}>
        {badge}
      </Pill>
      {action}
    </div>
  );
}
