export interface KeyboardActions {
  toggleMic: () => void;
  toggleScreen: () => void;
  focusSelected: () => void;
  toggleSidebar: () => void;
  copyLink: () => void;
  exitFullscreen: () => void;
}

/**
 * Global keyboard shortcuts. Ignores keystrokes while typing in inputs so the
 * join form and any future text fields keep normal behaviour.
 *   M mute · S screen · F focus · P participants · C copy · Esc exit fullscreen
 */
export function installKeyboard(actions: KeyboardActions): () => void {
  const handler = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    switch (e.key.toLowerCase()) {
      case 'm':
        actions.toggleMic();
        break;
      case 's':
        actions.toggleScreen();
        break;
      case 'f':
        actions.focusSelected();
        break;
      case 'p':
        actions.toggleSidebar();
        break;
      case 'c':
        actions.copyLink();
        break;
      case 'escape':
        actions.exitFullscreen();
        return;
      default:
        return;
    }
    e.preventDefault();
  };

  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}
