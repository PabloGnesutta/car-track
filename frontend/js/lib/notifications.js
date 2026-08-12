import { _error } from "./logger.js";
import { formatRemindersBanner } from "./maintenanceStatus.js";

/**
 * @typedef {{ name: string, overdue: number, dueSoon: number }} VehicleDueSummary
 */

const LAST_NOTIFIED_KEY = 'lastDueNotificationDate';
const NOTIFICATION_ICON = '/static/icons/android-chrome-192x192.png';

/** @returns {boolean} */
function notificationsSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/** @returns {NotificationPermission|'unsupported'} */
function getNotificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/**
 * Prompts the browser's notification permission dialog. Must be called from
 * a user gesture (e.g. a button click) — browsers ignore or auto-deny it otherwise.
 * @returns {Promise<NotificationPermission|'unsupported'>}
 */
async function requestNotificationPermission() {
  if (!notificationsSupported()) { return 'unsupported'; }
  return Notification.requestPermission();
}

/**
 * Shows a local notification (via the service worker, so it can show even
 * when the app tab isn't focused) summarizing overdue/due-soon maintenance
 * items across all vehicles — at most once per calendar day, and only when
 * permission was already granted. This is a client-only local notification,
 * not a server-pushed one: it only fires while the app is open/running, since
 * there's no backend that knows about due dates (all data lives in IndexedDB).
 * @param {VehicleDueSummary[]} vehicleSummaries
 */
async function notifyDueItemsOnce(vehicleSummaries) {
  if (!notificationsSupported() || Notification.permission !== 'granted') { return; }

  const withDueItems = vehicleSummaries.filter(v => v.overdue > 0 || v.dueSoon > 0);
  if (!withDueItems.length) { return; }

  const today = new Date().toDateString();
  if (localStorage.getItem(LAST_NOTIFIED_KEY) === today) { return; }

  const totalOverdue = withDueItems.reduce((sum, v) => sum + v.overdue, 0);
  const title = totalOverdue > 0 ? 'Tenés mantenimiento vencido' : 'Mantenimiento por vencer';
  const body = withDueItems
    .map(v => `${v.name}: ${formatRemindersBanner(v.overdue, v.dueSoon)}`)
    .join('\n');

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: 'due-items',
    });
    localStorage.setItem(LAST_NOTIFIED_KEY, today);
  } catch (e) {
    _error('Error mostrando notificación de mantenimiento', e);
  }
}

export { notificationsSupported, getNotificationPermission, requestNotificationPermission, notifyDueItemsOnce };
