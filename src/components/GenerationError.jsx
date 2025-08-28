import React from 'react';
import { X, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

const GenerationError = ({ generation, onRetry, canRetry = true }) => {
    const errorType = generation.metadata?.error_analysis?.error_type ||
        generation.metadata?.error_type;
    const errorCode = generation.metadata?.error_analysis?.error_code ||
        generation.metadata?.fal_error_details?.status_code;

    const getErrorTypeConfig = () => {
        switch (errorType) {
            case 'content_violation':
                return {
                    bgColor: 'bg-yellow-500/20',
                    borderColor: 'border-yellow-500/30',
                    textColor: 'text-yellow-400',
                    icon: AlertTriangle,
                    title: 'Content Policy Violation',
                    tips: 'Use family-friendly language, avoid suggestive content, and ensure your images are appropriate.'
                };
            case 'server_error':
                return {
                    bgColor: 'bg-orange-500/20',
                    borderColor: 'border-orange-500/30',
                    textColor: 'text-orange-400',
                    icon: Zap,
                    title: 'Server Error',
                    tips: 'This is a temporary issue. Please try again in a few minutes.'
                };
            case 'bad_request':
                return {
                    bgColor: 'bg-purple-500/20',
                    borderColor: 'border-purple-500/30',
                    textColor: 'text-purple-400',
                    icon: X,
                    title: 'Invalid Request',
                    tips: 'Check your input parameters and try again.'
                };
            default:
                return {
                    bgColor: 'bg-red-500/20',
                    borderColor: 'border-red-500/30',
                    textColor: 'text-red-400',
                    icon: X,
                    title: 'Generation Failed',
                    tips: null
                };
        }
    };

    const config = getErrorTypeConfig();
    const IconComponent = config.icon;

    return (
        <div className={`mb-4 ${config.bgColor} border ${config.borderColor} rounded-lg p-4`}>
            <div className="flex items-start space-x-3">
                <IconComponent className={`w-6 h-6 ${config.textColor} flex-shrink-0 mt-1`} />
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className={`${config.textColor} font-medium mb-1`}>
                                {config.title}
                                {errorCode && (
                                    <span className="ml-2 text-xs opacity-75">
                                        (Error {errorCode})
                                    </span>
                                )}
                            </p>
                            <p className="text-red-300 text-sm">
                                {generation.error_message || 'Unknown error occurred'}
                            </p>
                        </div>

                        {canRetry && errorType !== 'content_violation' && onRetry && (
                            <button
                                onClick={() => onRetry(generation)}
                                className="flex items-center space-x-1 bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg transition-colors text-sm"
                            >
                                <RefreshCw className="w-3 h-3" />
                                <span>Retry</span>
                            </button>
                        )}
                    </div>

                    {config.tips && (
                        <div className="mt-3 p-2 bg-black/20 rounded">
                            <p className={`${config.textColor} text-xs opacity-90`}>
                                💡 {config.tips}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GenerationError;