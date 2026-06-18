import type { ConnectionQuality } from '@vibecam/types';

/** Map quality bucket -> short label + icon + css modifier for badges. */
export function qualityMeta(q: ConnectionQuality): { label: string; icon: string; mod: string } {
  switch (q) {
    case 'excellent':
      return { label: 'Excellent', icon: '▮▮▮', mod: 'excellent' };
    case 'good':
      return { label: 'Good', icon: '▮▮▯', mod: 'good' };
    case 'poor':
      return { label: 'Poor', icon: '▮▯▯', mod: 'poor' };
    case 'disconnected':
    default:
      return { label: 'Disconnected', icon: '▯▯▯', mod: 'disconnected' };
  }
}
