import { createPortal } from 'react-dom';
import { formatDate } from '@oan/core';
import { Button, LineChart } from '../../components/ui';
import { branchById, staffById } from '../../demo/data';
import { measurementsFor, progressDelta } from '../../demo/selectors';
import { useModal } from '../../lib/hooks';
import type { Member } from '../../demo/types';
import './report.css';

/**
 * The printable progress report.
 *
 * This is the commercial piece: a member shown measured proof of six months'
 * progress renews far more readily than one asked cold. It is also OAN's own
 * website copy — "progress tracking via body composition measurement" —
 * finally implemented.
 *
 * Printed on white regardless of theme: it goes on paper, or into WhatsApp as
 * an image, and both want ink on white.
 */
export function ProgressReport({ member, onClose }: { member: Member; onClose: () => void }) {
  const ref = useModal(true, onClose);
  const rows = measurementsFor(member.id);
  const delta = progressDelta(member.id);
  const branch = branchById(member.branchId);
  const coach = staffById(member.coachId);

  if (!delta) return null;
  const chrono = [...rows].reverse();

  return createPortal(
    <div className="scrim scrim--center report-scrim">
      <div
        ref={ref}
        className="dialog dialog--wide report-shell"
        role="dialog"
        aria-modal="true"
        aria-label={`Progress report for ${member.name}`}
        tabIndex={-1}
      >
        <div className="dialog__head no-print">
          <div>
            <div className="dialog__title">Progress report</div>
            <div className="card__sub">
              {formatDate(delta.baseline.date)} — {formatDate(delta.latest.date)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--s-2)' }}>
            <Button variant="secondary" icon="printer" onClick={() => window.print()}>
              Print
            </Button>
            <Button
              variant="primary"
              icon="whatsapp"
              onClick={() =>
                window.open(
                  `https://wa.me/91${member.phone}?text=${encodeURIComponent(
                    `${member.name.split(' ')[0]}, here's your progress at OAN Fitness: ${delta.weight} kg weight and ${delta.bodyFat} percentage points of body fat since ${formatDate(delta.baseline.date)}. Keep going!`,
                  )}`,
                  '_blank',
                  'noopener',
                )
              }
            >
              Send on WhatsApp
            </Button>
            <Button variant="ghost" iconOnly icon="x" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="dialog__body report-body">
          <article className="report">
            <header className="report__head">
              <div className="report__brand">
                <span className="report__mark">OAN</span>
                <div>
                  <div className="report__name">OAN Fitness</div>
                  <div className="report__addr">
                    {branch.name} · {branch.address}
                  </div>
                </div>
              </div>
              <div className="report__meta">
                <div>Progress report</div>
                <div className="tnum">
                  {formatDate(delta.baseline.date)} — {formatDate(delta.latest.date)}
                </div>
              </div>
            </header>

            <section className="report__member">
              <div>
                <div className="report__eyebrow">Member</div>
                <div className="report__member-name">{member.name}</div>
                <div className="report__member-sub tnum">
                  {member.code} · {member.age} · {member.gender === 'M' ? 'Male' : 'Female'} ·{' '}
                  {member.program}
                </div>
              </div>
              <div>
                <div className="report__eyebrow">Coach</div>
                <div className="report__member-sub">{coach?.name ?? 'Not assigned'}</div>
                {coach?.certification ? (
                  <div className="report__member-sub">{coach.certification}</div>
                ) : null}
              </div>
            </section>

            <section>
              <h2 className="report__h2">Where you started, where you are</h2>
              <div className="report__stats">
                <ReportStat
                  label="Weight"
                  from={`${delta.baseline.weightKg} kg`}
                  to={`${delta.latest.weightKg} kg`}
                  delta={delta.weight}
                  unit="kg"
                />
                <ReportStat
                  label="Body fat"
                  from={`${delta.baseline.bodyFatPct}%`}
                  to={`${delta.latest.bodyFatPct}%`}
                  delta={delta.bodyFat}
                  unit="pp"
                />
                <ReportStat
                  label="Lean mass"
                  from={`${delta.baseline.leanKg} kg`}
                  to={`${delta.latest.leanKg} kg`}
                  delta={delta.lean}
                  unit="kg"
                />
                <ReportStat
                  label="Waist"
                  from={`${delta.baseline.waistIn} in`}
                  to={`${delta.latest.waistIn} in`}
                  delta={delta.waist}
                  unit="in"
                />
              </div>
            </section>

            <section>
              <h2 className="report__h2">The trend</h2>
              <div className="report__chart">
                <LineChart
                  caption={`Weight and body fat for ${member.name}`}
                  height={200}
                  labels={chrono.map((r) => formatDate(r.date).slice(0, 6))}
                  series={[
                    {
                      name: 'Weight (kg)',
                      color: '#2563eb',
                      points: chrono.map((r) => r.weightKg),
                      format: (n) => n.toFixed(1),
                    },
                    {
                      name: 'Body fat (%)',
                      color: '#7c5cf0',
                      points: chrono.map((r) => r.bodyFatPct),
                      format: (n) => n.toFixed(1),
                    },
                  ]}
                />
              </div>
            </section>

            <section>
              <h2 className="report__h2">Every measurement</h2>
              <table className="report__table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Weight</th>
                    <th>Body fat</th>
                    <th>Lean mass</th>
                    <th>Waist</th>
                    <th>Chest</th>
                    <th>Arm</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.date}>
                      <td>{formatDate(r.date)}</td>
                      <td>{r.weightKg} kg</td>
                      <td>{r.bodyFatPct}%</td>
                      <td>{r.leanKg} kg</td>
                      <td>{r.waistIn} in</td>
                      <td>{r.chestIn} in</td>
                      <td>{r.armIn} in</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <footer className="report__foot">
              <span>
                Generated {formatDate(delta.latest.date)} · OAN Fitness {branch.name} · +91 80003
                28049
              </span>
              <span>Measurements recorded by {coach?.name ?? 'gym staff'}.</span>
            </footer>
          </article>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ReportStat({
  label,
  from,
  to,
  delta,
  unit,
}: {
  label: string;
  from: string;
  to: string;
  delta: number;
  unit: string;
}) {
  return (
    <div className="report__stat">
      <div className="report__eyebrow">{label}</div>
      <div className="report__stat-value">{to}</div>
      <div className="report__stat-from">
        from {from} · <b>{delta > 0 ? '+' : ''}{delta} {unit}</b>
      </div>
    </div>
  );
}
