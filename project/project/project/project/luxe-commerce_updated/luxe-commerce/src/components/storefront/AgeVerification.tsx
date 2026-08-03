import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Wine } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const STORAGE_KEY = 'luxe_age_verified';

export function AgeVerification() {
  const [verified, setVerified] = useState(true);

  useEffect(() => {
    setVerified(localStorage.getItem(STORAGE_KEY) === 'true');
  }, []);

  const confirm = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setVerified(true);
  };

  const deny = () => {
    setVerified(false);
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0c0f13;color:#aab2c0;font-family:sans-serif;text-align:center;padding:2rem"><div><h1 style="color:#f5ecd2;font-size:2rem;margin-bottom:1rem">Access Denied</h1><p>You must be of legal age to access this site.</p></div></div>';
  };

  if (verified) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink-950/90 backdrop-blur-md animate-fade-in">
      <div className="glass-card max-w-md w-full p-8 text-center animate-scale-in">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gold-sheen flex items-center justify-center mb-5">
          <Wine className="w-8 h-8 text-ink-950" />
        </div>
        <h1 className="text-2xl font-display font-semibold text-ink-50 mb-2">Age Verification Required</h1>
        <p className="text-ink-300 text-sm mb-6">
          LUXE sells age-restricted products. You must be of legal smoking age in your jurisdiction to enter.
          By continuing you confirm you are 21 years or older.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={confirm} className="flex-1">
            <ShieldCheck className="w-4 h-4" /> I am 21 or older
          </Button>
          <Button variant="secondary" onClick={deny} className="flex-1">I am under 21</Button>
        </div>
        <p className="mt-5 text-xs text-ink-500">
          By entering you agree to our <Link to="/terms" className="text-gold-400 underline">Terms</Link> and{' '}
          <Link to="/privacy" className="text-gold-400 underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
