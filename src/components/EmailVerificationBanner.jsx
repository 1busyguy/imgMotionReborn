import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Mail, X, RefreshCw, CheckCircle } from 'lucide-react';

const EmailVerificationBanner = ({ user, onDismiss }) => {
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Don't show banner if user's email is already confirmed
  if (!user || user.email_confirmed_at) {
    return null;
  }

  const handleResendEmail = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;
      
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (error) {
      console.error('Error resending email:', error);
      alert('Error resending email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-blue-500/20 border-b border-blue-500/30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Mail className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-blue-200 font-medium">
                Please verify your email address
              </p>
              <p className="text-blue-300 text-sm">
                Check your inbox for a confirmation link to activate your account
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {resent ? (
              <div className="flex items-center space-x-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Email sent!</span>
              </div>
            ) : (
              <button
                onClick={handleResendEmail}
                disabled={resending}
                className="flex items-center space-x-2 text-blue-300 hover:text-blue-200 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${resending ? 'animate-spin' : ''}`} />
                <span className="text-sm">
                  {resending ? 'Sending...' : 'Resend Email'}
                </span>
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-blue-300 hover:text-blue-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;