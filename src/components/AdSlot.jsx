import { adsConfig } from '../config/ads';

export function AdSlot({ placement }) {
  const placementConfig = adsConfig.placements[placement];

  if (!adsConfig.enabled || !placementConfig?.enabled) {
    return null;
  }

  return (
    <aside className="ad-slot container" aria-label="Publicidade" data-ad-placement={placement}>
      <span>Publicidade</span>
    </aside>
  );
}
