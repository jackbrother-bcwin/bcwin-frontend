export const BANK_ACCOUNT_PATTERN = /^\d{8,20}$/;
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const RECIPIENT_NAME_PATTERN = /^(?=.*\p{L})[\p{L}\p{M} .'-]+$/u;
export const UPI_ID_PATTERN =
  /^(?=.{3,50}$)[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
export const TRC20_ADDRESS_PATTERN = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
export const BEP20_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function isValidBankAccount(value: string): boolean {
  return BANK_ACCOUNT_PATTERN.test(value.trim());
}

export function isValidIfsc(value: string): boolean {
  return IFSC_PATTERN.test(value.trim().toUpperCase());
}

export function isValidRecipientName(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized.length >= 3 &&
    normalized.length <= 100 &&
    RECIPIENT_NAME_PATTERN.test(normalized)
  );
}

export function isValidUpiId(value: string): boolean {
  return UPI_ID_PATTERN.test(value.trim());
}

export function isValidTrc20Address(value: string): boolean {
  return TRC20_ADDRESS_PATTERN.test(value.trim());
}

export function isValidBep20Address(value: string): boolean {
  return BEP20_ADDRESS_PATTERN.test(value.trim());
}
