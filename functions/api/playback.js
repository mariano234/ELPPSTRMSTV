import { createPlayback, endPlayback } from '../../server/live-playback.js';
import { endpoint } from '../../server/live-http.js';

export const onRequestPost = endpoint(createPlayback);
export const onRequestDelete = endpoint(endPlayback);
