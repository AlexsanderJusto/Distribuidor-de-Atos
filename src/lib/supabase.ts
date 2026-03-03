import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Supabase Table Schema Recommendation:
 * 
 * CREATE TABLE acts (
 *   id TEXT PRIMARY KEY,
 *   title TEXT,
 *   type TEXT,
 *   court TEXT,
 *   chamber TEXT,
 *   caseNumber TEXT,
 *   parties TEXT,
 *   date TEXT,
 *   lawyer TEXT,
 *   summary TEXT,
 *   originalTextSnippet TEXT,
 *   isFulfilled BOOLEAN DEFAULT FALSE,
 *   createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 * 
 * CREATE TABLE reports (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   lawyerName TEXT,
 *   actsCount INTEGER,
 *   data JSONB -- Stores the array of acts for this specific report
 * );
 */
