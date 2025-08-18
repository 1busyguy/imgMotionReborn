import React from 'react';
import { AlertTriangle, X, Shield, Eye, FileText, ChevronDown, ChevronUp } from 'lucide-react';

const SafetyWarningModal = ({ 
  isOpen, 
  onClose, 
  onContinue, 
  onModify,
  warningData,
  toolName 
}) => {
  const [showDetails, setShowDetails] = React.useState(false);

  if (!isOpen || !warningData) return null;

  const { title, message, severity, violations, recommendations, imageFlagged, promptFlagged, riskLevel, confidence } = warningData;

  const getSeverityColor = () => {
    switch (severity) {
      case 'error':
        return 'from-red-500/20 to-red-600/20 border-red-500/50';
      case 'warning':
        return 'from-amber-500/20 to-orange-500/20 border-amber-500/50';
      default:
        return 'from-blue-500/20 to-cyan-500/20 border-blue-500/50';
    }
  };

  const getSeverityIcon = () => {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="w-6 h-6 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-400" />;
      default:
        return <Shield className="w-6 h-6 text-blue-400" />;
    }
  };

  const getRiskColor = () => {
    switch (riskLevel) {
      case 'high':
        return 'text-red-400';
      case 'medium':
        return 'text-amber-400';
      case 'low':
        return 'text-green-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-gradient-to-br ${getSeverityColor()} backdrop-blur-md rounded-2xl max-w-lg w-full border shadow-2xl`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                severity === 'error' ? 'bg-red-500/20' : 
                severity === 'warning' ? 'bg-amber-500/20' : 'bg-blue-500/20'
              }`}>
                {getSeverityIcon()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                <p className="text-sm text-gray-300">{toolName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Main Message */}
          <div className="mb-6">
            <p className="text-white leading-relaxed mb-4">
              {message}
            </p>
            
            {/* Risk Level Indicator */}
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-gray-300 text-sm">Risk Level:</span>
              <span className={`font-semibold text-sm ${getRiskColor()}`}>
                {riskLevel.toUpperCase()}
              </span>
              <span className="text-gray-400 text-xs">
                ({Math.round(confidence * 100)}% confidence)
              </span>
            </div>

            {/* What was flagged */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`p-3 rounded-lg border ${
                imageFlagged 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : 'bg-green-500/10 border-green-500/30'
              }`}>
                <div className="flex items-center space-x-2">
                  <Eye className={`w-4 h-4 ${imageFlagged ? 'text-red-400' : 'text-green-400'}`} />
                  <span className={`text-sm font-medium ${imageFlagged ? 'text-red-200' : 'text-green-200'}`}>
                    Image
                  </span>
                </div>
                <p className={`text-xs mt-1 ${imageFlagged ? 'text-red-300' : 'text-green-300'}`}>
                  {imageFlagged ? 'Content detected' : 'Looks safe'}
                </p>
              </div>
              
              <div className={`p-3 rounded-lg border ${
                promptFlagged 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : 'bg-green-500/10 border-green-500/30'
              }`}>
                <div className="flex items-center space-x-2">
                  <FileText className={`w-4 h-4 ${promptFlagged ? 'text-red-400' : 'text-green-400'}`} />
                  <span className={`text-sm font-medium ${promptFlagged ? 'text-red-200' : 'text-green-200'}`}>
                    Prompt
                  </span>
                </div>
                <p className={`text-xs mt-1 ${promptFlagged ? 'text-red-300' : 'text-green-300'}`}>
                  {promptFlagged ? 'Issues found' : 'Looks safe'}
                </p>
              </div>
            </div>
          </div>

          {/* Token Warning */}
          <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-amber-200 font-medium mb-1">Important Notice</h4>
                <p className="text-amber-300 text-sm leading-relaxed">
                  If you proceed and the generation fails due to content policy violations, 
                  <strong className="text-amber-200"> tokens will NOT be refunded</strong>. 
                  We recommend modifying your content to ensure successful generation.
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Analysis (Collapsible) */}
          {(violations.length > 0 || recommendations.length > 0) && (
            <div className="mb-6">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full bg-white/10 border border-white/20 rounded-lg p-3 flex items-center justify-between text-white hover:bg-white/20 transition-colors"
              >
                <span className="text-sm font-medium">View Detailed Analysis</span>
                {showDetails ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              
              {showDetails && (
                <div className="mt-3 bg-white/5 rounded-lg p-4 space-y-4">
                  {violations.length > 0 && (
                    <div>
                      <h5 className="text-white font-medium mb-2">Issues Detected:</h5>
                      <ul className="text-red-300 text-sm space-y-1">
                        {violations.map((violation, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0"></span>
                            <span>{violation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {recommendations.length > 0 && (
                    <div>
                      <h5 className="text-white font-medium mb-2">Recommendations:</h5>
                      <ul className="text-blue-300 text-sm space-y-1">
                        {recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 flex-shrink-0"></span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onModify}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <FileText className="w-4 h-4" />
              <span>Modify Content</span>
            </button>
            
            <button
              onClick={onContinue}
              className={`flex-1 font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2 ${
                severity === 'error'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Continue Anyway</span>
            </button>
          </div>
          
          {/* Disclaimer */}
          <p className="text-gray-400 text-xs text-center mt-4">
            This analysis is AI-powered and may not catch all policy violations. 
            Final content moderation is performed by the AI model provider.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SafetyWarningModal;