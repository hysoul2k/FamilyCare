declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    FC_DATA_KEY?: string;
    FC_DATABASE_PROVIDER?: 'd1' | 'supabase';
    SUPABASE_URL?: string;
    SUPABASE_SECRET_KEY?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    NEXT_PUBLIC_SUPABASE_URL?: string;
    BUCKET?: R2Bucket;
  }
}
