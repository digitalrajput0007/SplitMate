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
