import { el } from '../util/dom.js';

export interface TopBarCallbacks {
  onCopyLink: () => void;
  onToggleSidebar: () => void;
  onToggleCompact: () => void;
}

/** Top bar: room identity + global layout toggles. */
export class TopBar {
  readonly root: HTMLElement;

  constructor(roomId: string, cb: TopBarCallbacks) {
    const copyBtn = el('button', { class: 'btn btn--ghost', type: 'button', title: 'Copy room link (C)' }, ['🔗 Copy link']);
    const sidebarBtn = el('button', { class: 'btn btn--ghost', type: 'button', title: 'Toggle participants (P)' }, ['👥']);
    const compactBtn = el('button', { class: 'btn btn--ghost', type: 'button', title: 'Toggle compact mode' }, ['▭']);

    copyBtn.addEventListener('click', cb.onCopyLink);
    sidebarBtn.addEventListener('click', cb.onToggleSidebar);
    compactBtn.addEventListener('click', cb.onToggleCompact);

    this.root = el('header', { class: 'topbar' }, [
      el('div', { class: 'topbar__brand' }, ['🖥️ vibecam']),
      el('div', { class: 'topbar__room' }, [el('span', { class: 'topbar__roomid' }, [roomId])]),
      el('div', { class: 'topbar__actions' }, [copyBtn, compactBtn, sidebarBtn]),
    ]);
  }
}
