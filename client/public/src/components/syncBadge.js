import { getBadgeCount } from '../store/syncManager.js';

export async function updateSyncBadge(element) {
  if (!element) return;
  const count = await getBadgeCount();
  element.textContent = `${count} en attente`;
  element.className = `badge ${count ? 'badge-pending' : 'badge-synced'}`;
}

