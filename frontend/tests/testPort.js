import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Reads PORT from backend/.env so the e2e harness always targets whatever
 * port the backend actually serves on, instead of a hardcoded port that can
 * silently drift out of sync with it (as happened before this file existed
 * — playwright.config.js pointed at :4000 while backend/.env said :3000,
 * so e2e runs would time out after 30s unless you knew to override PORT).
 * @returns {string}
 */
function readBackendPort() {
  try {
    const envContent = fs.readFileSync(join(__dirname, '../../backend/.env'), 'utf-8');
    const match = envContent.match(/^PORT=(\d+)/m);
    return match ? match[1] : '3000';
  } catch {
    return '3000';
  }
}

export const TEST_PORT = readBackendPort();
