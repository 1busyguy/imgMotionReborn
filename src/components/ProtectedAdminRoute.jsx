import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const ProtectedAdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [adminCheckComplete, setAdminCheckComplete] = useState(false);

  // Fetch user profile when user is available
  useEffect(() => {
    if (user) {
      fetchProfile();
    } else {
      setProfileLoading(false);
      setAdminCheckComplete(true);
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile for admin check:', error);
        setProfile(null);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error in admin profile check:', error);
      setProfile(null);
    } finally {
      setProfileLoading(false);
      setAdminCheckComplete(true);
    }
  };

  // Show loading while checking auth and admin status
  if (loading || profileLoading || !adminCheckComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-xl">Verifying admin access...</div>
      </div>
    );
  }

  // Not logged in - redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is admin using multiple methods
  const adminUUIDs = [
    '991e17a6-c1a8-4496-8b28-cc83341c028a' // jim@1busyguy.com
  ];
  
  const isAdminByUUID = adminUUIDs.includes(user.id);
  const isAdminByEmail = user.email === 'jim@1busyguy.com' || user.user_metadata?.email === 'jim@1busyguy.com';
  const isAdminByProfile = profile?.is_admin === true;
  
  const isAdmin = isAdminByUUID || isAdminByEmail || isAdminByProfile;
  
  console.log('🔍 Admin check details:', {
    userId: user.id,
    userEmail: user.email,
    metadataEmail: user.user_metadata?.email,
    profileIsAdmin: profile?.is_admin,
    isAdminByUUID,
    isAdminByEmail,
    isAdminByProfile,
    finalIsAdmin: isAdmin
  });

  // Not admin - redirect to dashboard
  if (!isAdmin) {
    console.log('❌ Admin access denied - redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('✅ Admin access granted');
  // Admin verified - show protected content
  return children;
};

export default ProtectedAdminRoute;