import { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { SectionHeading } from '@/components/ui/Card';
import { useSiteSettings } from '@/hooks/useSiteSettings';

export default function Contact() {
  const { toast } = useToast();
  const { get } = useSiteSettings();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });

  const address = get('contact_address', '1 Liberty Plaza, New York, NY 10006');
  const phone = get('contact_phone', '+1 (800) 585-2937');
  const email = get('contact_email', 'hello@luxe.co');
  const supportEmail = get('contact_support_email', 'support@luxe.co');
  const hours = get('contact_hours', 'Mon–Fri, 9am–6pm EST');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from('notifications').insert({
      title: `Contact: ${form.subject || 'General'}`,
      message: `${form.name} (${form.email}): ${form.message}`,
      type: 'contact',
    });
    setBusy(false);
    if (error) toast('Could not send message. Try again.', 'error');
    else { toast('Message sent — we will be in touch!', 'success'); setForm({ name: '', email: '', subject: '', message: '' }); }
  };

  const contactCards = [
    { icon: MapPin, title: 'Visit', lines: [address] },
    { icon: Phone, title: 'Call', lines: [phone, hours] },
    { icon: Mail, title: 'Email', lines: [email, supportEmail] },
    { icon: MessageSquare, title: 'Live Chat', lines: ['Available 24/7', 'Average response: 2 min'] },
  ];

  return (
    <div className="section py-10">
      <SectionHeading eyebrow="Get in touch" title="Contact Us" subtitle="Questions, feedback, or just want to say hello — our concierge team is here for you." center />
      <div className="grid lg:grid-cols-2 gap-8 mt-8">
        <div className="space-y-4">
          {contactCards.map((c, i) => (
            <div key={i} className="glass-card p-5 flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-gold-500/10 flex items-center justify-center text-gold-400 shrink-0"><c.icon className="w-5 h-5" /></div>
              <div><h3 className="font-semibold text-ink-50">{c.title}</h3>{c.lines.map((l) => <p key={l} className="text-sm text-ink-400">{l}</p>)}</div>
            </div>
          ))}
        </div>
        <form onSubmit={submit} className="glass-card p-6 space-y-4 h-fit">
          <h3 className="text-lg font-semibold text-ink-50">Send a Message</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <Input label="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Textarea label="Message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          <Button type="submit" disabled={busy} className="w-full"><Send className="w-4 h-4" /> {busy ? 'Sending…' : 'Send Message'}</Button>
        </form>
      </div>
    </div>
  );
}
