import { Link } from 'react-router-dom';
import { Home, Search, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="section py-20 min-h-[60vh] flex items-center">
      <div className="max-w-lg mx-auto text-center">
        <p className="text-[120px] md:text-[180px] font-display font-bold text-gradient-gold leading-none">404</p>
        <h1 className="text-2xl md:text-3xl font-display font-semibold text-ink-50 mt-4">Page Not Found</h1>
        <p className="mt-3 text-ink-400">The page you're looking for doesn't exist or has been moved. Let's get you back on track.</p>
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link to="/"><Button><Home className="w-4 h-4" /> Back Home</Button></Link>
          <Link to="/shop"><Button variant="secondary"><Search className="w-4 h-4" /> Browse Shop</Button></Link>
        </div>
      </div>
    </div>
  );
}
