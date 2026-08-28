import { useEffect } from 'react';

const defaultTitle = 'Resodi — Resolva serviços digitais.';
const defaultDescription = 'Ferramentas e serviços digitais para resolver tarefas do dia a dia de forma simples, prática e online.';

function updateMeta(selector, content) {
  const meta = document.querySelector(selector);
  if (meta) meta.setAttribute('content', content);
}

export function Seo({ title, description = defaultDescription }) {
  useEffect(() => {
    const pageTitle = title ? `${title} | Resodi` : defaultTitle;

    document.title = pageTitle;
    updateMeta('meta[name="description"]', description);
    updateMeta('meta[property="og:title"]', pageTitle);
    updateMeta('meta[property="og:description"]', description);
    updateMeta('meta[name="twitter:title"]', pageTitle);
    updateMeta('meta[name="twitter:description"]', description);
  }, [title, description]);

  return null;
}
