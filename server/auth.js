/**
 * Domino auth: get headers for outbound API calls.
 * Re-acquire token on every call (Domino token expires quickly).
 * - In Domino: GET http://localhost:8899/access-token
 * - Local dev: API_KEY_OVERRIDE env or header
 */
const TOKEN_URL = 'http://localhost:8899/access-token';

async function getAuthHeaders(req) {
  const apiKeyOverride = process.env.API_KEY_OVERRIDE || (req && req.get && req.get('X-API-Key-Override'));
  if (apiKeyOverride) {
    return { 'X-Domino-Api-Key': apiKeyOverride };
  }
  try {
    const res = await fetch(TOKEN_URL);
    if (!res.ok) {
      throw new Error(`access-token returned ${res.status}`);
    }
    const token = (await res.text()).trim();
    const bearer = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return { Authorization: bearer };
  } catch (err) {
    console.error('getAuthHeaders:', err.message);
    throw err;
  }
}

module.exports = { getAuthHeaders };
