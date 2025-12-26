import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Check if we're in build phase (Next.js sets this during build)
// Only use placeholders during actual build, not at runtime
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build' || 
                     process.env.NEXT_PHASE === 'phase-development-build';

// Lazy client creation to avoid errors during build time
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    if (isBuildPhase) {
      // During build, use placeholder to avoid errors
      return 'https://placeholder.supabase.co';
    }
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    if (isBuildPhase) {
      // During build, use placeholder to avoid errors
      return 'placeholder-key';
    }
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return key;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(target, prop) {
    if (!supabaseInstance) {
      const url = getSupabaseUrl();
      const key = getSupabaseAnonKey();
      supabaseInstance = createClient<Database>(url, key);
    }
    const value = supabaseInstance[prop as keyof typeof supabaseInstance];
    return typeof value === 'function' ? value.bind(supabaseInstance) : value;
  },
});

// Server-side client with service role key (for admin operations)
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // During build time only, use placeholders to avoid errors
  // In production runtime, we MUST have real env vars
  if (isBuildPhase) {
    // Only use placeholders during actual build phase
    return createClient<Database>(
      supabaseUrl || 'https://placeholder.supabase.co',
      serviceRoleKey || 'placeholder-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
  
  // In runtime (both dev and production), validate env vars are present
  if (!supabaseUrl) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL. Please set it in your environment variables.');
  }
  
  if (!serviceRoleKey) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Please set it in your environment variables.');
  }
  
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

