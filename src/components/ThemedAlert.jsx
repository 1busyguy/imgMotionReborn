import React from 'react';
import { AlertTriangle, X, Info, CheckCircle, XCircle } from 'lucide-react';

const ThemedAlert = ({ 
  type = 'error', // 'error', 'warning', 'info', 'success'
  title,
  message,
  onClose,
  isOpen = true,
  autoClose = false,
  autoCloseDelay = 5000
}) => {
  React.useEffect(() => {
    if (autoClose && isOpen) {
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, autoCloseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [autoClose, isOpen, autoCloseDelay, onClose]);

  if (!isOpen) return null;

  const alertConfig = {
    error: {
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/50',
      textColor: 'text-red-200',
      titleColor: 'text-red-100',
      iconColor: 'text-red-400',
      icon: XCircle,
      gradientFrom: 'from-red-500/10',
      gradientTo: 'to-pink-500/10'
    },
    warning: {
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/50',
      textColor: 'text-amber-200',
      titleColor: 'text-amber-100',
      iconColor: 'text-amber-400',
      icon: AlertTriangle,
      gradientFrom: 'from-amber-500/10',
      gradientTo: 'to-orange-500/10'
    },
    info: {
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/50',
      textColor: 'text-blue-200',
      titleColor: 'text-blue-100',
      iconColor: 'text-blue-400',
      icon: Info,
      gradientFrom: 'from-blue-500/10',
      gradientTo: 'to-cyan-500/10'
    },
    success: {
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/50',
      textColor: 'text-green-200',
      titleColor: 'text-green-100',
      iconColor: 'text-green-400',
      icon: CheckCircle,
      gradientFrom: 'from-green-500/10',
      gradientTo: 'to-emerald-500/10'
    }
  };

  const config = alertConfig[type];
  const IconComponent = config.icon;

  return (
    <div className={`${config.bgColor} backdrop-blur-md border ${config.borderColor} rounded-2xl p-4 mb-4 bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo} shadow-lg`}>
      <div className="flex items-start space-x-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor} border ${config.borderColor}`}>
          <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className={`font-semibold ${config.titleColor} mb-1`}>
              {title}
            </h3>
          )}
          <p className={`${config.textColor} text-sm leading-relaxed`}>
            {message}
          </p>
        </div>
        
        {onClose && (
          <button
            onClick={onClose}
            className={`${config.iconColor} hover:opacity-75 transition-opacity p-1 rounded-lg hover:bg-white/10`}
            aria-label="Close alert"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ThemedAlert;