import { useEffect, useState } from 'react';

export default function useSessionState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved === null ? initialValue : JSON.parse(saved);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(value)); }
    catch { /* Session storage may be unavailable in restricted browsers. */ }
  }, [key, value]);

  return [value, setValue];
}
