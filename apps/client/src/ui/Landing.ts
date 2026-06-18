import { el } from '../util/dom.js';
import { normalizeRoomId } from '@vibecam/shared';

/**
 * Root page (no room in the URL). Lets the user create or enter a room name,
 * then navigates to /room/:id. No accounts, no codes — just a name.
 */
export function renderLanding(mount: HTMLElement): void {
  const input = el('input', {
    type: 'text',
    class: 'field',
    placeholder: 'room name (e.g. team-standup)',
    'aria-label': 'Room name',
  }) as HTMLInputElement;
  const go = el('button', { class: 'btn btn--primary', type: 'button' }, ['Create / Join']) as HTMLButtonElement;

  const enter = (): void => {
    const id = normalizeRoomId(input.value || `room-${Math.random().toString(36).slice(2, 8)}`);
    if (id) window.location.href = `/room/${id}`;
  };
  go.addEventListener('click', enter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enter();
  });

  const card = el('div', { class: 'join__card' }, [
    el('div', { class: 'join__brand' }, ['🖥️ vibecam']),
    el('p', { class: 'join__hint' }, ['Self-hosted screen-share huddles. Pick a room name to start.']),
    el('label', { class: 'join__label' }, ['Room name']),
    input,
    go,
  ]);
  mount.replaceChildren(el('div', { class: 'join' }, [card]));
}
