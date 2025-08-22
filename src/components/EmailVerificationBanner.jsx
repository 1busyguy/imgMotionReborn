import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mail, AlertTriangle, RefreshCw, CheckCircle, X } from 'lucide-react';

const EmailVerificationBanner = ({ user }) => {
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [error, setError] = useState('');

  const handleResendEmail = async () => {
    setIsResending(true);
    setError('');
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: {
          emailRedirectTo: `https://imgmotion.com/`
        }
      });

      if (error) throw error;
      
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (error) {
      console.error('Error resending email:', error);
      setError(error.message);
    } finally {
      setIsResending(false);
    }
  };

  if (isDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 backdrop-blur-md rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <Mail className="w-5 h-5 text-white" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h3 className="text-white font-semibold">Email Verification Required</h3>
            </div>
            <p className="text-amber-200 text-sm">
              Please check your email ({user.email}) and click the confirmation link to verify your account.
            </p>
            
            {error && (
              <p className="text-red-300 text-xs mt-1">{error}</p>
            )}
            
            {resendSuccess && (
              <div className="flex items-center space-x-1 mt-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                <p className="text-green-300 text-xs">Verification email sent!</p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleResendEmail}
            disabled={isResending || resendSuccess}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-700 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center space-x-2"
          >
            {isResending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Sending...</span>
              </>
            ) : resendSuccess ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Sent!</span>
              </>
            ) : (
              <>
                <Mail className="w-4 h-4" />
                <span>Resend Email</span>
              </>
            )}
          </button>
          
          <button
            onClick={() => setIsDismissed(true)}
            className="text-amber-300 hover:text-amber-200 transition-colors p-1"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationBanner;