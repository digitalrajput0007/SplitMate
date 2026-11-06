/**
 * Utility to safely parse any Firestore timestamp, ISO date string, JS Date object,
 * numeric timestamp, or fallback date into a valid JavaScript Date object.
 * Prevents "Invalid Date" errors across all components.
 */
export const parseFirestoreDate = (timestamp: any, fallbackDateStr?: string): Date => {
  if (timestamp) {
    if (typeof timestamp.toDate === 'function') {
      try {
        const d = timestamp.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch (e) {}
    }
    if (typeof timestamp.seconds === 'number' && !isNaN(timestamp.seconds)) {
      const d = new Date(timestamp.seconds * 1000);
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof timestamp === 'number' && !isNaN(timestamp)) {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof timestamp === 'string') {
      const d = new Date(timestamp);
      if (!isNaN(d.getTime())) return d;
    }
    if (timestamp instanceof Date && !isNaN(timestamp.getTime())) {
      return timestamp;
    }
  }

  if (fallbackDateStr) {
    const fallbackDate = new Date(fallbackDateStr);
    if (!isNaN(fallbackDate.getTime())) return fallbackDate;
  }

  return new Date();
};

export const formatFirestoreDate = (
  timestamp: any,
  fallbackDateStr?: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
): string => {
  const d = parseFirestoreDate(timestamp, fallbackDateStr);
  return d.toLocaleDateString('en-IN', options);
};

export const formatFirestoreDateTime = (
  timestamp: any,
  fallbackDateStr?: string,
  options?: Intl.DateTimeFormatOptions
): string => {
  const d = parseFirestoreDate(timestamp, fallbackDateStr);
  const isCurrentYear = d.getFullYear() === new Date().getFullYear();
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    ...(isCurrentYear ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  return d.toLocaleString('en-IN', options || defaultOptions);
};

/**
 * Returns current month in 'YYYY-MM' format (e.g. '2026-10').
 */
export const getCurrentBillingMonth = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Resolves the billing month 'YYYY-MM' for an expense or settlement item.
 * Fallbacks to item.date, item.createdAt, or getCurrentBillingMonth().
 */
export const getExpenseBillingMonth = (item?: {
  billingMonth?: string;
  date?: string;
  createdAt?: any;
}): string => {
  if (!item) return getCurrentBillingMonth();
  if (item.billingMonth && /^\d{4}-\d{2}$/.test(item.billingMonth)) {
    return item.billingMonth;
  }
  let d: Date | null = null;
  if (item.date) {
    const parsedDate = new Date(item.date);
    if (!isNaN(parsedDate.getTime())) {
      d = parsedDate;
    }
  }
  if (!d && item.createdAt) {
    const parsedCreated = parseFirestoreDate(item.createdAt);
    if (!isNaN(parsedCreated.getTime())) {
      d = parsedCreated;
    }
  }
  if (d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  return getCurrentBillingMonth();
};

/**
 * Formats 'YYYY-MM' into a user-friendly label (e.g., 'Oct 2026' or 'All Time').
 */
export const formatBillingMonthLabel = (ym: string): string => {
  if (!ym || ym === 'ALL') return 'All Time';
  const parts = ym.split('-');
  if (parts.length === 2) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    if (!isNaN(year) && !isNaN(month) && month >= 0 && month <= 11) {
      const date = new Date(year, month, 15);
      return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    }
  }
  return ym;
};

