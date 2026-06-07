import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Safely validate the URL format before initializing the client
const getValidSupabaseUrl = (url: string): string => {
  try {
    if (!url) return 'https://placeholder-project.supabase.co';
    new URL(url); // Throws if not a valid absolute URL
    return url;
  } catch (e) {
    console.warn(`[Supabase Connection Warning] Invalid NEXT_PUBLIC_SUPABASE_URL: "${url}". Using fallback placeholder URL.`);
    return 'https://placeholder-project.supabase.co';
  }
};

const supabaseUrl = getValidSupabaseUrl(rawUrl);

if (
  !rawUrl || 
  supabaseUrl.includes('placeholder') || 
  !supabaseAnonKey || 
  supabaseAnonKey === 'placeholder-anon-key'
) {
  console.warn('Supabase credentials missing or invalid. Please check your .env.local configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder-anon-key');
