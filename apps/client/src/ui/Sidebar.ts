import type { RoomStore, ParticipantVM } from '../state/RoomStore.js';
import { ParticipantCard } from './ParticipantCard.js';
import { el, setText } from '../util/dom.js';

/**
 * Participant sidebar. Owns one ParticipantCard per participant and keeps them
 * in sync with the store via granular events (no full re-render).
 */
export class Sidebar {
  readonly root: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly countEl: HTMLElement;
  private readonly cards = new Map<string, ParticipantCard>();

  constructor(
    private readonly store: RoomStore,
    private readonly onSelect: (id: string) => void,
  ) {
    this.countEl = el('span', { class: 'sidebar__count' }, ['0']);
    this.listEl = el('div', { class: 'sidebar__list' });
    this.root = el('aside', { class: 'sidebar' }, [
      el('div', { class: 'sidebar__header' }, [el('span', {}, ['Participants']), this.countEl]),
      this.listEl,
    ]);
    this.subscribe();
    // Seed cards for participants already present before this view subscribed.
    for (const vm of this.store.list()) this.add(vm);
  }

  private subscribe(): void {
    this.store.on('added', (vm) => this.add(vm));
    this.store.on('removed', (id) => this.removeCard(id));
    this.store.on('updated', (vm) => this.refresh(vm));
    this.store.on('layout', () => this.refreshAll());
  }

  private add(vm: ParticipantVM): void {
    const card = new ParticipantCard(vm, this.onSelect);
    this.cards.set(vm.id, card);
    this.listEl.append(card.root);
    this.updateCount();
  }

  private removeCard(id: string): void {
    this.cards.get(id)?.remove();
    this.cards.delete(id);
    this.updateCount();
  }

  private refresh(vm: ParticipantVM): void {
    this.cards.get(vm.id)?.update(vm, this.store.presenterId, vm.speaking);
  }

  private refreshAll(): void {
    for (const vm of this.store.list()) this.refresh(vm);
  }

  private updateCount(): void {
    setText(this.countEl, String(this.cards.size));
  }
}
