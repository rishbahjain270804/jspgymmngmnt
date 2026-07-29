import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icon, Input } from '../components/ui';
import { useSession, ROLE_LABEL } from '../demo/session';
import { STAFF, branchById } from '../demo/data';
import { HOME } from '../components/app/nav';
import './login.css';

/**
 * Sign in — phone plus OTP, never email.
 *
 * Many members and some staff have no email address at all (§1: WhatsApp is
 * the channel here, email is nearly irrelevant). Role and branch come from
 * the staff record, never from anything the client sends.
 *
 * No authentication is implemented — this is a UI demo. The screen exists
 * because it is the first thing anyone sees in a walkthrough, and because
 * the OTP step is what makes "no passwords at the counter" concrete.
 */
export function Login() {
  const { signInAs } = useSession();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [error, setError] = useState<string>();
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const match = STAFF.find((s) => s.phone === phone.replace(/\D/g, ''));

  const sendOtp = () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      setError('Enter all ten digits of the mobile number.');
      return;
    }
    if (!match) {
      setError('No staff record has this number. Ask an Admin to add you first.');
      return;
    }
    setError(undefined);
    setStage('otp');
    requestAnimationFrame(() => boxes.current[0]?.focus());
  };

  const verify = (code = otp.join('')) => {
    if (code.length !== 4) {
      setError('Enter the four-digit code.');
      return;
    }
    if (!match) return;
    signInAs(match.id);
    nav(HOME[match.role], { replace: true });
  };

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[i] = d;
    setOtp(next);
    if (d && i < 3) boxes.current[i + 1]?.focus();
    if (d && i === 3) verify(next.join(''));
  };

  return (
    <div className="auth">
      <div className="auth__panel">
        <div className="auth__brand">
          <span className="brand__mark" style={{ width: 44, height: 44, fontSize: 15 }}>
            OAN
          </span>
          <div>
            <div className="brand__name" style={{ fontSize: 'var(--t-section)' }}>
              OAN Fitness
            </div>
            <div className="brand__sub">Jaipur · two branches</div>
          </div>
        </div>

        {stage === 'phone' ? (
          <>
            <div>
              <h1 className="auth__title">Staff sign in</h1>
              <p className="auth__lede">
                We'll text a code to this number. Your branch and role come from your staff
                record — there's nothing to choose here.
              </p>
            </div>

            <Input
              label="Mobile number"
              icon="phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError(undefined);
              }}
              onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="98290 11001"
              affix={<span style={{ color: 'var(--text-3)' }}>+91</span>}
              {...(error ? { error } : {})}
            />

            <Button variant="primary" size="lg" block onClick={sendOtp} icon="phone">
              Send code
            </Button>
          </>
        ) : (
          <>
            <div>
              <h1 className="auth__title">Enter the code</h1>
              <p className="auth__lede">
                Sent to +91 {phone.replace(/\D/g, '').replace(/(\d{5})(\d{5})/, '$1 $2')}.
                {match ? ` Signing in as ${match.name}, ${ROLE_LABEL[match.role]} at ${branchById(match.branchId).name}.` : ''}
              </p>
            </div>

            <div className="otp" role="group" aria-label="Four-digit code">
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    boxes.current[i] = el;
                  }}
                  className="otp__box tnum"
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otp[i] && i > 0) boxes.current[i - 1]?.focus();
                  }}
                  inputMode="numeric"
                  maxLength={1}
                  aria-label={`Digit ${i + 1}`}
                  autoComplete="one-time-code"
                />
              ))}
            </div>

            {error ? (
              <span className="field__error" role="alert">
                <Icon name="alert" size={12} />
                {error}
              </span>
            ) : null}

            <Button variant="primary" size="lg" block onClick={() => verify()}>
              Verify and continue
            </Button>
            <Button variant="ghost" block onClick={() => setStage('phone')} icon="arrow-left">
              Use a different number
            </Button>
          </>
        )}

        <div className="auth__demo">
          <span className="eyebrow">Demo logins — same app, different scope</span>
          <div className="auth__demo-grid">
            {['st-001', 'st-002', 'st-004', 'st-006'].map((id) => {
              const s = STAFF.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  type="button"
                  className="auth__demo-btn"
                  onClick={() => {
                    signInAs(id);
                    nav(HOME[s.role], { replace: true });
                  }}
                >
                  <span style={{ fontWeight: 'var(--w-semibold)' }}>{ROLE_LABEL[s.role]}</span>
                  <span style={{ color: 'var(--text-3)', fontSize: 'var(--t-caption)' }}>
                    {s.name} · {branchById(s.branchId).short}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="auth__aside" aria-hidden="true">
        <div className="auth__quote">
          <span className="eyebrow">The screen this product is built around</span>
          <p>
            Under two seconds, twice a day, at a counter with forty people waiting.
          </p>
          <span className="auth__quote-meta">Check-in · the hero screen</span>
        </div>
      </aside>
    </div>
  );
}
