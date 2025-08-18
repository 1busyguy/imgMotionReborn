import React from 'react';
import { AlertTriangle, X, Shield, Info, ChevronDown, ChevronUp } from 'lucide-react';

const NSFWAlert = ({ isOpen, onClose, toolName, details }) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = React.useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl max-w-md w-full border border-red-500/30 shadow-2xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Content Policy Violation</h3>
                <p className="text-red-300 text-sm">{toolName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Alert Icon and Message */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h4 className="text-xl font-semibold text-white mb-2">
              Image Flagged by Content Filter
            </h4>
            <p className="text-red-200 leading-relaxed">
              The uploaded image contains material that has been flagged by our content safety system. 
              Please try with a different image that complies with our content policy.
            </p>
          </div>

          {/* Technical Details - Collapsible */}
          {details && (
            <div className="mb-6">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="w-full bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center justify-between text-red-200 hover:bg-red-500/20 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium">Technical Details</span>
                </div>
                {showTechnicalDetails ? (
                  <ChevronUp className="w-4 h-4 text-red-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-red-400" />
                )}
              </button>
              
              {showTechnicalDetails && (
                <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-300 text-xs font-mono break-all leading-relaxed">
                    {details}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Content Guidelines */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <h5 className="text-white font-medium mb-3">Content Guidelines:</h5>
            <ul className="text-purple-200 text-sm space-y-2">
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></span>
                <span>Use family-friendly images</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></span>
                <span>Avoid suggestive or inappropriate content</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></span>
                <span>Ensure images comply with community standards</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2 flex-shrink-0"></span>
                <span>Try different images if this persists</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Try Different Image
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NSFWAlert;