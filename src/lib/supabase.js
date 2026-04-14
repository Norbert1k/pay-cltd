import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://wxzmpbftzeasivveohly.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4em1wYmZ0emVhc2l2dmVvaGx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNTI1NTMsImV4cCI6MjA5MTcyODU1M30.5QsBg1-XsiBGKKw-KWTJBpBXydjlqbNxmpiNhCKq86U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
