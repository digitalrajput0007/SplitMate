import * as Localization from 'expo-localization';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  isIndia: boolean;
  countryCode: string;
  paymentHandleLabel: string;
  paymentHandlePlaceholder: string;
  paymentNote: string;
}

const COUNTRY_CURRENCY_MAP: Record<string, { code: string; symbol: string; name: string }> = {
  IN: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  US: { code: 'USD', symbol: '$', name: 'US Dollar' },
  GB: { code: 'GBP', symbol: '£', name: 'British Pound' },
  CA: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  AU: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  DE: { code: 'EUR', symbol: '€', name: 'Euro' },
  FR: { code: 'EUR', symbol: '€', name: 'Euro' },
  ES: { code: 'EUR', symbol: '€', name: 'Euro' },
  IT: { code: 'EUR', symbol: '€', name: 'Euro' },
  NL: { code: 'EUR', symbol: '€', name: 'Euro' },
  SG: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  AE: { code: 'AED', symbol: 'AED ', name: 'UAE Dirham' },
  JP: { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
};

export const CURRENCIES: CurrencyConfig[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', isIndia: true, countryCode: 'IN', paymentHandleLabel: 'UPI ID', paymentHandlePlaceholder: 'name@upi', paymentNote: 'Used for direct 1-click UPI settle ups' },
  { code: 'USD', symbol: '$', name: 'US Dollar', isIndia: false, countryCode: 'US', paymentHandleLabel: 'Venmo / Zelle / PayPal', paymentHandlePlaceholder: '@username or email', paymentNote: 'Used for sharing payment handle' },
  { code: 'EUR', symbol: '€', name: 'Euro', isIndia: false, countryCode: 'DE', paymentHandleLabel: 'IBAN / Revolut', paymentHandlePlaceholder: 'DE89...', paymentNote: 'Used for SEPA/Revolut transfers' },
  { code: 'GBP', symbol: '£', name: 'British Pound', isIndia: false, countryCode: 'GB', paymentHandleLabel: 'Sort Code & Account / Monzo', paymentHandlePlaceholder: '@tag or 12-34-56', paymentNote: 'Used for UK bank transfers' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', isIndia: false, countryCode: 'CA', paymentHandleLabel: 'Interac e-Transfer Email', paymentHandlePlaceholder: 'user@email.com', paymentNote: 'Used for Interac transfers' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', isIndia: false, countryCode: 'AU', paymentHandleLabel: 'PayID / Osko', paymentHandlePlaceholder: 'phone or email', paymentNote: 'Used for PayID transfers' },
  { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', isIndia: false, countryCode: 'AE', paymentHandleLabel: 'IBAN / Mobile', paymentHandlePlaceholder: 'AE...', paymentNote: 'Used for UAE bank transfers' },
];

let activeUserCurrencyCode: string | null = null;

export const resetActiveUserCurrency = () => {
  activeUserCurrencyCode = null;
};

export const setActiveUserCurrency = (code: string) => {
  activeUserCurrencyCode = code;
};

export const getCurrencyConfig = (codeOverride?: string): CurrencyConfig => {
  const targetCode = codeOverride || activeUserCurrencyCode;

  if (targetCode) {
    const found = CURRENCIES.find((c) => c.code === targetCode);
    if (found) return found;
  }

  try {
    const locales = typeof Localization?.getLocales === 'function' ? Localization.getLocales() : null;
    const primaryLocale = locales && locales.length > 0 ? locales[0] : null;
    const countryCode = (primaryLocale?.regionCode || (primaryLocale as any)?.countryCode || 'US').toUpperCase();
    const isIndia = countryCode === 'IN';

    const mapped = COUNTRY_CURRENCY_MAP[countryCode] || {
      code: primaryLocale?.currencyCode || 'USD',
      symbol: primaryLocale?.currencySymbol || '$',
      name: 'US Dollar',
    };

    return {
      code: mapped.code,
      symbol: mapped.symbol,
      name: mapped.name,
      isIndia: isIndia,
      countryCode: countryCode,
      paymentHandleLabel: isIndia 
        ? 'UPI VPA ID (For receiving settlements)' 
        : 'Payment Handle / Email (PayPal, Zelle, Venmo, IBAN)',
      paymentHandlePlaceholder: isIndia 
        ? 'e.g. name@upi or 9876543210@paytm' 
        : 'e.g. user@paypal.me, $cashtag, or IBAN',
      paymentNote: isIndia
        ? 'Your friends will use this UPI VPA to send settlement payments directly to your bank account.'
        : 'Your friends will use this payment handle or account details to transfer settlement payments.'
    };
  } catch (e) {
    return CURRENCIES[1]; // Fallback USD
  }
};

export const formatCurrency = (amount: number | string, symbolOverride?: string): string => {
  const symbol = symbolOverride || getCurrencyConfig().symbol;
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, '')) || 0 : amount;
  return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};
