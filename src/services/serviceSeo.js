export function buildServiceStructuredData({ service, canonical, faqItems, provider, purchaseEnabled }) {
  const hasPrice = Number.isInteger(service.priceCents) && service.priceCents > 0;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: service.name,
        description: service.seo.description,
        url: canonical,
        provider: {
          '@type': 'Organization',
          name: provider.brand,
          url: provider.domain
        },
        areaServed: {
          '@type': 'Country',
          name: 'Brasil'
        },
        ...(purchaseEnabled && hasPrice ? {
          offers: {
            '@type': 'Offer',
            priceCurrency: 'BRL',
            price: (service.priceCents / 100).toFixed(2),
            availability: 'https://schema.org/InStock',
            url: canonical
          }
        } : {})
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqItems.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: answer
          }
        }))
      }
    ]
  };
}
