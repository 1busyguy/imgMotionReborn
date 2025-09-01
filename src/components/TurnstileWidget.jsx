import React from 'react';
import { Turnstile } from '@marsidev/react-turnstile';

const TurnstileWidget = ({
    onVerify,
    onError,
    onExpire,
    theme = 'dark'
}) => {
    const turnstileRef = React.useRef(null);

    const handleExpire = () => {
        if (onExpire) onExpire();
        // Reset the widget when it expires
        if (turnstileRef.current) turnstileRef.current.reset();
    };

    return (
        <div className="flex justify-center my-4">
            <Turnstile
                ref={turnstileRef}
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                onSuccess={onVerify}
                onError={onError}
                onExpire={handleExpire}
                options={{
                    theme,
                    size: 'normal',
                }}
            />
        </div>
    );
};

export default TurnstileWidget;