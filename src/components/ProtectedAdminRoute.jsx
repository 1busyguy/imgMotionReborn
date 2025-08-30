import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedAdminRoute = ({ children }) => {
  const { user } = useAuth();

  // Not logged in - redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is admin using the same logic as other components
  const adminUUIDs = [
    '991e17a6-c1a8-4496-8b28-cc83341c028a' // jim@1busyguy.com
  ];
  
  const isAdmin = user && (
    adminUUIDs.includes(user.id) || 
    user.email === 'jim@1busyguy.com' || 
    user.user_metadata?.email === 'jim@1busyguy.com'
  );

  // Not admin - redirect to dashboard
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Admin verified - show protected content
  return children;
};

export default ProtectedAdminRoute;