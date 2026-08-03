import { Award, Leaf, ShieldCheck, Users, Globe, Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { SectionHeading } from '@/components/ui/Card';
import { SmartImage } from '@/components/ui/SmartImage';
import { aboutImage, resolveImage } from '@/lib/images';
import { useSiteSettings } from '@/hooks/useSiteSettings';

export default function About() {
  const { get } = useSiteSettings();

  const title = get('about_title', 'Crafted for the connoisseur');
  const subtitle = get('about_subtitle', 'LUXE was founded on a single belief: that the art of smoking deserves the same reverence as fine wine and craft spirits. We curate only the finest.');
  const img = resolveImage(get('about_image_url'), aboutImage(0));

  const stats = [
    { value: get('about_stat1_value', '12K+'), label: get('about_stat1_label', 'Happy customers') },
    { value: get('about_stat2_value', '300+'), label: get('about_stat2_label', 'Curated products') },
    { value: get('about_stat3_value', '40+'), label: get('about_stat3_label', 'Premium brands') },
  ];

  return (
    <>
      <section className="relative min-h-[60vh] flex items-center overflow-hidden">
        <div className="absolute inset-0">
          <SmartImage src={img} alt="" className="w-full h-full object-cover opacity-30" eager />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/70 to-ink-950/40" />
        </div>
        <div className="relative section py-20 text-center">
          <p className="text-gold-400 text-sm tracking-widest uppercase mb-3">Our Story</p>
          <h1 className="text-4xl md:text-6xl font-display font-bold text-ink-50 text-balance">Crafted for the <span className="text-gradient-gold">connoisseur</span></h1>
          <p className="mt-5 max-w-2xl mx-auto text-ink-300 text-lg">{subtitle}</p>
        </div>
      </section>

      <section className="section py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="glass-card p-8 text-center">
              <p className="text-4xl font-display font-bold text-gradient-gold">{s.value}</p>
              <p className="text-ink-400 mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section py-12">
        <SectionHeading eyebrow="What drives us" title="Our Values" center />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { icon: Award, title: 'Uncompromising Quality', body: 'Every product is hand-selected and tested by our experts before it reaches our shelves.' },
            { icon: ShieldCheck, title: 'Authenticity Guaranteed', body: 'We source directly from manufacturers — no counterfeits, ever.' },
            { icon: Leaf, title: 'Responsible Sourcing', body: 'We partner with brands that share our commitment to sustainability.' },
            { icon: Users, title: 'Customer First', body: 'Our concierge team is available around the clock to help you.' },
            { icon: Globe, title: 'Global Community', body: 'We serve connoisseurs across 30+ countries worldwide.' },
            { icon: Sparkles, title: 'Curated Experience', body: 'Not a marketplace — a collection, refined for the few who know.' },
          ].map((v) => (
            <div key={v.title} className="glass-card p-6">
              <div className="w-12 h-12 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-400 mb-4"><v.icon className="w-6 h-6" /></div>
              <h3 className="font-display text-lg font-semibold text-ink-50">{v.title}</h3>
              <p className="mt-2 text-sm text-ink-400">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section py-20">
        <div className="glass-card p-10 md:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-dark-radial" />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-display font-semibold text-ink-50">Join the LUXE circle</h2>
            <p className="mt-3 text-ink-300 max-w-xl mx-auto">Discover why thousands choose LUXE for their premium smoking experience.</p>
            <Link to="/shop" className="mt-8 inline-block"><Button size="lg">Explore the Collection <ArrowRight className="w-4 h-4" /></Button></Link>
          </div>
        </div>
      </section>
    </>
  );
}
