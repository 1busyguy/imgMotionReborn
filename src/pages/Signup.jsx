import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Zap, Mail, Lock, ArrowLeft, AlertTriangle, ShoppingCart, Crown, Building2 } from 'lucide-react';

const Signup = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ipBlocked, setIpBlocked] = useState(false);
  const [checkingIP, setCheckingIP] = useState(false);
  const [checkingBanStatus, setCheckingBanStatus] = useState(false);
  const [userBanned, setUserBanned] = useState(false);
  const [banDetails, setBanDetails] = useState(null);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Check IP signup limit
  const checkIPLimit = async () => {
    setCheckingIP(true);
    try {
      console.log('🔍 Checking IP signup limit...');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-ip-signup-limit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('IP check failed, allowing signup');
        return true; // Fail open
      }

      const result = await response.json();
      console.log('IP check result:', result);

      if (!result.allowed) {
        console.log('🚫 IP blocked from signup:', result.reason);
        setIpBlocked(true);
        return false;
      }

      return true;
    } catch (error) {
      console.error('IP check error:', error);
      return true; // Fail open - don't block legitimate users
    } finally {
      setCheckingIP(false);
    }
  };

  // Check if user email is banned
  const checkUserBanStatus = async (email) => {
    setCheckingBanStatus(true);
    try {
      console.log('🔍 Checking ban status for email:', email);
      
      const { data: bannedUser, error } = await supabase
        .from('profiles')
        .select('banned, ban_reason, banned_at, email')
        .eq('email', email)
        .eq('banned', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking ban status:', error);
        return true; // Fail open - allow signup if check fails
      }

      if (bannedUser) {
        console.log('🚫 User is banned:', bannedUser);
        setBanDetails(bannedUser);
        setUserBanned(true);
        return false; // User is banned
      }

      console.log('✅ User is not banned, can proceed');
      return true; // User is not banned
    } catch (error) {
      console.error('Ban check error:', error);
      return true; // Fail open
    } finally {
      setCheckingBanStatus(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      // Check if user email is banned first
      const canSignup = await checkUserBanStatus(formData.email);
      if (!canSignup) {
        setLoading(false);
        return;
      }

      // Check IP limit before proceeding
      const ipAllowed = await checkIPLimit();
      if (!ipAllowed) {
        setLoading(false);
        return;
      }

      console.log('📝 Creating user account...');
      
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            email: formData.email
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        console.log('✅ User created successfully:', data.user.id);
        
        // Increment IP signup count for successful email signups
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/increment-ip-signup`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${data.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ signupType: 'email' })
          });
          
          // Also capture IP in profile
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-signup-ip`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${data.session?.access_token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ signupType: 'email' })
          });
          
          console.log('✅ IP tracking completed for email signup');
        } catch (ipError) {
          console.warn('IP tracking failed (non-critical):', ipError);
        }

        if (data.user.email_confirmed_at) {
          // User is already confirmed (shouldn't happen with new signups)
          navigate('/dashboard');
        } else {
          // Show success message for email confirmation
          setSuccess('Account created! Please check your email and click the confirmation link to complete your registration.');
        }
      }
    } catch (error) {
      console.error('Signup error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      // Note: For OAuth, we can't check email ban status beforehand
      // since we don't have the email until after OAuth completes.
      // Ban checking for OAuth users happens in the ProtectedRoute component
      // in App.tsx after they're redirected back from Google.
      // This is the standard pattern for OAuth flows.
      console.log('🔍 OAuth signup - ban checking will happen after OAuth completes');
      
      // Check IP limit before OAuth
      const ipAllowed = await checkIPLimit();
      if (!ipAllowed) {
        return;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });
      if (error) throw error;
    } catch (error) {
      setError(error.message);
    }
  };

  // Banned User Message Component
  if (userBanned && banDetails) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-red-500/30">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-4">Account Suspended</h1>
            
            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-red-200 leading-relaxed">
                This email address is associated with a suspended account and cannot be used to create a new account.
              </p>
              {banDetails.ban_reason && (
                <p className="text-red-300 text-sm mt-2">
                  <strong>Reason:</strong> {banDetails.ban_reason}
                </p>
              )}
              {banDetails.banned_at && (
                <p className="text-red-300 text-sm mt-1">
                  <strong>Date:</strong> {new Date(banDetails.banned_at).toLocaleDateString()}
                </p>
              )}
            </div>

            <div className="space-y-4">
              <Link
                to="/contact"
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <Mail className="w-5 h-5" />
                <span>Contact Support</span>
              </Link>
              
              <Link
                to="/"
                className="block text-purple-300 hover:text-purple-200 transition-colors"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // IP Blocked Message Component
  if (ipBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-orange-500/30">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
                <Zap className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-white mb-4">Free Account Limit Reached</h1>
            
            <div className="bg-orange-500/20 border border-orange-500/30 rounded-lg p-4 mb-6">
              <p className="text-orange-200 leading-relaxed">
                Thanks for your interest in imgMotion! We have limited FREE accounts available per location. 
                To continue creating amazing content, please see what we offer with our premium plans.
              </p>
            </div>

            <div className="space-y-4">
              <Link
                to="/pricing"
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <Crown className="w-5 h-5" />
                <span>View Premium Plans</span>
              </Link>
              
              <Link
                to="/settings?tab=billing"
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <ShoppingCart className="w-5 h-5" />
                <span>Purchase Tokens</span>
              </Link>
              
              <Link
                to="/contact"
                className="block text-center bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg transition-colors border border-white/20"
              >
                Contact Support
              </Link>
              
              <Link
                to="/"
                className="block text-center text-purple-300 hover:text-purple-200 transition-colors"
              >
                Return to Home
              </Link>
            </div>

            {/* Premium Features Preview */}
            <div className="mt-8 bg-white/5 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">Premium Benefits:</h3>
              <ul className="text-purple-200 text-sm space-y-1 text-left">
                <li>• 3,000+ tokens monthly</li>
                <li>• No watermarks on content</li>
                <li>• Priority processing</li>
                <li>• Commercial usage rights</li>
                <li>• Premium AI models</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2 text-purple-200 hover:text-white transition-colors mb-4">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-2">Join imgMotion</h1>
          <p className="text-purple-200">Create your account and get 200 free tokens to start!</p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-100 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-100 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-purple-200 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-purple-200 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Create a password"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-purple-200 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Confirm your password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || checkingIP || checkingBanStatus}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : checkingBanStatus ? 'Checking Ban Status...' : checkingIP ? 'Checking IP...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-purple-200">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignup}
            disabled={checkingIP || checkingBanStatus}
            className="mt-4 w-full bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-3 border border-gray-300 disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>{checkingBanStatus ? 'Checking Status...' : checkingIP ? 'Checking IP...' : 'Continue with Google'}</span>
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-purple-200">
            Already have an account?{' '}
            <Link to="/login" className="text-purple-400 hover:text-purple-300 font-semibold">
              Sign in
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-purple-300 text-xs">
            By creating an account, you agree to our{' '}
            <Link to="/terms" className="text-purple-400 hover:text-purple-300 underline">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-purple-400 hover:text-purple-300 underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;