import { getSession, logout } from '../../server/live-access.js';
import { endpoint } from '../../server/live-http.js';

export const onRequestGet = endpoint(getSession);
export const onRequestDelete = endpoint(logout);
