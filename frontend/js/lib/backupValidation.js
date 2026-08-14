/**
 * Pure helpers for backup-db.js, kept dependency-free (no indexedDb.js/
 * logger.js) so they're unit-testable under Node — see
 * tests/unit/backup-db.test.js and the note in CLAUDE.md about why
 * DOM-touching modules can't be.
 */

/**
 * Checks that parsed JSON has the shape of a CarTrack backup (the four
 * store arrays), without trusting anything about their contents.
 * @param {*} data
 * @returns {boolean}
 */
function isValidBackupData(data) {
  return !!data && typeof data === 'object'
    && Array.isArray(data.vehicles) && Array.isArray(data.maintenanceItems)
    && Array.isArray(data.serviceHistory) && Array.isArray(data.mileageHistory);
}

/**
 * Mutates the given object, turning ISO date strings back into Date
 * instances for the listed fields (JSON.parse leaves them as strings).
 * @param {Record<string, *>} obj
 * @param {string[]} fields
 */
function reviveDates(obj, fields) {
  fields.forEach(field => {
    if (obj[field]) { obj[field] = new Date(obj[field]); }
  });
}


export { isValidBackupData, reviveDates };
