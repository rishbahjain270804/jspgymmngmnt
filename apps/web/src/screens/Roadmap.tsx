import { Card, CardBody, CardHead, Icon, Pill, Section } from '../components/ui';
import type { IconName } from '../components/ui';

/**
 * Roadmap.
 *
 * The research doc names a set of features as roadmap and says explicitly:
 * don't build them for the demo. This screen is how they get named without
 * being faked — a fake CRM screen in a demo is a promise, and a demo that
 * over-promises is the fastest way to lose the room.
 *
 * The AI entry is the one to read carefully. AI is a strong differentiator
 * and a weak *demo*: churn prediction over seeded data is a fabrication, and
 * a gym owner who has run their floor for ten years will see through it.
 */

interface Item {
  name: string;
  icon: IconName;
  when: 'next' | 'later';
  why: string;
}

const NEXT: Item[] = [
  {
    name: 'Class booking & capacity',
    icon: 'calendar',
    when: 'next',
    why: 'Aerobics is group, music-led and capacity-bound — it needs a schedule and a waitlist, not a membership row.',
  },
  {
    name: 'PT session packs',
    icon: 'dumbbell',
    when: 'next',
    why: 'Sessions bought, used, remaining, and attributed to a trainer. Real revenue, but it needs the payment spine finished first.',
  },
  {
    name: 'Workout & diet plan assignment',
    icon: 'flame',
    when: 'next',
    why: 'Templates, an exercise library, and Indian foods in household measures. The tabs exist; the libraries behind them do not.',
  },
  {
    name: 'Day-close & cash reconciliation',
    icon: 'cash',
    when: 'next',
    why: 'What should be in the drawer at 10 PM. Shortfalls need to surface the same day, not at month end.',
  },
  {
    name: 'Staff shifts & attendance',
    icon: 'clock',
    when: 'next',
    why: 'Who actually opened at six. Needs a roster before it means anything.',
  },
  {
    name: 'Discount approval queue',
    icon: 'shield',
    when: 'next',
    why: 'The cap already blocks an over-limit discount. What is missing is the Admin queue that clears it.',
  },
];

const LATER: Item[] = [
  {
    name: 'Lead CRM & trial pipeline',
    icon: 'members',
    when: 'later',
    why: 'First session free is core to how OAN sells. Worth building properly once the member spine is trusted.',
  },
  {
    name: 'Supplement POS & inventory',
    icon: 'collect',
    when: 'later',
    why: 'Only if OAN actually sells supplements — an open question, and stock is a real cost to carry.',
  },
  {
    name: 'Marketing & campaigns',
    icon: 'sparkle',
    when: 'later',
    why: 'WhatsApp reminders already cover the case that earns money. Campaign tooling is the layer above that.',
  },
  {
    name: 'WhatsApp Business API',
    icon: 'whatsapp',
    when: 'later',
    why: 'Today every reminder opens wa.me with the message pre-written. The official API adds templates and delivery receipts.',
  },
  {
    name: 'Payment gateway',
    icon: 'card',
    when: 'later',
    why: 'UPI and cash cover the counter. A gateway matters when members start renewing from the phone app.',
  },
  {
    name: 'Biometric & access control',
    icon: 'lock',
    when: 'later',
    why: 'Hardware integration. The QR check-in already keeps the 6:30 queue moving.',
  },
  {
    name: 'Lockers',
    icon: 'branches',
    when: 'later',
    why: 'A small assignment module. Named because OAN offers lockers, not because it is urgent.',
  },
  {
    name: 'GST filing exports',
    icon: 'download',
    when: 'later',
    why: 'The tax split is already computed and posted. Turning it into a filed return is a format problem, not a data one.',
  },
];

export function Roadmap() {
  return (
    <div className="page">
      <div className="page__head">
        <div>
          <span className="eyebrow">Named, not built</span>
          <h1 className="page__title">Roadmap</h1>
          <p className="page__lede">
            Everything in this app works against real data. These are the things that don't exist
            yet — listed rather than mocked up, because a screen in a demo reads as a promise.
          </p>
        </div>
      </div>

      <Card pad>
        <div style={{ display: 'flex', gap: 'var(--s-3)', alignItems: 'flex-start' }}>
          <span className="attention__icon attention__icon--warn">
            <Icon name="sparkle" size={18} />
          </span>
          <div style={{ maxWidth: '76ch' }}>
            <h2 style={{ fontSize: 'var(--t-body)', fontWeight: 'var(--w-semibold)' }}>
              On AI, specifically
            </h2>
            <p style={{ color: 'var(--text-2)', marginTop: 6, lineHeight: 'var(--lh-relaxed)' }}>
              Churn prediction, plateau detection and demand forecasting are all genuinely
              valuable here — and all of them need history this gym hasn't recorded yet. Run on
              seeded data they produce confident numbers that mean nothing, which an owner who has
              run their floor for ten years will spot immediately. The order that works is:
              ship the reliable slice, earn the data, then the AI is defensible rather than
              decorative.
            </p>
            <p style={{ color: 'var(--text-2)', marginTop: 'var(--s-3)' }}>
              What is here today and does work: the absent-member and plateau worklists, computed
              from actual attendance and actual logged sets.
            </p>
          </div>
        </div>
      </Card>

      <Section eyebrow="Once the slice is signed off" title="Next" index={1}>
        <div className="split-2">
          {NEXT.map((i) => (
            <RoadmapCard key={i.name} item={i} />
          ))}
        </div>
      </Section>

      <Section eyebrow="Real features, not for this demo" title="Later" index={2}>
        <div className="split-2">
          {LATER.map((i) => (
            <RoadmapCard key={i.name} item={i} />
          ))}
        </div>
      </Section>
    </div>
  );
}

function RoadmapCard({ item }: { item: Item }) {
  return (
    <Card>
      <CardHead
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--s-2)' }}>
            <Icon name={item.icon} size={17} />
            {item.name}
          </span>
        }
        action={
          <Pill tone={item.when === 'next' ? 'brand' : 'neutral'} small icon="clock">
            {item.when === 'next' ? 'Next' : 'Later'}
          </Pill>
        }
      />
      <CardBody>
        <p style={{ color: 'var(--text-2)', fontSize: 'var(--t-label)', lineHeight: 'var(--lh-relaxed)' }}>
          {item.why}
        </p>
      </CardBody>
    </Card>
  );
}
