export function Seo({ title, description }) {
  document.title = title || 'Gerador Fácil';

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription && description) {
    metaDescription.setAttribute('content', description);
  }

  return null;
}
