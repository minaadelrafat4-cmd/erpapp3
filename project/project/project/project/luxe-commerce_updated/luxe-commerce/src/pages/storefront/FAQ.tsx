import { useEffect, useState } from 'react';
import { ChevronDown, HelpCircle, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SectionHeading, Skeleton, EmptyState } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { FaqEntry } from '@/types';

export default function FAQ() {
  const [entries, setEntries] = useState<FaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('faq_entries').select('*').eq('is_published', true).order('sort_order', { ascending: true });
      if (error) setError(error.message);
      setEntries((data ?? []) as FaqEntry[]);
      setLoading(false);
    })();
  }, []);

  const filtered = entries.filter((e) => e.question.toLowerCase().includes(query.toLowerCase()) || e.answer.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="section py-10 max-w-3xl">
      <SectionHeading eyebrow="Help Center" title="Frequently Asked Questions" subtitle="Find quick answers to common questions. Can't find what you need? Contact our team." center />
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions…" className="input pl-12" />
      </div>
      {loading ? (
        <div className="space-y-3">{Array.from({length:5}).map((_,i)=><Skeleton key={i} className="h-16"/>)}</div>
      ) : error ? (
        <EmptyState icon={<HelpCircle className="w-10 h-10" />} title="Could not load FAQs" description="Please try again later." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<HelpCircle className="w-10 h-10" />} title="No matching questions" description="Try different keywords or contact us." />
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <div key={e.id} className="glass-card overflow-hidden">
              <button onClick={() => setOpen(open === e.id ? null : e.id)} className="flex items-center justify-between w-full p-5 text-left">
                <span className="font-semibold text-ink-100">{e.question}</span>
                <ChevronDown className={`w-5 h-5 text-gold-400 shrink-0 transition ${open === e.id ? 'rotate-180' : ''}`} />
              </button>
              {open === e.id && <div className="px-5 pb-5 text-sm text-ink-300 leading-relaxed animate-fade-in">{e.answer}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
