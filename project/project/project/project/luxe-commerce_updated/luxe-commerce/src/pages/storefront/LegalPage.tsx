import { SectionHeading } from '@/components/ui/Card';

export function LegalPage({ title, updated, sections }: { title: string; updated?: string; sections: { heading: string; body: string }[] }) {
  return (
    <div className="section py-10 max-w-3xl">
      <SectionHeading eyebrow="Legal" title={title} subtitle={updated ? `Last updated: ${updated}` : undefined} />
      <div className="space-y-8">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="text-xl font-display font-semibold text-ink-50 mb-3">{s.heading}</h2>
            <p className="text-ink-300 leading-relaxed whitespace-pre-line">{s.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
