import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Clock, ArrowRight, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SectionHeading, Skeleton, EmptyState, Badge } from '@/components/ui/Card';
import type { Career } from '@/types';
import { formatDate } from '@/lib/utils';

export default function Careers() {
  const [jobs, setJobs] = useState<Career[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('careers').select('*').eq('is_open', true).order('posted_at', { ascending: false });
      setJobs((data ?? []) as Career[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="section py-10">
      <SectionHeading eyebrow="Join us" title="Careers at LUXE" subtitle="Be part of a team redefining the premium smoking experience. We're growing fast and looking for talent." center />

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {[
          { icon: Briefcase, title: 'Meaningful Work', body: 'Shape the future of a premium brand with a global reach.' },
          { icon: Building2, title: 'Great Culture', body: 'Collaborative, inclusive, and built on mutual respect.' },
          { icon: Clock, title: 'Flexibility', body: 'Hybrid work, generous PTO, and real work-life balance.' },
        ].map((b) => (
          <div key={b.title} className="glass-card p-6">
            <div className="w-12 h-12 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-400 mb-4"><b.icon className="w-6 h-6" /></div>
            <h3 className="font-display text-lg font-semibold text-ink-50">{b.title}</h3>
            <p className="mt-2 text-sm text-ink-400">{b.body}</p>
          </div>
        ))}
      </div>

      <h3 className="text-2xl font-display font-semibold text-ink-50 mb-6">Open Positions</h3>
      {loading ? (
        <div className="space-y-3">{Array.from({length:4}).map((_,i)=><Skeleton key={i} className="h-24"/>)}</div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={<Briefcase className="w-10 h-10" />} title="No open positions right now" description="Check back soon — we post new roles regularly." />
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => (
            <div key={j.id} className="glass-card p-5 flex flex-wrap items-center justify-between gap-4 card-hover">
              <div>
                <h4 className="font-semibold text-ink-50">{j.title}</h4>
                <div className="flex flex-wrap gap-3 mt-2 text-sm text-ink-400">
                  {j.department && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {j.department}</span>}
                  {j.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {j.location}</span>}
                  {j.type && <Badge color="gold">{j.type}</Badge>}
                  <span>Posted {formatDate(j.posted_at)}</span>
                </div>
              </div>
              <Link to="/contact"><span className="text-sm text-gold-300 hover:text-gold-200 flex items-center gap-1">Apply <ArrowRight className="w-4 h-4" /></span></Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
