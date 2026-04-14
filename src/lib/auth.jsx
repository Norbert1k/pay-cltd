import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext({});

// Read cached session from localStorage instantly (no network call)
function getCachedSession() {
  try {
    const stored = localStorage.getItem('sb-wxzmpbftzeasivveohly-auth-token');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed?.user || null;
    }
  } catch (e) {
    // ignore
  }
  return null;
}

export function AuthProvider({ children }) {
  // Initialize from cache immediately — no loading spinner needed
  const cachedUser = getCachedSession();
  const [user, setUser] = useState(cachedUser);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(!cachedUser ? true : false);
  const [profileLoading, setProfileLoading] = useState(!!cachedUser);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) console.error('Profile fetch error:', error);
      setProfile(data || null);
      return data;
    } catch (err) {
      console.error('Profile fetch failed:', err.message);
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // If we have a cached user, fetch profile immediately
        if (cachedUser) {
          await fetchProfile(cachedUser.id);
          if (mounted) setProfileLoading(false);
        }

        // Then verify session with Supabase (background)
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser && currentUser.id !== cachedUser?.id) {
          // User changed, re-fetch profile
          await fetchProfile(currentUser.id);
        } else if (!currentUser) {
          // Session expired
          setProfile(null);
        }
      } catch (err) {
        console.error('Auth init failed:', err.message);
      } finally {
        if (mounted) {
          setLoading(false);
          setProfileLoading(false);
        }
      }
    };

    init();

    // Safety net
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setLoading(false);
        setProfileLoading(false);
      }
    }, 4000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
        setProfileLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const value = {
    user,
    profile,
    loading,
    profileLoading,
    signOut,
    fetchProfile,
    isAdmin: profile?.role === 'admin',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
