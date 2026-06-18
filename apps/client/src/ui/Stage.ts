import type { RoomStore, ParticipantVM } from '../state/RoomStore.js';
import { ParticipantTile } from './ParticipantTile.js';
import { el, toggleClass } from '../util/dom.js';

export interface StageCallbacks {
  onFocus: (id: string) => void;
  onFullscreen: (id: string) => void;
}

/**
 * Main content area. Renders one ParticipantTile per participant and switches
 * between grid and focus layouts. In focus mode the focused tile fills the main
 * region and the rest collapse into a filmstrip.
 */
export class Stage {
  readonly root: HTMLElement;
  private readonly mainEl: HTMLElement;
  private readonly stripEl: HTMLElement;
  private readonly tiles = new Map<string, ParticipantTile>();

  constructor(
    private readonly store: RoomStore,
    private readonly cb: StageCallbacks,
  ) {
    this.mainEl = el('div', { class: 'stage__main' });
    this.stripEl = el('div', { class: 'stage__strip' });
    this.root = el('main', { class: 'stage' }, [this.mainEl, this.stripEl]);
    this.subscribe();
    // Render participants that already exist in the store (self + peers added
    // before this view subscribed) so join order can't drop tiles.
    for (const vm of this.store.list()) this.add(vm);
  }

  private subscribe(): void {
    this.store.on('added', (vm) => this.add(vm));
    this.store.on('removed', (id) => this.removeTile(id));
    this.store.on('updated', (vm) => this.tiles.get(vm.id)?.update(vm));
    this.store.on('layout', () => this.relayout());
  }

  getTile(id: string): ParticipantTile | undefined {
    return this.tiles.get(id);
  }

  private add(vm: ParticipantVM): void {
    const tile = new ParticipantTile(vm, this.cb);
    tile.setPresenter(this.store.presenterId);
    this.tiles.set(vm.id, tile);
    this.relayout();
  }

  private removeTile(id: string): void {
    this.tiles.get(id)?.remove();
    this.tiles.delete(id);
    this.relayout();
  }

  /** Re-place tiles into main/strip according to layout + compact flags. */
  private relayout(): void {
    const focusMode = this.store.layout === 'focus' && !!this.store.focusedId;
    toggleClass(this.root, 'stage--focus', focusMode);
    toggleClass(this.root, 'stage--grid', !focusMode);
    toggleClass(this.root, 'stage--compact', this.store.compact);

    for (const tile of this.tiles.values()) tile.setPresenter(this.store.presenterId);

    const ordered = this.store.list();
    if (focusMode) {
      const focusId = this.store.focusedId;
      for (const vm of ordered) {
        const tile = this.tiles.get(vm.id);
        if (!tile) continue;
        const parent = vm.id === focusId ? this.mainEl : this.stripEl;
        if (tile.root.parentElement !== parent) parent.append(tile.root);
      }
      toggleClass(this.stripEl, 'hidden', false);
    } else {
      for (const vm of ordered) {
        const tile = this.tiles.get(vm.id);
        if (tile && tile.root.parentElement !== this.mainEl) this.mainEl.append(tile.root);
      }
      toggleClass(this.stripEl, 'hidden', true);
    }
    this.applyGridColumns(ordered.length, focusMode);
  }

  private applyGridColumns(count: number, focusMode: boolean): void {
    if (focusMode) {
      this.mainEl.style.gridTemplateColumns = '1fr';
      return;
    }
    const cols = count <= 1 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4;
    this.mainEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  }
}
