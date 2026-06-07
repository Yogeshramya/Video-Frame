import { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://yrdigitalmemories.com';
  
  // Static paths
  const routes = [
    '',
    '/scan',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  // Dynamic paths (public active memories)
  try {
    const { data: memories } = await supabase
      .from('memories')
      .select('id, updated_at')
      .eq('status', 'active');
      
    if (memories) {
      const memoryRoutes = memories.map((m) => ({
        url: `${baseUrl}/watch/${m.id}`,
        lastModified: new Date(m.updated_at || new Date()).toISOString(),
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      }));
      return [...routes, ...memoryRoutes];
    }
  } catch (e) {
    console.error('Error compiling sitemap paths dynamically:', e);
  }

  return routes;
}
