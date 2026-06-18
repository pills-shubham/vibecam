import type { ParticipantVM } from '../state/RoomStore.js';
import { el, setText, toggleClass } from '../util/dom.js';

export interface TileCallbacks {
  onFocus: (id: string) => void;
  onFullscreen: (id: string) => void;
}

/**
 * A video tile on the main stage. Renders the peer's screen share (or a
 * placeholder when not sharing), the speaking border, name, and status badges.
 * Single click -> focus, double click -> fullscreen.
 */
export class ParticipantTile {
  readonly root: HTMLElement;
  private readonly video: HTMLVideoElement;
  private readonly placeholder: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly badges: HTMLElement;
  private boundStream: MediaStream | null = null;

  constructor(
    public vm: ParticipantVM,
    private readonly cb: TileCallbacks,
  ) {
    this.video = el('video', { class: 'tile__video', autoplay: 'true', playsinline: 'true' }) as HTMLVideoElement;
    this.video.muted = vm.isSelf; // never echo our own mic
    this.placeholder = el('div', { class: 'tile__placeholder' }, [this.initials(vm.displayName)]);
    this.nameEl = el('span', { class: 'tile__name' }, [vm.displayName]);
    this.badges = el('div', { class: 'tile__badges' });

    this.root = el('div', { class: 'tile', 'data-peer': vm.id }, [
      this.video,
      this.placeholder,
      el('div', { class: 'tile__overlay' }, [this.nameEl, this.badges]),
    ]);
    this.bind();
    this.update(vm);
  }

  private bind(): void {
    let clickTimer: ReturnType<typeof setTimeout> | null = null;
    this.root.addEventListener('click', () => {
      if (clickTimer) return;
      clickTimer = setTimeout(() => {
        clickTimer = null;
        this.cb.onFocus(this.vm.id);
      }, 220);
    });
    this.root.addEventListener('dblclick', () => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      this.cb.onFullscreen(this.vm.id);
    });
  }

  update(vm: ParticipantVM): void {
    this.vm = vm;
    setText(this.nameEl, vm.displayName + (vm.isSelf ? ' (you)' : ''));

    if (vm.stream && this.boundStream !== vm.stream) {
      this.video.srcObject = vm.stream;
      this.boundStream = vm.stream;
      void this.video.play().catch(() => undefined);
    }
    const sharing = vm.streamState.screenSharing && !!vm.stream && vm.stream.getVideoTracks().length > 0;
    toggleClass(this.root, 'tile--sharing', sharing);
    toggleClass(this.placeholder, 'hidden', sharing);
    toggleClass(this.video, 'hidden', !sharing);
    toggleClass(this.root, 'tile--speaking', vm.speaking && vm.streamState.micEnabled);

    this.renderBadges(vm);
  }

  private renderBadges(vm: ParticipantVM): void {
    const items: string[] = [];
    items.push(vm.streamState.micEnabled ? '🎙️' : '🔇');
    if (vm.streamState.screenSharing) items.push('🖥️');
    if (vm.streamState.handRaised) items.push('✋');
    if (vm.id === this.presenterId) items.push('⭐');
    this.badges.textContent = items.join(' ');
  }

  private presenterId: string | null = null;
  setPresenter(presenterId: string | null): void {
    this.presenterId = presenterId;
    toggleClass(this.root, 'tile--presenter', presenterId === this.vm.id);
    this.renderBadges(this.vm);
  }

  async requestFullscreen(): Promise<void> {
    try {
      await this.root.requestFullscreen();
    } catch {
      /* user denied / unsupported */
    }
  }

  private initials(name: string): string {
    return name
      .split(' ')
      .map((w) => w[0]?.toUpperCase() ?? '')
      .slice(0, 2)
      .join('');
  }

  remove(): void {
    this.video.srcObject = null;
    this.root.remove();
  }
}
