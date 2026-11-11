import { startLogin } from '../../../server/live-access.js';
import { endpoint } from '../../../server/live-http.js';

export const onRequestGet = endpoint(startLogin);
