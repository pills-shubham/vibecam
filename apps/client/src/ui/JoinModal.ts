import { el } from '../util/dom.js';
import { sanitizeDisplayName, isValidDisplayName } from '@vibecam/shared';

export interface JoinSubmit {
  displayName: string;
  systemAudio: boolean;
}

/**
 * Pre-join screen: display name + system-audio option. The actual screen
 * picker is the browser's native getDisplayMedia prompt fired on submit, so we
 * make clear that "Join" will ask the user to choose a screen/window/tab.
 */
export class JoinModal {
  readonly root: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly sysAudio: HTMLInputElement;
  private readonly joinBtn: HTMLButtonElement;
  private readonly errorBox: HTMLElement;

  constructor(
    private readonly roomId: string,
    private readonly onSubmit: (data: JoinSubmit) => void,
  ) {
    this.nameInput = el('input', {
      type: 'text',
      id: 'displayName',
      class: 'field',
      'aria-label': 'Display name',
      placeholder: 'Your name',
    }) as HTMLInputElement;
    this.nameInput.maxLength = 32;
    this.nameInput.value = this.loadSavedName();

    this.sysAudio = el('input', { type: 'checkbox', id: 'systemAudio' }) as HTMLInputElement;
    this.joinBtn = el('button', { class: 'btn btn--primary', type: 'button' }, ['Join Room']) as HTMLButtonElement;
    this.errorBox = el('div', { class: 'join__error', role: 'alert' });

    this.root = this.render();
    this.bind();
  }

  private render(): HTMLElement {
    const card = el('div', { class: 'join__card' }, [
      el('div', { class: 'join__brand' }, ['🖥️ vibecam']),
      el('p', { class: 'join__room' }, [`Joining room: `, el('strong', {}, [this.roomId])]),
      el('label', { class: 'join__label', for: 'displayName' }, ['Display name']),
      this.nameInput,
      el('label', { class: 'join__checkbox' }, [
        this.sysAudio,
        el('span', {}, ['Share system audio']),
      ]),
      el('p', { class: 'join__hint' }, [
        'Microphone is on by default. After you click Join, your browser will ask which screen, window, or tab to share. Camera is never used.',
      ]),
      this.errorBox,
      this.joinBtn,
    ]);
    return el('div', { class: 'join' }, [card]);
  }

  private bind(): void {
    this.joinBtn.addEventListener('click', () => this.submit());
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submit();
    });
  }

  private submit(): void {
    const displayName = sanitizeDisplayName(this.nameInput.value);
    if (!isValidDisplayName(displayName)) {
      this.errorBox.textContent = 'Please enter a display name (1–32 characters).';
      return;
    }
    this.saveName(displayName);
    this.setBusy(true);
    this.onSubmit({ displayName, systemAudio: this.sysAudio.checked });
  }

  setBusy(busy: boolean): void {
    this.joinBtn.disabled = busy;
    this.joinBtn.textContent = busy ? 'Connecting…' : 'Join Room';
  }

  showError(message: string): void {
    this.errorBox.textContent = message;
    this.setBusy(false);
  }

  remove(): void {
    this.root.remove();
  }

  private loadSavedName(): string {
    try {
      return localStorage.getItem('vibecam:name') ?? '';
    } catch {
      return '';
    }
  }
  private saveName(name: string): void {
    try {
      localStorage.setItem('vibecam:name', name);
    } catch {
      /* ignore */
    }
  }
}
