import { env } from '../config/env.config.js';

const base = env.MIDA_DASHBOARD_URL.replace(/\/+$/, '');

// TODO: xác nhận path thật của dashboard Mida (recordings/heatmaps/visitors).
export const replayLink = (sessionId) => `${base}/recordings?session=${sessionId}`;
export const heatmapLink = (pageId) => `${base}/heatmaps?page=${pageId}`;
export const visitorLink = (visitorId) => `${base}/visitors/${visitorId}`;

export const mdLink = (label, url) => `[${label}](${url})`;
