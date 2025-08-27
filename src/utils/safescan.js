// safescan.js — Child-safety focused, permissive for adult nudity
// BEFORE generation, this gate checks prompts/images with ZERO TOLERANCE for child exploitation,
// but does NOT clamp down on general adult nudity or other art content.

import { supabase } from '../lib/supabaseClient';

/* ===========================================================
   0) CONFIG
   =========================================================== */
export const safeScanConfig = {
  enabled: true,

  // We keep sensitivity low; no AI prompt scan (regex only) to avoid overblocking.
  imageSensitivity: 1,
  promptSensitivity: 1,

  toolsToScan: {
    'fal_wan_v22_video2video': true,
    'fal_kling_pro': true,
    'fal_minimax_hailuo': true,
    'fal_qwen_image_to_image': true,
    'fal_fal_qwen_image': true,
    'fal_veo3_fast': true,
    'veo3-standard': true,
    'fal_ltxv': true,
    'fal_seedance_pro': true,
    'fal_wan_v22_img2video_lora': true,
    'fal_wan_v22_text2video_lora': true,
    'fal_flux_kontext': true,
    'fal_flux_kontext_lora': true,
    'fal_gemini_flash_image_edit': true,
    'fal_hidream_i1': true,
    'fal_flux_kontext_max_multi': true,
    'fal_omnihuman': true
  },

  // Vision analyzer prompt (used by your edge function)
  imageAnalysisPrompt: `Analyze this image for potential content policy violations. Look for:
1. Nudity or sexually suggestive content
2. Violence, weapons, or gore
3. Hate symbols or offensive imagery
4. Illegal activities or dangerous content
5. Copyrighted characters or brands
6. Inappropriate content for general audiences

Respond with a JSON object:
{
  "safe": true/false,
  "confidence": 0.0-1.0,
  "violations": ["list of specific violations found"],
  "reasoning": "brief explanation of why it's flagged",
  "suggestions": ["suggestions for making it safer"],
  "categories": ["optional coarse tags like 'nudity','minors'"]
}`,

  // Ban flow
  logoutGraceMs: 10_000,     // 10s then sign out + redirect
  banRedirectPath: '/ban'    // destination for banned users
};

/* ===========================================================
   1) PROMPT CHILD-SAFETY CHECK (regex-only, permissive otherwise)
   =========================================================== */

// Flags/Window — use dotAll via 's' flag; no inline (?s)
const FLAGS = 'ius';        // i=ignoreCase, u=unicode, s=dotAll
const GAP   = '.{0,80}?';   // distance between minor indicator and sexual term

// High-signal fragments (kept generic — no raw slang dump)
const RX = {
  AGE:    new RegExp(String.raw`\b(?:[0-9]|1[0-7])\s?(?:yo|y\/o|yrs?|years?\s?-?\s?old)\b`, FLAGS),
  MINOR:  new RegExp(String.raw`\b(?:infant|toddler|child|kid|minor|underage|pre[- ]?teen|tween|teen|school(?:boy|girl)|high[- ]?schooler|middle[- ]?schooler)\b`, FLAGS),
  SCHOOL: new RegExp(String.raw`\b(?:kindergarten|elementary|middle(?:\s+school)?|junior\s+high|high\s+school|homeroom|school\s+uniform|field\s+trip|playground|recess)\b`, FLAGS),
  FAMILY: new RegExp(String.raw`\b(?:daughter|son|niece|nephew|sister|brother|step(?:daughter|son|sister|brother))\b`, FLAGS),
  SEX:    new RegExp(String.raw`\b(?:sex|sexual|nude|naked|explicit|porn|xxx|erotic|rape|molest|assault|incest)\b`, FLAGS),
  GRADE:  new RegExp(String.raw`\b(?:kindergarten|k|[1-9]|1[0-2]|[1-9](?:st|nd|rd|th)|1[0-2](?:st|nd|rd|th))\s*(?:grade)\b`, FLAGS),
  CORRUPT:new RegExp(String.raw`\b(?:deflower|corrupt|first\s*time|innocen(?:t|ce))\b`, FLAGS)
};

// Build proximity pattern A … GAP … B (both orders). No inline (?s).
function prox(a, b) {
  return new RegExp(
    `(?:${a.source})${GAP}(?:${b.source})|(?:${b.source})${GAP}(?:${a.source})`,
    FLAGS
  );
}

const PROMPT_RULES = [
  prox(RX.AGE, RX.SEX),
  prox(RX.MINOR, RX.SEX),
  prox(new RegExp(`${RX.SCHOOL.source}|${RX.GRADE.source}`, FLAGS), RX.SEX),
  prox(RX.FAMILY, RX.SEX),
  prox(RX.CORRUPT, new RegExp(`${RX.AGE.source}|${RX.MINOR.source}`, FLAGS))
];

function normalize(text = '') {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/@/g, 'a')
    .replace(/0/g, 'o')
    .replace(/[1|¡]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/[\s._-]{2,}/g, ' ');
}

function promptViolatesChildSafety(prompt = '') {
  const t = normalize(prompt);
  for (const rule of PROMPT_RULES) if (rule.test(t)) return true;
  return false;
}

/* ===========================================================
   2) BASIC ENABLE CHECK
   =========================================================== */
export const isSafeScanEnabled = (toolType) =>
  safeScanConfig.enabled && safeScanConfig.toolsToScan[toolType] !== false;

/* ===========================================================
   3) IMAGE SAFETY (Vision call + strict child-sex detection only)
   =========================================================== */

export const analyzeImageSafety = async (imageUrl) => {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image-safety`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrl,
        analysisType: 'safety',
        sensitivity: safeScanConfig.imageSensitivity,
        prompt: safeScanConfig.imageAnalysisPrompt
      })
    });

    if (!response.ok) {
      return { safe: true, confidence: 0, violations: [], reasoning: 'Analysis unavailable', suggestions: [], analysisError: true };
    }
    return await response.json();
  } catch (e) {
    console.error('analyzeImageSafety error:', e);
    return { safe: true, confidence: 0, violations: [], reasoning: 'Analysis error', suggestions: [], analysisError: true };
  }
};

// Robust child-sexual detection over the analysis JSON (categories, violations, reasoning, and fallback blob)
function textHasMinorIndicator(txt) {
  const minorWords = /\b(minor|under\s*age|underage|child|children|kid|infant|toddler|teen|pre[- ]?teen|school(?:boy|girl)|high[- ]?schooler|youth|young[- ]?looking)\b/i;
  const ageUnder18 = /\b(?:[0-9]|1[0-7])\s?(?:yo|y\/o|yrs?|years?\s?-?\s?old)\b/i;
  const grades = /\b(?:kindergarten|k|[1-9]|1[0-2]|[1-9](?:st|nd|rd|th)|1[0-2](?:st|nd|rd|th))\s*grade\b/i;
  return minorWords.test(txt) || ageUnder18.test(txt) || grades.test(txt);
}
function textHasSexualIndicator(txt) {
  return /\b(sex|sexual|nude|naked|explicit|porn|xxx|erotic|genitals?|breasts?|buttocks?|molest|incest|rape|intercourse)\b/i.test(txt);
}
function isChildSexualImage(analysis) {
  if (!analysis) return false;

  const cats = (analysis.categories || []).map(s => String(s).toLowerCase());
  const vios = (analysis.violations || []).map(s => String(s).toLowerCase());
  const reason = String(analysis.reasoning || '').toLowerCase();

  const hasMinorSignal =
    cats.some(c => /minor|underage|child|teen|youth/.test(c)) ||
    vios.some(v => /minor|underage|child|teen|youth/.test(v)) ||
    textHasMinorIndicator(reason);

  const hasSexSignal =
    cats.some(c => /sexual|nudity|explicit|porn|xxx|erotic/.test(c)) ||
    vios.some(v => /sexual|nudity|explicit|porn|xxx|erotic/.test(v)) ||
    textHasSexualIndicator(reason);

  if (hasMinorSignal && hasSexSignal) return true;

  // Fallback: scan entire payload text
  const blob = JSON.stringify(analysis).toLowerCase();
  return textHasMinorIndicator(blob) && textHasSexualIndicator(blob);
}

// Instant-ban flow: dispatch event (optional UI), then sign out + redirect after grace period
async function triggerInstantBan({ reason = 'Child sexual content detected in image' } = {}) {
  const logoutMs = safeScanConfig.logoutGraceMs || 10_000;
  try {
    try { window.dispatchEvent(new CustomEvent('safescan:instant-ban', { detail: { reason, logoutInMs: logoutMs } })); } catch {}
    setTimeout(async () => {
      try { await supabase.auth.signOut(); } catch {}
      try { window.location.assign(safeScanConfig.banRedirectPath || '/ban'); } catch {}
    }, logoutMs);
  } catch {}
}

/* ===========================================================
   4) PROMPT SAFETY (child-safety only; adult nudity allowed)
   =========================================================== */
export const analyzePromptSafety = async (prompt) => {
  try {
    if (promptViolatesChildSafety(prompt)) {
      return {
        safe: false,
        confidence: 0.95,
        violations: ['Child-safety: sexual content combined with references to minors/under-18'],
        reasoning: 'Regex proximity match of minor indicators with sexual context.',
        suggestions: [
          'Remove any sexual context and all references to minors/under-18.',
          'Keep scenarios strictly and explicitly adult (18+).'
        ],
        category: 'child-safety',
        method: 'regex-child-safety'
      };
    }

    // Everything else (incl. adult nudity) is allowed.
    return { safe: true, confidence: 1.0, violations: [], suggestions: [], method: 'permissive' };
  } catch (e) {
    console.error('analyzePromptSafety error:', e);
    return { safe: true, confidence: 0, violations: [], suggestions: [], analysisError: true, method: 'error' };
  }
};

/* ===========================================================
   5) COMPREHENSIVE ENTRYPOINT — image first, then prompt
   =========================================================== */
export const performSafetyAnalysis = async (imageUrl, prompt, toolType) => {
  try {
    if (!isSafeScanEnabled(toolType)) {
      return {
        safe: true,
        imageAnalysis: { safe: true, skipped: true },
        promptAnalysis: { safe: true, skipped: true },
        overallRisk: 'low',
        recommendations: []
      };
    }

    // 1) IMAGE: short-circuit only on child-sexual content
    let imageAnalysis = { safe: true, skipped: true };
    if (imageUrl) {
      imageAnalysis = await analyzeImageSafety(imageUrl);

      if (isChildSexualImage(imageAnalysis)) {
        await triggerInstantBan();
        return {
          safe: false,
          instantBan: true,
          reason: 'child-sexual-image',
          imageAnalysis,
          promptAnalysis: { safe: true, skipped: true },
          overallRisk: 'high',
          confidence: Math.max(0.9, imageAnalysis.confidence || 0.9)
        };
      }

      // Adult nudity etc. — do not warn/block. Mark safe so legacy UIs don't pop.
      imageAnalysis = { ...imageAnalysis, safe: true, filteredForAdultNudity: true, violations: [], suggestions: [] };
    }

    // 2) PROMPT: child-safety regex only
    const promptAnalysis = prompt ? await analyzePromptSafety(prompt) : { safe: true, skipped: true };

    // 3) Combine
    const overallSafe = (imageAnalysis?.safe !== false) && (promptAnalysis?.safe !== false);
    let overallRisk = 'low';
    const maxConfidence = Math.max(imageAnalysis.confidence || 0, promptAnalysis.confidence || 0);
    if (!overallSafe) {
      overallRisk = maxConfidence > 0.8 ? 'high' : (maxConfidence > 0.5 ? 'medium' : 'low');
    }

    return {
      safe: overallSafe,
      imageAnalysis,
      promptAnalysis,
      overallRisk,
      violations: [...(imageAnalysis.violations || []), ...(promptAnalysis.violations || [])],
      recommendations: [...new Set([...(imageAnalysis.suggestions || []), ...(promptAnalysis.suggestions || [])])],
      confidence: maxConfidence,
      toolType,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('performSafetyAnalysis error:', error);
    return {
      safe: true,
      imageAnalysis: { safe: true, analysisError: true },
      promptAnalysis: { safe: true, analysisError: true },
      overallRisk: 'unknown',
      violations: [],
      recommendations: [],
      confidence: 0,
      analysisError: true,
      errorMessage: error?.message
    };
  }
};

/* ===========================================================
   6) UI HELPERS (minimal; compatible with older UIs)
   =========================================================== */
export const getSafetyWarningMessage = (analysis) => {
  if (!analysis || analysis.safe) return null;

  const imageFlagged  = !!(analysis.imageAnalysis && analysis.imageAnalysis.safe === false && !analysis.imageAnalysis.skipped);
  const promptFlagged = !!(analysis.promptAnalysis && analysis.promptAnalysis.safe === false && !analysis.promptAnalysis.skipped);

  let title = 'Content Policy Warning';
  let message = '';
  let severity = 'warning';

  if (promptFlagged && analysis.promptAnalysis?.category === 'child-safety') {
    title = 'Possible Child-Safety Violation';
    message = 'Your prompt may include sexual context combined with references to minors. Please remove those references and keep scenarios strictly adult (18+).';
    severity = 'error';
  } else if (imageFlagged) {
    title = 'Image Content Warning';
    message = 'Your image may violate content policies.';
    severity = 'warning';
  }

  return {
    title,
    message,
    severity,
    violations: analysis.violations || [],
    recommendations: analysis.recommendations || [],
    imageFlagged,
    promptFlagged,
    riskLevel: analysis.overallRisk,
    confidence: analysis.confidence
  };
};

export const formatViolations = (violations) => {
  if (!violations || violations.length === 0) return 'No specific violations detected';
  return violations.map(v => `• ${v}`).join('\n');
};

export const formatRecommendations = (recs) => {
  if (!recs || recs.length === 0) return 'No specific recommendations available';
  return recs.map(r => `• ${r}`).join('\n');
};

// Back-compat shim for older code that imported this
export const shouldShowWarning = (analysis) => {
  if (!analysis || analysis.analysisError) return false;
  return !analysis.safe && analysis.confidence > 0.3;
};

export const logSafetyAnalysis = async (analysis, userAction = 'unknown') => {
  try {
    console.log('📊 Safety Analysis Log:', {
      version: '2025-08-17c',
      safe: analysis.safe,
      risk: analysis.overallRisk,
      violations: analysis.violations?.length || 0,
      userAction,
      toolType: analysis.toolType,
      timestamp: analysis.timestamp
    });
    // Optional: persist to DB if desired
    // await supabase.from('safety_logs').insert({ ... });
  } catch (e) {
    console.warn('Failed to log safety analysis:', e);
  }
};