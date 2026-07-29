import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  type CheckInVerdict,
  type Membership,
  checkInVerdict,
  daysRemaining,
  formatDate,
  formatINR,
} from '@oan/core';
import { Button, Icon, Pill, LEVEL_TONE, TONE_VAR, EmptyState } from '../../components/ui';
import { useSession } from '../../demo/session';
import { BRANCHES, RECENT_CHECKINS, branchById, inGymNow, checkInsToday, maskPhone } from '../../demo/data';
import { searchMembers } from '../../demo/selectors';
import type { Member } from '../../demo/types';
import { useReducedMotion } from '../../lib/hooks';
import './checkin.css';

/**
 * The check-in counter.
 *
 * The verdict itself is not computed here — `checkInVerdict()` in @oan/core
 * decides, so the counter PC, the phone and the server can never disagree
 * about whether someone may train. This screen only presents the answer, as
 * loudly as it can.
 */

/** A short confirmation tone. §7 asks for an audio cue on a successful
 *  check-in — at 6:30 AM the staff member is looking at the queue, not the
 *  screen. Muted by default is wrong here; it is the point of the feature. */
function beep(level: 'GREEN' | 'AMBER' | 'RED') {
  try {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    // Rising for welcome, flat for warning, falling for refusal.
    const notes = level === 'GREEN' ? [660, 990] : level === 'AMBER' ? [520, 520] : [400, 260];
    osc.type = 'sine';
    osc.frequency.setValueAtTime(notes[0]!, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(notes[1]!, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    osc.start();
    osc.stop(ctx.currentTime + 0.34);
    osc.onended = () => ctx.close();
  } catch {
    /* Audio is a courtesy, never a requirement. */
  }
}

const ACTION_LABEL: Record<NonNullable<CheckInVerdict['action']>, string> = {
  COLLECT_PAYMENT: 'Collect payment',
  OFFER_RENEWAL: 'Offer renewal',
  RESUME_MEMBERSHIP: 'Resume membership',
  OVERRIDE: 'Allow this once',
};

function Slab({
  verdict,
  member,
  onClear,
  onAction,
}: {
  verdict: CheckInVerdict;
  member: Member;
  onClear: () => void;
  onAction: () => void;
}) {
  const tone = LEVEL_TONE[verdict.level];
  const color = TONE_VAR[tone];
  const icon = verdict.level === 'GREEN' ? 'check-circle' : verdict.level === 'AMBER' ? 'alert' : 'x-circle';

  const style = {
    '--slab-color': color,
    '--slab-tint': `var(--${tone}-tint)`,
    '--slab-line': `var(--${tone}-line)`,
  } as React.CSSProperties;

  const left = daysRemaining(member.membership);

  return (
    <section className="slab" style={style} aria-live="assertive" aria-atomic="true">
      <div className="slab__state">
        <Icon name={icon} size={30} strokeWidth={2.4} />
        {/* The word is not decoration: colour must never be the only carrier. */}
        <span className="eyebrow" style={{ color, fontSize: 'var(--t-caption)' }}>
          {verdict.code.replace(/_/g, ' ')}
        </span>
      </div>

      <h1 className="slab__headline">{verdict.headline}</h1>

      <div>
        <div className="slab__name">{member.name}</div>
        <div className="slab__meta">
          {maskPhone(member.phone)} · {member.membership.plan.name} · {member.code}
        </div>
      </div>

      <div className="slab__detail">
        <Icon name="clock" size={18} />
        {verdict.detail}
      </div>

      <div className="slab__actions">
        {verdict.allow ? (
          <Button variant="primary" size="lg" icon="check" onClick={onClear}>
            Done — next member
          </Button>
        ) : null}
        {verdict.action ? (
          <Button
            variant={verdict.allow ? 'secondary' : 'primary'}
            size="lg"
            icon={verdict.action === 'COLLECT_PAYMENT' ? 'wallet' : 'refresh'}
            onClick={onAction}
          >
            {ACTION_LABEL[verdict.action]}
          </Button>
        ) : null}
        {!verdict.allow ? (
          <Button variant="ghost" size="lg" onClick={onClear}>
            Cancel
          </Button>
        ) : null}
      </div>

      {left >= 0 ? (
        <p className="card__sub" style={{ marginTop: 'var(--s-1)' }}>
          Expires {formatDate(member.membership.expiresOn)}
          {member.membership.balanceDue > 0
            ? ` · ${formatINR(member.membership.balanceDue, { paise: false })} outstanding`
            : ''}
        </p>
      ) : null}
    </section>
  );
}

export function CheckIn() {
  const { branchId, branches, allowed } = useSession();
  const nav = useNavigate();
  const reduced = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);

  const atBranch = branchId ?? branches[0]?.id ?? BRANCHES[0]!.id;
  const branch = branchById(atBranch);

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState<Member | null>(null);
  const [log, setLog] = useState(RECENT_CHECKINS);
  const [inside, setInside] = useState(() => inGymNow(atBranch));

  // The field holds focus: a counter operator never clicks before typing.
  useEffect(() => {
    inputRef.current?.focus();
  }, [chosen]);

  const hits = useMemo(
    () => (chosen ? [] : searchMembers(query, atBranch, 5)),
    [query, atBranch, chosen],
  );

  const verdict = useMemo(
    () => (chosen ? checkInVerdict(chosen.membership as Membership, atBranch) : null),
    [chosen, atBranch],
  );

  useEffect(() => {
    if (verdict && !reduced) beep(verdict.level);
  }, [verdict, reduced]);

  const choose = (m: Member) => {
    setChosen(m);
    setQuery('');
  };

  const clear = () => {
    if (chosen && verdict?.allow) {
      setLog((l) => [
        { member: chosen, at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) },
        ...l,
      ].slice(0, 12));
      setInside((n) => n + 1);
    }
    setChosen(null);
    setQuery('');
  };

  if (!allowed('checkin.record')) {
    return (
      <div className="page">
        <EmptyState
          icon="lock"
          title="Check-in isn't part of your access"
          body="Only counter staff, managers and coaches record check-ins. Ask an Admin if you need it."
        />
      </div>
    );
  }

  return (
    <div className="kiosk">
      <div className="kiosk__main">
        <div>
          <span className="eyebrow">
            {branch.name} · {branch.hours}
          </span>
          <h1 className="page__title" style={{ marginTop: 4 }}>
            Check-in
          </h1>
        </div>

        <div className="lookup">
          <span className="lookup__glyph">
            <Icon name="qr" size={24} />
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setChosen(null);
              setActive(0);
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Scan QR or type phone number…"
            aria-label="Scan a QR code or type a phone number"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter' && hits[active]) {
                e.preventDefault();
                choose(hits[active]!);
              } else if (e.key === 'Escape') {
                setQuery('');
                setChosen(null);
              }
            }}
          />
          {query ? (
            <Button variant="ghost" iconOnly icon="x" onClick={() => setQuery('')}>
              Clear
            </Button>
          ) : (
            <Pill tone="neutral" icon="camera" small>
              Camera on the phone app
            </Pill>
          )}
        </div>

        {hits.length > 0 ? (
          <div className="lookup__hits" role="listbox" aria-label="Matching members">
            {hits.map((m, i) => (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className="hit"
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(m)}
              >
                <Icon name="user" size={20} />
                <span>
                  <span className="hit__name">{m.name}</span>
                  <br />
                  <span className="hit__meta">
                    {maskPhone(m.phone)} · {m.membership.plan.name}
                  </span>
                </span>
                <Icon name="chevron-right" size={18} />
              </button>
            ))}
          </div>
        ) : null}

        {chosen && verdict ? (
          <Slab
            verdict={verdict}
            member={chosen}
            onClear={clear}
            onAction={() => nav(`/collect?member=${chosen.id}`)}
          />
        ) : query.trim().length >= 3 && hits.length === 0 ? (
          <div className="idle">
            <Icon name="search" size={26} />
            <h2 className="state__title">No member on {query.trim()}</h2>
            <p className="state__body">
              Nobody at {branch.short} has that number. Register them — it takes under two minutes.
            </p>
            <Button variant="primary" icon="plus" onClick={() => nav('/members')}>
              Add member
            </Button>
          </div>
        ) : (
          <div className="idle">
            <span className="idle__ring">
              <Icon name="qr" size={30} />
            </span>
            <h2 className="state__title" style={{ color: 'var(--text-2)' }}>
              Ready
            </h2>
            <p className="state__body">
              Scan a member's QR, or type any three digits of their phone number.
            </p>
          </div>
        )}
      </div>

      <aside className="kiosk__rail">
        <div className="now">
          <span className="eyebrow">In the gym now</span>
          <span className="now__value">{inside}</span>
          <span className="card__sub">{branch.hours.split(' · ')[0]} shift</span>
        </div>

        <div className="card">
          <div className="card__head">
            <span className="card__title">Checked in today</span>
            <span className="pill pill--neutral pill--sm tnum">{checkInsToday(atBranch)}</span>
          </div>
          <div className="ticker">
            {log.map((r, i) => (
              <div
                className="ticker__row"
                key={`${r.member.id}-${i}`}
                style={{ '--i': i } as React.CSSProperties}
              >
                <Icon name="check-circle" size={15} />
                <span>{r.member.name}</span>
                <span className="ticker__time">{r.at}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
