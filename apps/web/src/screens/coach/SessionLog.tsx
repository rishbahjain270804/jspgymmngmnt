import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHead,
  EmptyState,
  Icon,
  Pill,
  PermissionState,
} from '../../components/ui';
import { useSession } from '../../demo/session';
import { EXERCISES } from '../../demo/data';
import { memberById } from '../../demo/selectors';
import './session.css';

/**
 * Log a session.
 *
 * Last week's loads are prefilled. That single decision is the whole design:
 * a coach who has to retype last week's numbers logs nothing, and an empty
 * log makes every progress metric downstream worthless.
 *
 * Target: under sixty seconds, one thumb, on a phone, on the gym floor.
 */

interface SetEntry {
  kg: string;
  reps: string;
  done: boolean;
}

export function SessionLog() {
  const { memberId } = useParams();
  const { allowed } = useSession();
  const nav = useNavigate();
  const member = memberById(memberId);

  const [log, setLog] = useState<Record<string, SetEntry[]>>(() =>
    Object.fromEntries(
      EXERCISES.map((e) => [
        e.name,
        // Prefilled from last week — the coach confirms rather than types.
        parseLastWeek(e.lastWeek).map((s) => ({ kg: s.kg, reps: s.reps, done: false })),
      ]),
    ),
  );
  const [finished, setFinished] = useState(false);

  if (!member) {
    return (
      <div className="page">
        <EmptyState icon="search" title="No such client" body="This member isn't assigned to you." />
      </div>
    );
  }

  if (!allowed('workout.log_session', { memberId: member.id })) {
    return (
      <div className="page">
        <PermissionState what="logging sessions for this member" />
      </div>
    );
  }

  const totalSets = Object.values(log).flat().length;
  const doneSets = Object.values(log).flat().filter((s) => s.done).length;

  if (finished) {
    return (
      <div className="page">
        <Card>
          <EmptyState
            icon="check-circle"
            title="Session logged"
            body={`${doneSets} sets recorded for ${member.name}. Next week's screen will open with these numbers already filled in.`}
            action={
              <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
                <Button variant="primary" onClick={() => nav('/coach')}>
                  Back to today
                </Button>
                <Button variant="secondary" onClick={() => nav(`/members/${member.id}`)}>
                  Open record
                </Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  const toggle = (ex: string, i: number) =>
    setLog((l) => ({
      ...l,
      [ex]: l[ex]!.map((s, j) => (j === i ? { ...s, done: !s.done } : s)),
    }));

  const edit = (ex: string, i: number, field: 'kg' | 'reps', v: string) =>
    setLog((l) => ({
      ...l,
      [ex]: l[ex]!.map((s, j) => (j === i ? { ...s, [field]: v } : s)),
    }));

  const addSet = (ex: string) =>
    setLog((l) => {
      const sets = l[ex]!;
      const last = sets[sets.length - 1];
      return { ...l, [ex]: [...sets, { kg: last?.kg ?? '', reps: last?.reps ?? '', done: false }] };
    });

  return (
    <div className="page session">
      <div className="page__head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-3)' }}>
          <Button variant="ghost" iconOnly icon="arrow-left" onClick={() => nav('/coach')}>
            Back
          </Button>
          <Avatar name={member.name} size={44} />
          <div>
            <span className="eyebrow">Push day · {member.program}</span>
            <h1 className="page__title" style={{ fontSize: 'var(--t-h3)' }}>
              {member.name}
            </h1>
          </div>
        </div>
        <Pill tone="neutral" icon="clock">
          {doneSets} of {totalSets} sets
        </Pill>
      </div>

      {EXERCISES.map((ex) => (
        <Card key={ex.name}>
          <CardHead
            title={ex.name}
            sub={`Last week ${ex.lastWeek}`}
            action={
              ex.up > 0 ? (
                <Pill tone="brand" small icon="trend-up">
                  e1RM {ex.e1rm} kg · up {ex.up}%
                </Pill>
              ) : (
                <Pill tone="neutral" small>
                  No change last week
                </Pill>
              )
            }
          />
          <CardBody>
            <div className="sets">
              {log[ex.name]!.map((s, i) => (
                <div className={`set ${s.done ? 'is-done' : ''}`} key={i}>
                  <span className="set__n">{i + 1}</span>
                  <label className="set__field">
                    <span className="visually-hidden">
                      {ex.name} set {i + 1} weight in kilograms
                    </span>
                    <input
                      className="set__input tnum"
                      value={s.kg}
                      inputMode="decimal"
                      onChange={(e) => edit(ex.name, i, 'kg', e.target.value)}
                    />
                    <span className="set__unit">kg</span>
                  </label>
                  <span className="set__x">×</span>
                  <label className="set__field">
                    <span className="visually-hidden">
                      {ex.name} set {i + 1} repetitions
                    </span>
                    <input
                      className="set__input tnum"
                      value={s.reps}
                      inputMode="numeric"
                      onChange={(e) => edit(ex.name, i, 'reps', e.target.value)}
                    />
                    <span className="set__unit">reps</span>
                  </label>
                  <button
                    type="button"
                    className="set__done"
                    aria-pressed={s.done}
                    aria-label={`Mark ${ex.name} set ${i + 1} complete`}
                    onClick={() => toggle(ex.name, i)}
                  >
                    <Icon name="check" size={17} strokeWidth={2.6} />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" icon="plus" onClick={() => addSet(ex.name)}>
                Add a set
              </Button>
            </div>
          </CardBody>
        </Card>
      ))}

      <div className="session__finish">
        <Button variant="primary" size="lg" block icon="check" onClick={() => setFinished(true)}>
          Finish session
        </Button>
      </div>
    </div>
  );
}

/** "60 kg × 8, 8, 7" → three prefilled sets. */
function parseLastWeek(s: string): { kg: string; reps: string }[] {
  const [weightPart, repsPart] = s.split('×').map((p) => p.trim());
  const kg = (weightPart ?? '').replace(/[^\d.]/g, '');
  const reps = (repsPart ?? '').split(',').map((r) => r.trim());
  return reps.map((r) => ({ kg, reps: r }));
}
