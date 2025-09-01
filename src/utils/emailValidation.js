// src/utils/emailValidation.js

// Comprehensive list of disposable email domains
export const DISPOSABLE_EMAIL_DOMAINS = [
    // Common disposable email services
    'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
    'throwaway.email', 'yopmail.com', 'tempmail.net', 'trashmail.com',
    'fakeinbox.com', 'mailnesia.com', 'temp-mail.org', 'getnada.com',
    'burnermail.io', 'maildrop.cc', 'mintemail.com', 'sharklasers.com',
    'guerrillamail.info', 'spam4.me', 'grr.la', 'mailnator.com',
    'disposablemail.com', 'temporarymail.net', 'throwawaymail.com',
    'tmpmail.net', 'tmpmail.org', 'tmpeml.info', 'tempmailer.com',
    'tempinbox.com', 'spambox.us', 'spambox.info', 'spambox.org',
    'spam.la', 'mytemp.email', 'mailcatch.com', 'mailexpire.com',
    'jetable.com', 'jetable.net', 'jetable.org', 'link2mail.net',
    'mailhazard.com', 'mailhazard.us', 'mailmetrash.com', 'mailmoat.com',
    'mailnull.com', 'mailshell.com', 'mailsiphon.com', 'mailtemp.info',
    'mailzilla.com', 'mailzilla.org', 'mbx.cc', 'mega.zik.dj',
    'meinspamschutz.de', 'meltmail.com', 'mierdamail.com', 'mt2009.com',
    'mt2014.com', 'mytrashmail.com', 'no-spam.ws', 'nobulk.com',
    'noclickemail.com', 'nogmailspam.info', 'nomail.xl.cx', 'nomail2me.com',
    'nospam.ze.tc', 'nospam4.us', 'nospamfor.us', 'nospamthanks.info'
];

// Patterns that indicate suspicious email addresses
export const SUSPICIOUS_EMAIL_PATTERNS = [
    /^[a-z0-9]{20,}@/, // Very long random strings before @
    /^test\d+@/, // test123@
    /^user\d+@/, // user456@
    /^temp/, // temp*
    /^throwaway/, // throwaway*
    /^fake/, // fake*
    /^spam/, // spam*
    /^trash/, // trash*
    /^disposable/, // disposable*
    /^mailinator/, // mailinator*
];

/**
 * Check if an email is from a disposable domain
 * @param {string} email - The email address to check
 * @returns {boolean} - True if the email is from a disposable domain
 */
export const isDisposableEmail = (email) => {
    if (!email || typeof email !== 'string') return false;

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;

    // Check exact domain match
    if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
        return true;
    }

    // Check for subdomains of disposable services
    const domainParts = domain.split('.');
    if (domainParts.length > 2) {
        const mainDomain = domainParts.slice(-2).join('.');
        if (DISPOSABLE_EMAIL_DOMAINS.includes(mainDomain)) {
            return true;
        }
    }

    // Check for common disposable email keywords in domain
    const disposableKeywords = ['tempmail', 'throwaway', 'guerrilla', 'mailinator', 'trashmail', 'fakeinbox'];
    return disposableKeywords.some(keyword => domain.includes(keyword));
};

/**
 * Check if an email has suspicious patterns
 * @param {string} email - The email address to check
 * @returns {string} - Risk level: 'low', 'medium', or 'high'
 */
export const assessEmailRisk = (email) => {
    if (!email || typeof email !== 'string') return 'high';

    const emailLower = email.toLowerCase();
    const [localPart, domain] = emailLower.split('@');

    if (!localPart || !domain) return 'high';

    // Check if it's a disposable email
    if (isDisposableEmail(email)) {
        return 'high';
    }

    // Check for suspicious patterns in local part
    for (const pattern of SUSPICIOUS_EMAIL_PATTERNS) {
        if (pattern.test(emailLower)) {
            return 'medium';
        }
    }

    // Check for excessive numbers in local part
    const numbersInLocal = (localPart.match(/\d/g) || []).length;
    if (numbersInLocal > 5) {
        return 'high';
    }

    // Check for multiple plus signs (alias abuse)
    if (localPart.includes('+')) {
        const plusCount = localPart.split('+').length - 1;
        if (plusCount > 1) {
            return 'high';
        }
        // Single plus sign is medium risk
        return 'medium';
    }

    // Check for very short local parts (likely fake)
    if (localPart.length < 3) {
        return 'medium';
    }

    // Check for all numbers email
    if (/^\d+$/.test(localPart)) {
        return 'high';
    }

    // Check for random-looking strings
    // If ratio of consonants to vowels is very high, it might be random
    const vowels = localPart.match(/[aeiou]/g) || [];
    const consonants = localPart.match(/[bcdfghjklmnpqrstvwxyz]/g) || [];
    if (consonants.length > 0 && vowels.length === 0) {
        return 'medium';
    }

    return 'low';
};

/**
 * Validate email format
 * @param {string} email - The email address to validate
 * @returns {boolean} - True if email format is valid
 */
export const isValidEmailFormat = (email) => {
    // RFC 5322 compliant email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
};

/**
 * Get a user-friendly message for email validation issues
 * @param {string} email - The email address that was validated
 * @param {string} riskLevel - The risk level from assessEmailRisk
 * @returns {string} - A user-friendly error message
 */
export const getEmailValidationMessage = (email, riskLevel) => {
    if (!isValidEmailFormat(email)) {
        return 'Please enter a valid email address.';
    }

    if (isDisposableEmail(email)) {
        return 'Disposable email addresses are not allowed. Please use a permanent email address.';
    }

    if (riskLevel === 'high') {
        return 'This email address appears to be invalid or high-risk. Please use a different email.';
    }

    if (riskLevel === 'medium') {
        return 'Please ensure you\'re using a valid, permanent email address.';
    }

    return '';
};