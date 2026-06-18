import { el, toggleClass } from '../util/dom.js';

export interface ControlsCallbacks {
  onToggleMic: () => void;
  onToggleScreen: () => void;
  onRaiseHand: () => void;
  onBecomePresenter: () => void;
  onFocusSelected: () => void;
  onLeave: () => void;
}

/**
 * Bottom control bar. Stateful buttons (mic, screen, hand) reflect current
 * status via setState* methods so the parent doesn't rebuild the bar.
 */
export class Controls {
  readonly root: HTMLElement;
  private readonly micBtn: HTMLButtonElement;
  private readonly screenBtn: HTMLButtonElement;
  private readonly handBtn: HTMLButtonElement;

  constructor(cb: ControlsCallbacks) {
    this.micBtn = this.button('🎙️ Mute', 'Mute/unmute microphone (M)', cb.onToggleMic);
    this.screenBtn = this.button('🖥️ Stop share', 'Start/stop screen share (S)', cb.onToggleScreen);
    this.handBtn = this.button('✋ Raise hand', 'Raise/lower hand', cb.onRaiseHand);
    const presentBtn = this.button('⭐ Present', 'Become presenter', cb.onBecomePresenter);
    const focusBtn = this.button('🔎 Focus', 'Focus selected user (F)', cb.onFocusSelected);
    const leaveBtn = this.button('⏻ Leave', 'Leave room', cb.onLeave);
    leaveBtn.classList.add('btn--danger');

    this.root = el('footer', { class: 'controls' }, [
      this.micBtn,
      this.screenBtn,
      this.handBtn,
      el('div', { class: 'controls__spacer' }),
      focusBtn,
      presentBtn,
      leaveBtn,
    ]);
  }

  private button(label: string, title: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', { class: 'btn ctl', type: 'button', title }, [label]) as HTMLButtonElement;
    b.addEventListener('click', onClick);
    return b;
  }

  setMic(enabled: boolean): void {
    this.micBtn.textContent = enabled ? '🎙️ Mute' : '🔇 Unmute';
    toggleClass(this.micBtn, 'ctl--off', !enabled);
  }

  setScreen(sharing: boolean): void {
    this.screenBtn.textContent = sharing ? '🖥️ Stop share' : '🖥️ Share screen';
    toggleClass(this.screenBtn, 'ctl--off', !sharing);
  }

  setHand(raised: boolean): void {
    toggleClass(this.handBtn, 'ctl--active', raised);
  }
}
