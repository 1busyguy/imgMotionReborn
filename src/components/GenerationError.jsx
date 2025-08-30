import React, { useState, useEffect } from 'react';
import {
    AlertCircle,
    XCircle,
    Shield,
    Clock,
    RefreshCw,
    X,
    AlertTriangle,
    WifiOff,
    Database,
    Zap
} from 'lucide-react';
import { ERROR_TYPES } from '../utils/unified-error-handler';

const GenerationError = ({
    generation,
    onRetry,
    canRetry = true,
    displayMode = 'auto', // 'inline', 'modal', or 'auto'
    onClose,
    showAsModal: forceModal = false,
    toolName = 'AI Generation'
}) => {
    const [showModal, setShowModal] = useState(false);

    // Use the new error_type column directly
    const errorType = generation?.error_type || ERROR_TYPES.UNKNOWN;
    const errorMessage = generation?.error_message || 'Generation failed';
    const errorDetails = generation?.metadata?.error_details;

    // Determine if we should show as modal
    useEffect(() => {
        if (displayMode === 'modal' || forceModal) {
            setShowModal(true);
        } else if (displayMode === 'auto') {
            // Auto mode: show content violations as modals, others inline
            setShowModal(errorType === ERROR_TYPES.CONTENT_VIOLATION);
        } else {
            setShowModal(false);
        }
    }, [displayMode, forceModal, errorType]);

    // Get error configuration based on type
    const getErrorConfig = () => {
        switch (errorType) {
            case ERROR_TYPES.CONTENT_VIOLATION:
                return {
                    icon: Shield,
                    color: 'text-red-400',
                    bgColor: 'bg-red-500/20',
                    borderColor: 'border-red-500/30',
                    gradientFrom: 'from-red-600',
                    gradientTo: 'to-red-400',
                    title: 'Content Policy Violation',
                    subtitle: 'Your request contains content that violates our usage policies',
                    canRetry: false,
                    showTips: true,
                    tips: [
                        'Avoid explicit or suggestive content',
                        'Keep requests appropriate for all audiences',
                        'Focus on creative, educational, or professional use cases',
                        'Review our content policy for detailed guidelines'
                    ]
                };
            case ERROR_TYPES.SERVER_ERROR:
                return {
                    icon: AlertCircle,
                    color: 'text-yellow-400',
                    bgColor: 'bg-yellow-500/20',
                    borderColor: 'border-yellow-500/30',
                    gradientFrom: 'from-yellow-600',
                    gradientTo: 'to-yellow-400',
                    title: 'Server Error',
                    subtitle: 'The AI service is temporarily experiencing issues',
                    canRetry: true,
                    showTips: false
                };
            case ERROR_TYPES.RATE_LIMIT:
                return {
                    icon: Clock,
                    color: 'text-orange-400',
                    bgColor: 'bg-orange-500/20',
                    borderColor: 'border-orange-500/30',
                    gradientFrom: 'from-orange-600',
                    gradientTo: 'to-orange-400',
                    title: 'Rate Limited',
                    subtitle: 'Too many requests. Please wait a moment before trying again',
                    canRetry: true,
                    showTips: false
                };
            case ERROR_TYPES.QUOTA_ERROR:
                return {
                    icon: Zap,
                    color: 'text-purple-400',
                    bgColor: 'bg-purple-500/20',
                    borderColor: 'border-purple-500/30',
                    gradientFrom: 'from-purple-600',
                    gradientTo: 'to-purple-400',
                    title: 'Quota Exceeded',
                    subtitle: 'You have reached your usage limit',
                    canRetry: false,
                    showTips: true,
                    tips: [
                        'Check your remaining tokens',
                        'Consider upgrading your plan',
                        'Contact support if you believe this is an error'
                    ]
                };
            case ERROR_TYPES.BAD_REQUEST:
                return {
                    icon: AlertTriangle,
                    color: 'text-amber-400',
                    bgColor: 'bg-amber-500/20',
                    borderColor: 'border-amber-500/30',
                    gradientFrom: 'from-amber-600',
                    gradientTo: 'to-amber-400',
                    title: 'Invalid Request',
                    subtitle: 'There was an issue with your request parameters',
                    canRetry: true,
                    showTips: false
                };
            case ERROR_TYPES.TIMEOUT:
                return {
                    icon: WifiOff,
                    color: 'text-blue-400',
                    bgColor: 'bg-blue-500/20',
                    borderColor: 'border-blue-500/30',
                    gradientFrom: 'from-blue-600',
                    gradientTo: 'to-blue-400',
                    title: 'Request Timeout',
                    subtitle: 'The request took too long to complete',
                    canRetry: true,
                    showTips: false
                };
            default:
                return {
                    icon: XCircle,
                    color: 'text-gray-400',
                    bgColor: 'bg-gray-500/20',
                    borderColor: 'border-gray-500/30',
                    gradientFrom: 'from-gray-600',
                    gradientTo: 'to-gray-400',
                    title: 'Generation Failed',
                    subtitle: 'An unexpected error occurred',
                    canRetry: true,
                    showTips: false
                };
        }
    };

    const config = getErrorConfig();
    const Icon = config.icon;

    const handleClose = () => {
        setShowModal(false);
        if (onClose) onClose();
    };

    const handleRetry = () => {
        handleClose();
        if (onRetry) onRetry();
    };

    // Inline error display
    const InlineError = () => (
        <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4 animate-fadeIn`}>
            <div className="flex items-start space-x-3">
                <Icon className={`w-6 h-6 ${config.color} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                    <p className={`font-medium ${config.color}`}>{config.title}</p>
                    <p className="text-sm text-gray-300 mt-1">{errorMessage}</p>
                    {errorDetails?.status_code && (
                        <p className="text-xs text-gray-400 mt-2">
                            Error code: {errorDetails.status_code}
                        </p>
                    )}
                </div>
                {canRetry && config.canRetry && onRetry && (
                    <button
                        onClick={onRetry}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors flex-shrink-0"
                    >
                        <RefreshCw className="w-3 h-3" />
                        <span>Retry</span>
                    </button>
                )}
            </div>
        </div>
    );

    // Modal error display
    const ModalError = () => (
        <>
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={handleClose}
                    />

                    {/* Modal Content */}
                    <div className="relative bg-gradient-to-br from-gray-900 via-purple-900/50 to-gray-900 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-white/10 animate-slideUp">
                        {/* Header with gradient */}
                        <div className={`bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo} p-1`}>
                            <div className="bg-gray-900/90 backdrop-blur-sm p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className={`p-3 ${config.bgColor} rounded-xl`}>
                                            <Icon className={`w-8 h-8 ${config.color}`} />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-white">
                                                {config.title}
                                            </h3>
                                            <p className="text-sm text-gray-300 mt-1">
                                                {toolName}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleClose}
                                        className="text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <p className="text-gray-300">
                                    {config.subtitle}
                                </p>
                                {errorMessage !== config.subtitle && (
                                    <p className="text-sm text-gray-400">
                                        {errorMessage}
                                    </p>
                                )}
                            </div>

                            {/* Tips for certain error types */}
                            {config.showTips && config.tips && (
                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                    <p className="text-sm font-medium text-gray-200 mb-3">
                                        {errorType === ERROR_TYPES.CONTENT_VIOLATION ? 'Guidelines:' : 'Suggestions:'}
                                    </p>
                                    <ul className="space-y-2">
                                        {config.tips.map((tip, index) => (
                                            <li key={index} className="flex items-start space-x-2 text-sm text-gray-300">
                                                <span className="text-purple-400 mt-0.5">•</span>
                                                <span>{tip}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Technical details (collapsible) */}
                            {errorDetails && (
                                <details className="bg-black/20 rounded-lg p-3 border border-white/5">
                                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                                        Technical Details
                                    </summary>
                                    <div className="mt-2 space-y-1 text-xs text-gray-500 font-mono">
                                        {errorDetails.status_code && (
                                            <p>Status: {errorDetails.status_code}</p>
                                        )}
                                        {errorDetails.raw_error && (
                                            <p className="break-all">
                                                {errorDetails.raw_error.substring(0, 100)}...
                                            </p>
                                        )}
                                        {generation?.id && (
                                            <p>ID: {generation.id.substring(0, 8)}...</p>
                                        )}
                                    </div>
                                </details>
                            )}
                        </div>

                        {/* Footer with actions */}
                        <div className="p-6 pt-0 flex justify-end space-x-3">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                            >
                                Close
                            </button>
                            {canRetry && config.canRetry && onRetry && (
                                <button
                                    onClick={handleRetry}
                                    className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg transition-all transform hover:scale-105"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Try Again</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    // Return appropriate display based on mode
    if (showModal) {
        return <ModalError />;
    } else {
        return <InlineError />;
    }
};

export default GenerationError;

// CSS for animations (add to your global styles or component)
const styles = `
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

.animate-slideUp {
  animation: slideUp 0.3s ease-out;
}
`;