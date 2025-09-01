// src/utils/deviceFingerprint.js
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// Cache the fingerprint agent to avoid multiple initializations
let fpPromise = null;

/**
 * Initialize the fingerprint agent
 * @returns {Promise} - FingerprintJS agent promise
 */
const initFingerprint = () => {
    if (!fpPromise) {
        fpPromise = FingerprintJS.load();
    }
    return fpPromise;
};

/**
 * Get device fingerprint
 * @returns {Promise<string>} - The device fingerprint ID
 */
export const getDeviceFingerprint = async () => {
    try {
        const fp = await initFingerprint();
        const result = await fp.get();
        return result.visitorId;
    } catch (error) {
        console.error('Error getting device fingerprint:', error);
        // Return a fallback fingerprint based on available browser data
        return generateFallbackFingerprint();
    }
};

/**
 * Generate a fallback fingerprint when FingerprintJS fails
 * @returns {string} - A fallback fingerprint
 */
const generateFallbackFingerprint = () => {
    const nav = window.navigator;
    const screen = window.screen;

    const fingerprint = {
        userAgent: nav.userAgent || '',
        language: nav.language || '',
        platform: nav.platform || '',
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        colorDepth: screen.colorDepth || 0,
        pixelRatio: window.devicePixelRatio || 1,
        // Add more entropy
        cookieEnabled: nav.cookieEnabled,
        doNotTrack: nav.doNotTrack,
        hardwareConcurrency: nav.hardwareConcurrency || 0,
    };

    // Create a simple hash from the fingerprint object
    const fingerprintString = JSON.stringify(fingerprint);
    return simpleHash(fingerprintString);
};

/**
 * Simple hash function for fallback fingerprinting
 * @param {string} str - String to hash
 * @returns {string} - Hashed string
 */
const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
};

/**
 * Get extended device information for additional validation
 * @returns {Object} - Device information object
 */
export const getDeviceInfo = () => {
    const nav = window.navigator;
    const screen = window.screen;

    return {
        // Basic info
        userAgent: nav.userAgent || '',
        platform: nav.platform || '',
        language: nav.language || '',
        languages: nav.languages || [],

        // Screen info
        screenWidth: screen.width,
        screenHeight: screen.height,
        screenAvailWidth: screen.availWidth,
        screenAvailHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio || 1,

        // Browser features
        cookieEnabled: nav.cookieEnabled,
        doNotTrack: nav.doNotTrack,
        hardwareConcurrency: nav.hardwareConcurrency || 0,
        maxTouchPoints: nav.maxTouchPoints || 0,

        // Time info
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),

        // WebGL info (if available)
        webglVendor: getWebGLVendor(),
        webglRenderer: getWebGLRenderer(),

        // Canvas fingerprint (lightweight version)
        canvasFingerprint: getCanvasFingerprint(),
    };
};

/**
 * Get WebGL vendor information
 * @returns {string|null} - WebGL vendor or null
 */
const getWebGLVendor = () => {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return null;

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return null;

        return gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    } catch (e) {
        return null;
    }
};

/**
 * Get WebGL renderer information
 * @returns {string|null} - WebGL renderer or null
 */
const getWebGLRenderer = () => {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return null;

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return null;

        return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    } catch (e) {
        return null;
    }
};

/**
 * Get a simple canvas fingerprint
 * @returns {string} - Canvas fingerprint hash
 */
const getCanvasFingerprint = () => {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        // Draw some text with different styles
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('imgMotion 😊', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('imgMotion 😊', 4, 17);

        // Get canvas data
        const dataURL = canvas.toDataURL();
        return simpleHash(dataURL);
    } catch (e) {
        return '';
    }
};

/**
 * Check if the device fingerprint has been seen recently
 * @param {string} fingerprint - Device fingerprint to check
 * @returns {boolean} - True if fingerprint was seen recently
 */
export const isRecentFingerprint = (fingerprint) => {
    const recentFingerprints = JSON.parse(localStorage.getItem('recentFingerprints') || '{}');
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Clean old fingerprints
    for (const [fp, timestamp] of Object.entries(recentFingerprints)) {
        if (timestamp < oneHourAgo) {
            delete recentFingerprints[fp];
        }
    }

    // Check if this fingerprint exists and is recent
    if (recentFingerprints[fingerprint] && recentFingerprints[fingerprint] > oneHourAgo) {
        return true;
    }

    // Add this fingerprint
    recentFingerprints[fingerprint] = now;
    localStorage.setItem('recentFingerprints', JSON.stringify(recentFingerprints));

    return false;
};

/**
 * Rate limit check for device
 * @param {string} fingerprint - Device fingerprint
 * @param {string} action - Action being performed (signup, login, etc.)
 * @param {number} maxAttempts - Maximum attempts allowed
 * @param {number} windowMinutes - Time window in minutes
 * @returns {Object} - { allowed: boolean, remainingAttempts: number }
 */
export const checkDeviceRateLimit = (fingerprint, action, maxAttempts = 5, windowMinutes = 60) => {
    const key = `rateLimit_${action}_${fingerprint}`;
    const now = Date.now();
    const window = windowMinutes * 60 * 1000;

    // Get existing attempts
    const attempts = JSON.parse(localStorage.getItem(key) || '[]');

    // Filter out old attempts
    const recentAttempts = attempts.filter(timestamp => timestamp > now - window);

    // Check if we're under the limit
    const allowed = recentAttempts.length < maxAttempts;
    const remainingAttempts = Math.max(0, maxAttempts - recentAttempts.length);

    if (allowed) {
        // Add this attempt
        recentAttempts.push(now);
        localStorage.setItem(key, JSON.stringify(recentAttempts));
    }

    return { allowed, remainingAttempts };
};