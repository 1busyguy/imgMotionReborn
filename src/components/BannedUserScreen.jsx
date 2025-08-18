import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, Mail, ArrowLeft } from 'lucide-react';

const BannedUserScreen = ({ banReason, bannedAt }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-red-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-red-500/30">
        <div className="text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500/50">
              <Shield className="w-10 h-10 text-red-400" />
            </div>
          </div>
          
          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-4">Account Suspended</h1>
          
          {/* Message */}
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-red-200 font-medium mb-2">Terms of Service Violation</p>
                <p className="text-red-300 text-sm leading-relaxed">
                  Your account has been suspended for violating the terms and conditions of imgMotionMagic.com.
                </p>
              </div>
            </div>
          </div>

          {/* Ban Details */}
          <div className="bg-white/5 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-white font-medium mb-3">Suspension Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-red-200">Reason:</span>
                <span className="text-white">{banReason || 'Policy violation'}</span>
              </div>
              {bannedAt && (
                <div className="flex justify-between">
                  <span className="text-red-200">Date:</span>
                  <span className="text-white">
                    {new Date(bannedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-red-200">Status:</span>
                <span className="text-red-400 font-medium">Permanently Suspended</span>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <h3 className="text-white font-medium mb-3">Need Help?</h3>
            <p className="text-red-200 text-sm mb-3">
              If you believe this suspension was made in error, please contact our support team.
            </p>
            <a
              href="mailto:imgmotionapp@gmail.com?subject=Account Suspension Appeal"
              className="inline-flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>Contact Support</span>
            </a>
          </div>

          {/* Terms Link */}
          <div className="text-center">
            <Link
              to="/terms"
              className="inline-flex items-center space-x-2 text-red-300 hover:text-red-200 transition-colors text-sm"
            >
              <span>Review Terms of Service</span>
              <ArrowLeft className="w-3 h-3 rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BannedUserScreen;