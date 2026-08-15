/**
 * Country dialing codes — keep in sync with backend countryPhone.ts.
 *
 * - SMS_OTP: only 91 / 92 / 880 (Laaffic)
 * - ALL (register email path): major markets — phone is storage only, OTP via email
 */

export type CountryOption = {
  code: string;
  iso: string;
  name: string;
  flag: string;
  minLen: number;
  maxLen: number;
  placeholder: string;
  smsOtp?: boolean;
};

export type CountryCode = string;

/** SMS OTP allowlist */
export const SMS_OTP_COUNTRY_CODES = ["91", "92", "880"] as const;

const ALL_COUNTRIES: CountryOption[] = [
  {
    code: "91",
    iso: "IN",
    name: "India",
    flag: "🇮🇳",
    minLen: 10,
    maxLen: 10,
    placeholder: "10-digit mobile",
    smsOtp: true,
  },
  {
    code: "92",
    iso: "PK",
    name: "Pakistan",
    flag: "🇵🇰",
    minLen: 10,
    maxLen: 10,
    placeholder: "3XXXXXXXXX",
    smsOtp: true,
  },
  {
    code: "880",
    iso: "BD",
    name: "Bangladesh",
    flag: "🇧🇩",
    minLen: 10,
    maxLen: 10,
    placeholder: "1XXXXXXXXX",
    smsOtp: true,
  },
  {
    code: "1",
    iso: "US",
    name: "United States / Canada",
    flag: "🇺🇸",
    minLen: 10,
    maxLen: 10,
    placeholder: "10-digit number",
  },
  {
    code: "44",
    iso: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    minLen: 10,
    maxLen: 10,
    placeholder: "7XXXXXXXXX",
  },
  {
    code: "971",
    iso: "AE",
    name: "United Arab Emirates",
    flag: "🇦🇪",
    minLen: 9,
    maxLen: 9,
    placeholder: "5XXXXXXXX",
  },
  {
    code: "966",
    iso: "SA",
    name: "Saudi Arabia",
    flag: "🇸🇦",
    minLen: 9,
    maxLen: 9,
    placeholder: "5XXXXXXXX",
  },
  {
    code: "974",
    iso: "QA",
    name: "Qatar",
    flag: "🇶🇦",
    minLen: 8,
    maxLen: 8,
    placeholder: "8 digits",
  },
  {
    code: "965",
    iso: "KW",
    name: "Kuwait",
    flag: "🇰🇼",
    minLen: 8,
    maxLen: 8,
    placeholder: "8 digits",
  },
  {
    code: "973",
    iso: "BH",
    name: "Bahrain",
    flag: "🇧🇭",
    minLen: 8,
    maxLen: 8,
    placeholder: "8 digits",
  },
  {
    code: "968",
    iso: "OM",
    name: "Oman",
    flag: "🇴🇲",
    minLen: 8,
    maxLen: 8,
    placeholder: "8 digits",
  },
  {
    code: "961",
    iso: "LB",
    name: "Lebanon",
    flag: "🇱🇧",
    minLen: 7,
    maxLen: 8,
    placeholder: "7–8 digits",
  },
  {
    code: "20",
    iso: "EG",
    name: "Egypt",
    flag: "🇪🇬",
    minLen: 10,
    maxLen: 10,
    placeholder: "10 digits",
  },
  {
    code: "234",
    iso: "NG",
    name: "Nigeria",
    flag: "🇳🇬",
    minLen: 10,
    maxLen: 10,
    placeholder: "10 digits",
  },
  {
    code: "254",
    iso: "KE",
    name: "Kenya",
    flag: "🇰🇪",
    minLen: 9,
    maxLen: 9,
    placeholder: "7XXXXXXXX",
  },
  {
    code: "27",
    iso: "ZA",
    name: "South Africa",
    flag: "🇿🇦",
    minLen: 9,
    maxLen: 9,
    placeholder: "9 digits",
  },
  {
    code: "65",
    iso: "SG",
    name: "Singapore",
    flag: "🇸🇬",
    minLen: 8,
    maxLen: 8,
    placeholder: "8 digits",
  },
  {
    code: "60",
    iso: "MY",
    name: "Malaysia",
    flag: "🇲🇾",
    minLen: 9,
    maxLen: 10,
    placeholder: "9–10 digits",
  },
  {
    code: "62",
    iso: "ID",
    name: "Indonesia",
    flag: "🇮🇩",
    minLen: 9,
    maxLen: 12,
    placeholder: "9–12 digits",
  },
  {
    code: "63",
    iso: "PH",
    name: "Philippines",
    flag: "🇵🇭",
    minLen: 10,
    maxLen: 10,
    placeholder: "9XXXXXXXXX",
  },
  {
    code: "66",
    iso: "TH",
    name: "Thailand",
    flag: "🇹🇭",
    minLen: 9,
    maxLen: 9,
    placeholder: "9 digits",
  },
  {
    code: "84",
    iso: "VN",
    name: "Vietnam",
    flag: "🇻🇳",
    minLen: 9,
    maxLen: 10,
    placeholder: "9–10 digits",
  },
  {
    code: "86",
    iso: "CN",
    name: "China",
    flag: "🇨🇳",
    minLen: 11,
    maxLen: 11,
    placeholder: "11 digits",
  },
  {
    code: "81",
    iso: "JP",
    name: "Japan",
    flag: "🇯🇵",
    minLen: 10,
    maxLen: 11,
    placeholder: "10–11 digits",
  },
  {
    code: "82",
    iso: "KR",
    name: "South Korea",
    flag: "🇰🇷",
    minLen: 9,
    maxLen: 11,
    placeholder: "9–11 digits",
  },
  {
    code: "61",
    iso: "AU",
    name: "Australia",
    flag: "🇦🇺",
    minLen: 9,
    maxLen: 9,
    placeholder: "9 digits",
  },
  {
    code: "64",
    iso: "NZ",
    name: "New Zealand",
    flag: "🇳🇿",
    minLen: 8,
    maxLen: 10,
    placeholder: "8–10 digits",
  },
  {
    code: "49",
    iso: "DE",
    name: "Germany",
    flag: "🇩🇪",
    minLen: 10,
    maxLen: 11,
    placeholder: "10–11 digits",
  },
  {
    code: "33",
    iso: "FR",
    name: "France",
    flag: "🇫🇷",
    minLen: 9,
    maxLen: 9,
    placeholder: "9 digits",
  },
  {
    code: "39",
    iso: "IT",
    name: "Italy",
    flag: "🇮🇹",
    minLen: 9,
    maxLen: 10,
    placeholder: "9–10 digits",
  },
  {
    code: "34",
    iso: "ES",
    name: "Spain",
    flag: "🇪🇸",
    minLen: 9,
    maxLen: 9,
    placeholder: "9 digits",
  },
  {
    code: "31",
    iso: "NL",
    name: "Netherlands",
    flag: "🇳🇱",
    minLen: 9,
    maxLen: 9,
    placeholder: "9 digits",
  },
  {
    code: "7",
    iso: "RU",
    name: "Russia",
    flag: "🇷🇺",
    minLen: 10,
    maxLen: 10,
    placeholder: "10 digits",
  },
  {
    code: "90",
    iso: "TR",
    name: "Turkey",
    flag: "🇹🇷",
    minLen: 10,
    maxLen: 10,
    placeholder: "10 digits",
  },
  {
    code: "55",
    iso: "BR",
    name: "Brazil",
    flag: "🇧🇷",
    minLen: 10,
    maxLen: 11,
    placeholder: "10–11 digits",
  },
  {
    code: "52",
    iso: "MX",
    name: "Mexico",
    flag: "🇲🇽",
    minLen: 10,
    maxLen: 10,
    placeholder: "10 digits",
  },
  {
    code: "977",
    iso: "NP",
    name: "Nepal",
    flag: "🇳🇵",
    minLen: 10,
    maxLen: 10,
    placeholder: "10 digits",
  },
  {
    code: "94",
    iso: "LK",
    name: "Sri Lanka",
    flag: "🇱🇰",
    minLen: 9,
    maxLen: 9,
    placeholder: "7XXXXXXXX",
  },
  {
    code: "95",
    iso: "MM",
    name: "Myanmar",
    flag: "🇲🇲",
    minLen: 8,
    maxLen: 10,
    placeholder: "8–10 digits",
  },
  {
    code: "855",
    iso: "KH",
    name: "Cambodia",
    flag: "🇰🇭",
    minLen: 8,
    maxLen: 9,
    placeholder: "8–9 digits",
  },
  {
    code: "856",
    iso: "LA",
    name: "Laos",
    flag: "🇱🇦",
    minLen: 8,
    maxLen: 10,
    placeholder: "8–10 digits",
  },
];

/** Full list (email-register phone picker) */
export const COUNTRY_OPTIONS_ALL: CountryOption[] = ALL_COUNTRIES;

/** SMS-only list (phone OTP register / login / forgot) */
export const COUNTRY_OPTIONS_SMS: CountryOption[] = ALL_COUNTRIES.filter(
  (c) => c.smsOtp
);

/** @deprecated use COUNTRY_OPTIONS_SMS or COUNTRY_OPTIONS_ALL */
export const COUNTRY_OPTIONS = COUNTRY_OPTIONS_SMS;

export const SUPPORTED_COUNTRY_CODES = ALL_COUNTRIES.map((c) => c.code);

export function getCountryOption(code: string): CountryOption {
  const d = String(code ?? "").replace(/\D/g, "");
  return (
    ALL_COUNTRIES.find((c) => c.code === d) ??
    COUNTRY_OPTIONS_SMS[0]!
  );
}

export function isCountryCode(v: string): boolean {
  return ALL_COUNTRIES.some((c) => c.code === String(v).replace(/\D/g, ""));
}

export function isSmsOtpCountryCode(v: string): boolean {
  return (SMS_OTP_COUNTRY_CODES as readonly string[]).includes(
    String(v).replace(/\D/g, "")
  );
}

export function normalizeCountryCode(v: string): string {
  const d = String(v ?? "").replace(/\D/g, "");
  return isCountryCode(d) ? d : "91";
}

/**
 * Split stored user mobile (E.164 or legacy bare national) for OTP API.
 * Longer country codes checked first.
 *
 * ⚠️ Do NOT use this for SMS OTP send — it can return non-SMS countries (1, 44, 971…).
 * Backend GET /otp only allows 91 | 92 | 880. Use `parseStoredMobileForSmsOtp` for bank/forgot SMS.
 */
export function parseStoredMobile(stored: string): {
  countryCode: string;
  mobileNumber: string;
} {
  const d = String(stored ?? "").replace(/\D/g, "");
  const ordered = [...SUPPORTED_COUNTRY_CODES].sort(
    (a, b) => b.length - a.length
  );
  for (const code of ordered) {
    if (d.startsWith(code) && d.length > code.length) {
      return { countryCode: code, mobileNumber: d.slice(code.length) };
    }
  }
  return { countryCode: "91", mobileNumber: d };
}

/**
 * Parse stored mobile for **SMS OTP only** (Laaffic: 91 | 92 | 880).
 * - E.164: 9198… → { 91, 98… }
 * - Legacy bare 10-digit India: 9876… → { 91, 9876… }
 * - Returns null if number is not an SMS-capable country (caller should use email OTP).
 */
export function parseStoredMobileForSmsOtp(stored: string): {
  countryCode: (typeof SMS_OTP_COUNTRY_CODES)[number];
  mobileNumber: string;
} | null {
  const d = String(stored ?? "").replace(/\D/g, "");
  if (!d) return null;

  const ordered = [...SMS_OTP_COUNTRY_CODES].sort(
    (a, b) => b.length - a.length
  ) as Array<(typeof SMS_OTP_COUNTRY_CODES)[number]>;

  for (const code of ordered) {
    if (d.startsWith(code) && d.length > code.length) {
      const national = d.slice(code.length);
      if (national.length >= 8 && national.length <= 12) {
        return { countryCode: code, mobileNumber: national };
      }
    }
  }

  // Legacy bare national India (and common 10-digit stored without CC)
  if (d.length === 10 && /^[6-9]/.test(d)) {
    return { countryCode: "91", mobileNumber: d };
  }
  // Leading 0 national (0XXXXXXXXX)
  if (d.length === 11 && d.startsWith("0") && /^[6-9]/.test(d.slice(1))) {
    return { countryCode: "91", mobileNumber: d.slice(1) };
  }

  return null;
}
