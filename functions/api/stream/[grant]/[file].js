import { serveStream } from '../../../../server/live-hls.js';
import { endpoint } from '../../../../server/live-http.js';

export const onRequest = endpoint(serveStream);
