import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, Category, Brand, BlogPost } from '@/types';

function sanitizeSearch(input: string): string {
  return input.replace(/[,%.(){}\\]/g, ' ').trim();
}

export function useProducts(opts: { featured?: boolean; bestSeller?: boolean; newArrival?: boolean; flashSale?: boolean; limit?: number; categoryId?: string; brandId?: string; search?: string } = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let q = supabase.from('products').select('*').eq('is_active', true);
    if (opts.featured) q = q.eq('is_featured', true);
    if (opts.bestSeller) q = q.eq('is_best_seller', true);
    if (opts.newArrival) q = q.eq('is_new_arrival', true);
    if (opts.flashSale) q = q.eq('is_flash_sale', true);
    if (opts.categoryId) q = q.eq('category_id', opts.categoryId);
    if (opts.brandId) q = q.eq('brand_id', opts.brandId);
    if (opts.search) {
      const s = sanitizeSearch(opts.search);
      if (s) q = q.or(`name.ilike.%${s}%,description.ilike.%${s}%,tags.cs.{${s}}`);
    }
    if (opts.limit) q = q.limit(opts.limit);
    q = q.order('created_at', { ascending: false });
    (async () => {
      const { data, error } = await q;
      if (error) setError(error.message);
      setProducts((data ?? []) as Product[]);
      setLoading(false);
    })();
  }, [opts.featured, opts.bestSeller, opts.newArrival, opts.flashSale, opts.limit, opts.categoryId, opts.brandId, opts.search]);

  return { products, loading, error };
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
      if (error) setError(error.message);
      setCategories((data ?? []) as Category[]);
      setLoading(false);
    })();
  }, []);
  return { categories, loading, error };
}

export function useBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('brands').select('*').order('name', { ascending: true });
      if (error) setError(error.message);
      setBrands((data ?? []) as Brand[]);
      setLoading(false);
    })();
  }, []);
  return { brands, loading, error };
}

export function useBlogPosts(limit?: number) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let q = supabase.from('blog_posts').select('*').eq('is_published', true).order('published_at', { ascending: false });
    if (limit) q = q.limit(limit);
    (async () => {
      const { data, error } = await q;
      if (error) setError(error.message);
      setPosts((data ?? []) as BlogPost[]);
      setLoading(false);
    })();
  }, [limit]);
  return { posts, loading, error };
}
