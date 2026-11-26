import { useEffect, useState } from 'react';

export function useRoute(): string[] {
  const parse = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '').split('/').filter(Boolean);
  const [parts, setParts] = useState(parse);
  useEffect(() => {
    const on = () => { setParts(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}

export const go = (path: string) => { location.hash = '#/' + path.replace(/^\//, ''); };
