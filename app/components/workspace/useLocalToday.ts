'use client';
import { useEffect, useState } from 'react';
import { localDateKey } from '../../lib/follow-ups';

export default function useLocalToday() {
  const [today, setToday] = useState('');
  useEffect(() => {
    const update = () => setToday(localDateKey(new Date()));
    update();
    const interval = window.setInterval(update, 60_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(interval); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update); };
  }, []);
  return today;
}
