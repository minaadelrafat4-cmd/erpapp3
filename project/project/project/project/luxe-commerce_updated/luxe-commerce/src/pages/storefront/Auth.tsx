import { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { isAccountLocked, checkServerLockout, validatePasswordLocal, PASSWORD_POLICY_HINT } from '@/lib/auth';

export function SignIn() {
  const { signIn, user, resetPassword } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverLocked, setServerLocked] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sending, setSending] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/account';

  useEffect(() => {
    if (!email) return;
    const t = setTimeout(async () => {
      setServerLocked(await checkServerLockout(email));
    }, 300);
    return () => clearTimeout(t);
  }, [email]);

  if (user) return <Navigate to={from} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email, password, remember);
    setBusy(false);
    if (error) toast(error, 'error');
    else { toast('Welcome back!', 'success'); navigate(from); }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const { error } = await resetPassword(forgotEmail);
    setSending(false);
    if (error) toast(error, 'error');
    else { toast('Password reset link sent — check your inbox', 'success'); setForgotOpen(false); }
  };

  const locked = isAccountLocked(email) || serverLocked;

  return (
    <div className="section py-16 max-w-md">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-gold-300 mb-6"><ArrowLeft className="w-4 h-4" /> Back to store</Link>
      <div className="glass-card p-8">
        <h1 className="text-2xl font-display font-semibold text-ink-50 mb-1">Welcome Back</h1>
        <p className="text-ink-400 text-sm mb-6">Sign in to your LUXE account</p>

        {!forgotOpen ? (
          <form onSubmit={submit} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <div className="relative">
              <Input label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-9 text-ink-400 hover:text-gold-300" aria-label="Toggle password">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-ink-300 cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 accent-gold-500" />
                Remember me
              </label>
              <button type="button" onClick={() => { setForgotOpen(true); setForgotEmail(email); }} className="text-gold-300 hover:text-gold-200">Forgot password?</button>
            </div>
            {locked && (
              <p className="text-xs text-error-500 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Account temporarily locked after too many failed attempts.</p>
            )}
            <Button type="submit" disabled={busy || locked} className="w-full" size="lg">{busy ? 'Signing in…' : <>Sign In <ArrowRight className="w-4 h-4" /></>}</Button>
          </form>
        ) : (
          <form onSubmit={sendReset} className="space-y-4">
            <p className="text-sm text-ink-300">Enter your email and we'll send you a reset link.</p>
            <Input label="Email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required />
            <Button type="submit" disabled={sending} className="w-full">{sending ? 'Sending…' : 'Send Reset Link'}</Button>
            <button type="button" onClick={() => setForgotOpen(false)} className="text-sm text-ink-400 hover:text-gold-300 w-full text-center">Back to sign in</button>
          </form>
        )}

        <p className="text-center text-sm text-ink-400 mt-6">New to LUXE? <Link to="/signup" className="text-gold-300 hover:text-gold-200">Create account</Link></p>
        <div className="mt-4 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-ink-500">LUXE employee? <Link to="/admin/login" className="text-ink-300 hover:text-gold-300">Staff sign in →</Link></p>
        </div>
      </div>
    </div>
  );
}

export function SignUp() {
  const { signUp, user, verifyEmail } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [signupStarted, setSignupStarted] = useState(false);

  // Only redirect to account if user exists and we didn't just start a signup
  if (user && !verifySent && !signupStarted) return <Navigate to="/account" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast('Please enter your name', 'error'); return; }
    const policyError = validatePasswordLocal(password);
    if (policyError) { toast(policyError, 'error'); return; }
    setBusy(true);
    setSignupStarted(true);
    const { error } = await signUp(email, password, name);
    setBusy(false);
    if (error) {
      setSignupStarted(false);
      toast(error, 'error');
    } else {
      setVerifySent(true);
      toast('Account created successfully', 'success');
    }
  };

  const resend = async () => {
    const { error } = await verifyEmail();
    if (error) toast(error, 'error');
    else toast('Verification email sent', 'success');
  };

  if (verifySent) {
    return (
      <div className="section py-16 max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-gold-300 mb-6"><ArrowLeft className="w-4 h-4" /> Back to store</Link>
        <div className="glass-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gold-500/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-gold-400" />
          </div>
          <h1 className="text-2xl font-display font-semibold text-ink-50 mb-2">Account Created</h1>
          <p className="text-ink-300 text-sm mb-6">
            {user
              ? 'Your account is ready. You can now start shopping.'
              : <>We sent a verification link to <span className="text-gold-300">{email}</span>. Click it to activate your account.</>}
          </p>
          <div className="flex flex-col gap-3">
            {user
              ? <Link to="/account"><Button className="w-full">Go to My Account</Button></Link>
              : <Button onClick={resend} variant="secondary">Resend verification email</Button>}
            <Link to="/signin"><Button variant="ghost" className="w-full">Continue to sign in</Button></Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section py-16 max-w-md">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-gold-300 mb-6"><ArrowLeft className="w-4 h-4" /> Back to store</Link>
      <div className="glass-card p-8">
        <h1 className="text-2xl font-display font-semibold text-ink-50 mb-1">Create Account</h1>
        <p className="text-ink-400 text-sm mb-6">Join the LUXE circle — it's free</p>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <div className="relative">
            <Input label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required hint={PASSWORD_POLICY_HINT} />
            <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-9 text-ink-400 hover:text-gold-300" aria-label="Toggle password">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button type="submit" disabled={busy} className="w-full" size="lg">{busy ? 'Creating…' : <>Create Account <ArrowRight className="w-4 h-4" /></>}</Button>
        </form>
        <p className="text-center text-sm text-ink-400 mt-6">Already have an account? <Link to="/signin" className="text-gold-300 hover:text-gold-200">Sign in</Link></p>
        <div className="mt-4 pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-ink-500">This is for customers. <Link to="/admin/login" className="text-ink-300 hover:text-gold-300">Employee sign in →</Link></p>
        </div>
      </div>
    </div>
  );
}
