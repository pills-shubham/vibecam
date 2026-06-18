import type { RoomStore } from '../state/RoomStore.js';
import { TopBar } from './TopBar.js';
import { Stage } from './Stage.js';
import { Sidebar } from './Sidebar.js';
import { Controls } from './Controls.js';
import { installKeyboard } from './Keyboard.js';
import { el, toggleClass } from '../util/dom.js';

/** Callback surface the controller wires its business logic into. */
export interface RoomViewActions {
  toggleMic: () => void;
  toggleScreen: () => void;
  raiseHand: () => void;
  becomePresenter: () => void;
  leave: () => void;
  copyLink: () => void;
  focusPeer: (id: string) => void;
  fullscreenPeer: (id: string) => void;
}

/**
 * Assembles the room layout (top bar / stage / sidebar / controls), owns local
 * UI state (selection, sidebar/compact toggles, keyboard) and forwards intents
 * to the controller. Holds no networking/media logic itself.
 */
export class RoomView {
  readonly root: HTMLElement;
  readonly controls: Controls;
  readonly stage: Stage;
  private readonly sidebar: Sidebar;
  private selectedId: string | null = null;
  private removeKeyboard: () => void = () => undefined;

  constructor(
    roomId: string,
    private readonly store: RoomStore,
    private readonly actions: RoomViewActions,
  ) {
    const topbar = new TopBar(roomId, {
      onCopyLink: () => this.actions.copyLink(),
      onToggleSidebar: () => this.store.toggleSidebar(),
      onToggleCompact: () => this.store.setCompact(!this.store.compact),
    });
    this.stage = new Stage(this.store, {
      onFocus: (id) => this.onTileFocus(id),
      onFullscreen: (id) => this.actions.fullscreenPeer(id),
    });
    this.sidebar = new Sidebar(this.store, (id) => this.select(id));
    this.controls = new Controls({
      onToggleMic: () => this.actions.toggleMic(),
      onToggleScreen: () => this.actions.toggleScreen(),
      onRaiseHand: () => this.actions.raiseHand(),
      onBecomePresenter: () => this.actions.becomePresenter(),
      onFocusSelected: () => this.focusSelected(),
      onLeave: () => this.actions.leave(),
    });

    const body = el('div', { class: 'room__body' }, [this.stage.root, this.sidebar.root]);
    this.root = el('div', { class: 'room' }, [topbar.root, body, this.controls.root]);

    this.store.on('layout', () => this.applyLayout());
    this.installShortcuts();
    this.applyLayout();
  }

  private installShortcuts(): void {
    this.removeKeyboard = installKeyboard({
      toggleMic: () => this.actions.toggleMic(),
      toggleScreen: () => this.actions.toggleScreen(),
      focusSelected: () => this.focusSelected(),
      toggleSidebar: () => this.store.toggleSidebar(),
      copyLink: () => this.actions.copyLink(),
      exitFullscreen: () => {
        if (document.fullscreenElement) void document.exitFullscreen();
      },
    });
  }

  private onTileFocus(id: string): void {
    this.select(id);
    this.actions.focusPeer(id);
  }

  private select(id: string): void {
    this.selectedId = id;
    for (const card of this.root.querySelectorAll('.card')) {
      toggleClass(card, 'card--selected', card.getAttribute('data-peer') === id);
    }
  }

  private focusSelected(): void {
    const id = this.selectedId ?? this.firstRemote() ?? this.store.selfId;
    this.actions.focusPeer(id);
  }

  private firstRemote(): string | null {
    return this.store.list().find((p) => !p.isSelf)?.id ?? null;
  }

  private applyLayout(): void {
    toggleClass(this.root, 'room--no-sidebar', !this.store.sidebarVisible);
    toggleClass(this.root, 'room--compact', this.store.compact);
  }

  dispose(): void {
    this.removeKeyboard();
    this.root.remove();
  }
}
