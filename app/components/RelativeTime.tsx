'use client';

import * as React from 'react';

export default function RelativeTime({ timestamp }: { timestamp?: Date }) {
  const [relative, setRelative] = React.useState('');

  React.useEffect(() => {
    const update = () => {
      const now = Date.now();
      const then = timestamp ? timestamp.getTime() : now - (Math.random() * 15 * 60 * 1000);
      const diff = now - then;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      
      if (minutes < 1) setRelative('just now');
      else if (minutes < 60) setRelative(`${minutes}m ago`);
      else if (hours < 24) setRelative(`${hours}h ago`);
      else setRelative(`${Math.floor(hours / 24)}d ago`);
    };
    
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-4)' }}>{relative}</span>;
}
