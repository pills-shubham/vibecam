import type { ParticipantVM } from '../state/RoomStore.js';
import { el, setText, toggleClass } from '../util/dom.js';
import { qualityMeta } from './qualityLabel.js';

/**
 * Sidebar row for one participant. Shows name, mic/speaking/screen/presenter/
 * hand status and a connection-quality indicator. Click selects (focus).
 */
export class ParticipantCard {
  readonly root: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly micEl: HTMLElement;
  private readonly screenEl: HTMLElement;
  private readonly handEl: HTMLElement;
  private readonly presenterEl: HTMLElement;
  private readonly qualityEl: HTMLElement;

  constructor(
    public vm: ParticipantVM,
    private readonly onSelect: (id: string) => void,
  ) {
    this.nameEl = el('span', { class: 'card__name' }, [vm.displayName]);
    this.micEl = el('span', { class: 'card__icon', title: 'Microphone' });
    this.screenEl = el('span', { class: 'card__icon', title: 'Screen sharing' });
    this.handEl = el('span', { class: 'card__icon', title: 'Hand raised' }, ['✋']);
    this.presenterEl = el('span', { class: 'card__badge', title: 'Presenter' }, ['Presenter']);
    this.qualityEl = el('span', { class: 'card__quality', title: 'Connection quality' });

    this.root = el('div', { class: 'card', 'data-peer': vm.id }, [
      el('span', { class: 'card__avatar' }, [this.initials(vm.displayName)]),
      el('div', { class: 'card__main' }, [
        el('div', { class: 'card__row' }, [this.nameEl, this.presenterEl]),
        el('div', { class: 'card__status' }, [this.micEl, this.screenEl, this.handEl, this.qualityEl]),
      ]),
    ]);
    this.root.addEventListener('click', () => this.onSelect(vm.id));
    this.update(vm, null, false);
  }

  update(vm: ParticipantVM, presenterId: string | null, speaking: boolean): void {
    this.vm = vm;
    setText(this.nameEl, vm.displayName + (vm.isSelf ? ' (you)' : ''));
    setText(this.micEl, vm.streamState.micEnabled ? '🎙️' : '🔇');
    setText(this.screenEl, vm.streamState.screenSharing ? '🖥️' : '');
    toggleClass(this.handEl, 'hidden', !vm.streamState.handRaised);
    toggleClass(this.presenterEl, 'hidden', presenterId !== vm.id);
    toggleClass(this.root, 'card--speaking', speaking && vm.streamState.micEnabled);

    const q = qualityMeta(vm.quality);
    setText(this.qualityEl, q.icon);
    this.qualityEl.className = `card__quality card__quality--${q.mod}`;
    this.qualityEl.title = `Connection: ${q.label}`;
  }

  private initials(name: string): string {
    return name
      .split(' ')
      .map((w) => w[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('');
  }

  remove(): void {
    this.root.remove();
  }
}
