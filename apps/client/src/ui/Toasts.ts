import { el } from '../util/dom.js';

type ToastKind = 'info' | 'warn' | 'error' | 'success';

/**
 * Lightweight toast stack for friendly user-facing messages (permission
 * denials, room full, disconnects, reconnects).
 */
export class Toasts {
  readonly root: HTMLElement;

  constructor() {
    this.root = el('div', { class: 'toasts', 'aria-label': 'notifications' });
  }

  show(message: string, kind: ToastKind = 'info', ttlMs = 5000): void {
    const toast = el('div', { class: `toast toast--${kind}` }, [message]);
    this.root.append(toast);
    const remove = () => {
      toast.classList.add('toast--leaving');
      setTimeout(() => toast.remove(), 250);
    };
    toast.addEventListener('click', remove);
    if (ttlMs > 0) setTimeout(remove, ttlMs);
  }

  error(message: string): void {
    this.show(message, 'error', 7000);
  }
  warn(message: string): void {
    this.show(message, 'warn', 6000);
  }
  success(message: string): void {
    this.show(message, 'success', 4000);
  }
}
