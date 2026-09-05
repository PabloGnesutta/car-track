/**
 * Adds an expiry to sessions - previously bearer tokens were valid forever
 * until an explicit logout, so a leaked token had no built-in shelf life.
 * Existing rows are backfilled from their created_at so already-issued
 * tokens don't become invalid instantly on deploy.
 */
const sql = `
ALTER TABLE sessions ADD COLUMN expires_at INTEGER;

UPDATE sessions SET expires_at = created_at + (30 * 24 * 60 * 60 * 1000) WHERE expires_at IS NULL;
`;

export { sql };
