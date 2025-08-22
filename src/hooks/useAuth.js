import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Error getting initial session:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        setUser(session?.user ?? null);
        setLoading(false);

        // Handle successful sign-in events
        if (event === 'SIGNED_IN' && session?.user) {
          console.log('User signed in successfully');
          
          // Capture IP address for login tracking
          try {
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-login-ip`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({})
            });
          } catch (ipError) {
            console.warn('Failed to capture login IP:', ipError);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
};