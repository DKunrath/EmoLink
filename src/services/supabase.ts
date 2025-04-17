import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kcpdeeudnonqrjsppxwz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjcGRlZXVkbm9ucXJqc3BweHd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA0MzUyMTAsImV4cCI6MjA1NjAxMTIxMH0.yK5WkrxZgufbitgpTDBvqrojGLFQQmZzbIK6ExpSGSM';

export const supabase = createClient(supabaseUrl, supabaseKey); 