import './styles/main.css';
import { fetchPublicConfig } from './config.js';
import { normalizeRoomId, isValidRoomId } from '@vibecam/shared';
import { JoinModal } from './ui/JoinModal.js';
import { Toasts } from './ui/Toasts.js';
import { RoomController } from './app/RoomController.js';
import { renderLanding } from './ui/Landing.js';
import { mediaErrorMessage } from './app/errors.js';

const app = document.getElementById('app')!;
const toasts = new Toasts();
document.body.append(toasts.root);

/** Parse `/room/:id` from the path; null means the landing page. */
function parseRoomId(): string | null {
  const match = window.location.pathname.match(/^\/room\/([^/]+)\/?$/);
  if (!match) return null;
  const id = normalizeRoomId(decodeURIComponent(match[1]));
  return isValidRoomId(id) ? id : null;
}

async function bootstrap(): Promise<void> {
  const roomId = parseRoomId();
  if (!roomId) {
    renderLanding(app);
    return;
  }

  const config = await fetchPublicConfig();
  const controller = new RoomController(app, roomId, config, toasts);

  const modal = new JoinModal(roomId, async (data) => {
    try {
      await controller.join(data);
      modal.remove();
    } catch (err) {
      modal.showError(mediaErrorMessage(err));
    }
  });
  app.replaceChildren(modal.root);
}

void bootstrap();
