import { Link, useParams } from 'react-router-dom';
import { Calendar, Clock, ArrowLeft, ArrowRight, User } from 'lucide-react';
import { useBlogPosts } from '@/hooks/useCatalog';
import { Badge, EmptyState, Skeleton, SectionHeading } from '@/components/ui/Card';
import { SmartImage } from '@/components/ui/SmartImage';
import { blogImage, resolveImage } from '@/lib/images';
import { formatDate } from '@/lib/utils';

export function Blog() {
  const { posts, loading } = useBlogPosts();
  return (
    <div className="section py-10">
      <SectionHeading eyebrow="Journal" title="The LUXE Journal" subtitle="Guides, culture, and stories from the world of premium smoking." center />
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">{Array.from({length:6}).map((_,i)=><Skeleton key={i} className="h-72"/>)}</div>
      ) : posts.length === 0 ? (
        <EmptyState title="Articles coming soon" description="Our editorial team is working on the first stories." />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((p) => (
            <Link key={p.id} to={`/blog/${p.slug}`} className="group glass-card overflow-hidden card-hover flex flex-col">
              <div className="aspect-[16/10] overflow-hidden bg-ink-800">
                <SmartImage src={resolveImage(p.cover_image_url, blogImage(p.slug))} alt={p.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-3 text-xs text-ink-500 mb-2">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {formatDate(p.published_at ?? p.created_at)}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {p.reading_minutes} min</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-ink-50 group-hover:text-gold-300 transition line-clamp-2">{p.title}</h3>
                <p className="mt-2 text-sm text-ink-400 line-clamp-3 flex-1">{p.excerpt}</p>
                <span className="mt-4 text-sm text-gold-300 flex items-center gap-1 group-hover:gap-2 transition-all">Read more <ArrowRight className="w-4 h-4" /></span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function BlogPost() {
  const { slug } = useParams();
  const { posts, loading } = useBlogPosts();
  const post = posts.find((p) => p.slug === slug);
  const related = posts.filter((p) => p.slug !== slug).slice(0, 3);

  if (loading) return <div className="section py-10"><Skeleton className="h-96 max-w-3xl mx-auto" /></div>;
  if (!post) return <div className="section py-20"><EmptyState title="Article not found" action={<Link to="/blog"><ArrowLeft className="w-4 h-4" /> Back to blog</Link>} /></div>;

  return (
    <article className="section py-10 max-w-3xl">
      <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-ink-400 hover:text-gold-300 mb-6"><ArrowLeft className="w-4 h-4" /> All articles</Link>
      <div className="flex flex-wrap gap-2 mb-4">{post.tags.map((t) => <Badge key={t} color="gold">{t}</Badge>)}</div>
      <h1 className="text-4xl md:text-5xl font-display font-semibold text-ink-50 leading-tight text-balance">{post.title}</h1>
      <div className="flex items-center gap-4 mt-4 text-sm text-ink-400">
        <span className="flex items-center gap-1.5"><User className="w-4 h-4" /> {post.author ?? 'LUXE Editorial'}</span>
        <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> {formatDate(post.published_at ?? post.created_at)}</span>
        <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {post.reading_minutes} min read</span>
      </div>
      <div className="aspect-[16/9] rounded-2xl overflow-hidden mt-8 mb-8 bg-ink-800">
        <SmartImage src={resolveImage(post.cover_image_url, blogImage(post.slug))} alt={post.title} className="w-full h-full object-cover" />
      </div>
      <div className="prose prose-invert max-w-none text-ink-200 leading-relaxed">
        <p className="text-lg text-ink-300 font-light">{post.excerpt}</p>
        <div className="mt-6 whitespace-pre-line">{post.body}</div>
      </div>

      {related.length > 0 && (
        <div className="mt-16 pt-8 border-t border-white/10">
          <h2 className="text-2xl font-display font-semibold text-ink-50 mb-6">More from the journal</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {related.map((r) => (
              <Link key={r.id} to={`/blog/${r.slug}`} className="group glass-card overflow-hidden card-hover">
                <div className="aspect-[16/10] overflow-hidden bg-ink-800"><SmartImage src={resolveImage(r.cover_image_url, blogImage(r.slug))} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition" /></div>
                <div className="p-4"><h3 className="font-semibold text-ink-50 group-hover:text-gold-300 line-clamp-2 text-sm">{r.title}</h3></div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
