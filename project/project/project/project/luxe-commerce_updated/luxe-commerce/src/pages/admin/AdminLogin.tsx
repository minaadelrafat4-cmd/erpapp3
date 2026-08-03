import { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Eye, EyeOff, ShieldCheck, Building2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { isAccountLocked, isStaffRole, checkServerLockout, validatePasswordLocal, PASSWORD_POLICY_HINT } from '@/lib/auth';

export default function AdminLogin() {
  const { signIn, signOut, user, profile, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverLocked, setServerLocked] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  // Check server-side lockout when email changes
  useEffect(() => {
    if (!email) return;
    const t = setTimeout(async () => {
      const locked = await checkServerLockout(email);
      setServerLocked(locked);
    }, 300);
    return () => clearTimeout(t);
  }, [email]);

  // If already signed in as staff, redirect to admin
  if (user && !loading && isStaffRole(profile?.role)) {
    return <Navigate to={from} replace />;
  }

  // If signed in as customer, show message
  if (user && !loading && profile?.role === 'customer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950 p-4">
        <div className="glass-card max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-error-500/10 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7 text-error-400" />
          </div>
          <h1 className="text-2xl font-display font-semibold text-ink-50 mb-2">Staff Access Only</h1>
          <p className="text-ink-300 text-sm mb-6">
            You are signed in as a customer. Employee accounts are separate from customer accounts.
            Please sign out of your customer account and use your staff credentials here.
          </p>
          <Link to="/"><Button variant="secondary" className="w-full">Back to Store</Button></Link>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error, profile: freshProfile } = await signIn(email, password, false);
    setBusy(false);
    if (error) {
      toast(error, 'error');
      return;
    }
    if (!isStaffRole(freshProfile?.role)) {
      toast('This account does not have staff access. Use the customer sign-in instead.', 'error');
      await signOut();
      return;
    }
    toast('Welcome to LUXE Admin', 'success');
    navigate(from);
  };

  const locked = isAccountLocked(email) || serverLocked;

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-dark-radial pointer-events-none" />
      <Link to="/" className="absolute top-6 left-6 z-10 flex items-center gap-2 text-sm text-ink-400 hover:text-gold-300 transition">
        <ArrowLeft className="w-4 h-4" /> Back to Store
      </Link>
      <div className="relative w-full max-w-md">
        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gold-sheen flex items-center justify-center">
              <Building2 className="w-6 h-6 text-ink-950" />
            </div>
            <div>
              <h1 className="text-xl font-display font-semibold text-ink-50">LUXE Admin</h1>
              <p className="text-xs text-ink-400">Employee & Staff Portal</p>
            </div>
          </div>

          <p className="text-ink-300 text-sm mb-6">
            This portal is restricted to authorized LUXE personnel. Use your staff credentials to sign in.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <Input label="Staff Email" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@luxe.co" />
            <div className="relative">
              <Input label="Password" type={showPassword ? 'text' : 'password'} name="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-9 text-ink-400 hover:text-gold-300" aria-label="Toggle password">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {locked && (
              <p className="text-xs text-error-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Account temporarily locked after too many failed attempts.
              </p>
            )}
            <Button type="submit" disabled={busy || locked} className="w-full" size="lg">
              {busy ? 'Signing in…' : <>Sign In to Admin <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
            <p className="text-xs text-ink-500 text-center">
              Employee accounts are created by authorized administrators.
              If you need access, contact your manager.
            </p>
            <Link to="/" className="block text-center text-sm text-ink-400 hover:text-gold-300">
              ← Back to Store
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
