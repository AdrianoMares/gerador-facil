import { useEffect } from 'react';

const defaultTitle = 'Resodi — Resolva serviços digitais.';
const defaultDescription = 'Ferramentas e serviços digitais para resolver tarefas do dia a dia de forma simples, prática e online.';

function updateMeta(selector, content) {
  const meta = document.querySelector(selector);
  if (meta) meta.setAttribute('content', content);
}

function updateOrCreateMeta(name, content) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    meta.dataset.resodiSeo = 'true';
    document.head.append(meta);
  }
  meta.setAttribute('content', content);
}

function updateCanonical(canonical) {
  const selector = 'link[rel="canonical"]';
  let link = document.querySelector(selector);
  if (!canonical) {
    if (link?.dataset.resodiSeo === 'true') link.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    link.dataset.resodiSeo = 'true';
    document.head.append(link);
  }
  link.setAttribute('href', canonical);
}

export function Seo({ title, description = defaultDescription, canonical, noindex }) {
  useEffect(() => {
    const pageTitle = title ? `${title} | Resodi` : defaultTitle;

    document.title = pageTitle;
    updateMeta('meta[name="description"]', description);
    updateMeta('meta[property="og:title"]', pageTitle);
    updateMeta('meta[property="og:description"]', description);
    updateMeta('meta[name="twitter:title"]', pageTitle);
    updateMeta('meta[name="twitter:description"]', description);
    updateCanonical(canonical);
    if (typeof noindex === 'boolean') updateOrCreateMeta('robots', noindex ? 'noindex, follow' : 'index, follow');
  }, [title, description, canonical, noindex]);

  return null;
}
