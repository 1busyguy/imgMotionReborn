import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authProcessed, setAuthProcessed] = useState(false);

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        console.log('Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('Session data:', { session: !!session, user: !!session?.user, error });
        
        if (error) {
          console.error('Session error:', error);
          // If refresh token is invalid, clear the session
          if (error.message?.includes('refresh_token_not_found') || 
              error.message?.includes('Invalid Refresh Token')) {
            await supabase.auth.signOut();
            setUser(null);
          }
        } else {
          setUser(session?.user ?? null);
          if (session?.user) {
            console.log('User loaded:', {
              id: session.user.id,
              email: session.user.email,
              metadata: session.user.user_metadata,
              email_confirmed: !!session.user.email_confirmed_at,
              provider: session.user.app_metadata?.provider
            });
            
            // Removed Google OAuth redirect that was causing infinite loop
          }
        }
        
        // Check email confirmation status
        if (session?.user && !session.user.email_confirmed_at) {
          console.log('User email not confirmed yet');
        }
      } catch (error) {
        console.error('Auth error:', error);
        setUser(null);
      } finally {
        console.log('Auth loading complete');
        setLoading(false);
        setAuthProcessed(true);
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, { session: !!session, user: !!session?.user });
        
        if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed successfully');
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setAuthProcessed(false);
        }
        
        // Removed Google OAuth redirect that was causing infinite loop
        // The redirect is now handled properly in App.tsx
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('Auth state user:', {
            id: session.user.id,
            email: session.user.email,
            metadata: session.user.user_metadata,
            email_confirmed: !!session.user.email_confirmed_at,
            provider: session.user.app_metadata?.provider
          });
          
          // Check if user is banned when they sign in
          if (event === 'SIGNED_IN') {
            checkUserBanStatus(session.user.id);
          }
        }
        
        setAuthProcessed(true);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkUserBanStatus = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('banned')
        .eq('id', userId)
        .single();

      if (data?.banned) {
        console.log('🚫 User is banned, signing them out');
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.warn('Could not check ban status:', error);
      // Fail open - don't block login if we can't check
    }
  };

  return { user, loading, authProcessed };
};