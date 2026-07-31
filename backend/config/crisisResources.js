/**
 * Crisis support contacts surfaced when a user's message indicates risk.
 *
 * A stale number is worse than none, so this file carries an explicit
 * verification date and a test fails once it is older than MAX_AGE_DAYS.
 * Re-check each number against its operator, then update VERIFIED_ON.
 *
 * `region` matches the country segment of the Accept-Language header or an
 * explicit user setting, falling back to INTERNATIONAL.
 */

/** Date the numbers below were last checked against their operators. */
export const VERIFIED_ON = "2026-07-30";

/** Beyond this the registry is treated as unverified and CI fails. */
export const MAX_AGE_DAYS = 180;

export const verificationAgeDays = (now = new Date()) =>
  Math.floor((now - new Date(VERIFIED_ON)) / (24 * 60 * 60 * 1000));

export const isVerificationStale = (now = new Date()) =>
  verificationAgeDays(now) > MAX_AGE_DAYS;

const INTERNATIONAL = [
  {
    name: "Find A Helpline",
    contact: "findahelpline.com",
    url: "https://findahelpline.com",
    description: "Free, confidential support lines in over 130 countries",
    available: "Varies by country",
  },
];

export const CRISIS_RESOURCES = {
  IN: [
    {
      name: "Tele-MANAS",
      contact: "14416",
      url: "tel:14416",
      description: "India's national mental health helpline (Govt. of India)",
      available: "24/7, toll-free, 20+ languages",
    },
    {
      name: "KIRAN Mental Health Helpline",
      contact: "1800-599-0019",
      url: "tel:18005990019",
      description: "Ministry of Social Justice & Empowerment",
      available: "24/7, toll-free",
    },
    {
      name: "AASRA",
      contact: "+91 98204 66726",
      url: "tel:+919820466726",
      description: "Suicide prevention and emotional support",
      available: "24/7",
    },
  ],

  US: [
    {
      name: "988 Suicide & Crisis Lifeline",
      contact: "988",
      url: "tel:988",
      description: "Call or text 988",
      available: "24/7",
    },
    {
      name: "Crisis Text Line",
      contact: "Text HOME to 741741",
      url: "sms:741741",
      description: "Free crisis counselling over text",
      available: "24/7",
    },
  ],

  GB: [
    {
      name: "Samaritans",
      contact: "116 123",
      url: "tel:116123",
      description: "Free, confidential listening service",
      available: "24/7",
    },
  ],

  INTERNATIONAL,
};

export const getCrisisResources = (region) =>
  CRISIS_RESOURCES[region?.toUpperCase()] ?? CRISIS_RESOURCES.INTERNATIONAL;

/** Always shown alongside region-specific lines. */
export const EMERGENCY_NOTICE =
  "If you are in immediate danger, please contact your local emergency services.";
