import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [debugLog, setDebugLog] = useState([]);
  const initDone = useRef(false);

  const log = (msg) => {
    console.log('[AUTH]', msg);
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const fetchProfile = async (userId) => {
    log('Fetching profile for ' + userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        log('Profile error: ' + JSON.stringify(error));
        return null;
      }
      log('Profile loaded: ' + (data?.full_name || 'null'));
      setProfile(data || null);
      return data;
    } catch (err) {
      log('Profile exception: ' + err.message);
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      log('Init started');
      try {
        log('Calling getSession...');
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          log('getSession error: ' + JSON.stringify(error));
        }

        const currentUser = session?.user ?? null;
        log('Session user: ' + (currentUser?.email || 'none'));
        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          log('No user in session');
        }
      } catch (err) {
        log('Init exception: ' + err.message);
      } finally {
        if (mounted) {
          log('Init complete, setting loading=false');
          setLoading(false);
          initDone.current = true;
        }
      }
    };

    init();

    const safetyTimer = setTimeout(() => {
      if (mounted && !initDone.current) {
        log('SAFETY TIMEOUT - forcing loading=false');
        setLoading(false);
      }
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION') {
          log('onAuthStateChange: INITIAL_SESSION (skipping)');
          return;
        }
        log('onAuthStateChange: ' + event);

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
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
    debugLog,
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
