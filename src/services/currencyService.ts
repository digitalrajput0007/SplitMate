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

export const INR_CURRENCY_CONFIG: CurrencyConfig = {
  code: 'INR',
  symbol: '₹',
  name: 'Indian Rupee',
  isIndia: true,
  countryCode: 'IN',
  paymentHandleLabel: 'UPI VPA ID (For receiving settlements)',
  paymentHandlePlaceholder: 'e.g. name@upi or 9876543210@paytm',
  paymentNote: 'Your friends will use this UPI VPA to send settlement payments directly to your bank account.'
};

export const getCurrencyConfig = (): CurrencyConfig => INR_CURRENCY_CONFIG;

export const formatCurrency = (amount: number | string, symbolOverride?: string): string => {
  const symbol = symbolOverride !== undefined ? symbolOverride : '₹';
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, '')) || 0 : amount;
  return `${symbol}${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};
