/**
 * Proxy GET /api/audit -> DOMINO_API_HOST/api/audittrail/v1/auditevents
 * Forwards query params; expects startTimestamp, endTimestamp in ms (or we accept start/end and convert).
 */
const { getAuthHeaders } = require('../auth');

const AUDIT_PATH = '/api/audittrail/v1/auditevents';

module.exports = function auditRoutes(getDominoHost) {
  return async function auditHandler(req, res) {
    const base = getDominoHost();
    if (!base) {
      res.status(503).json({ error: 'DOMINO_API_HOST not set' });
      return;
    }
    try {
      const headers = await getAuthHeaders(req);
      const url = new URL(AUDIT_PATH, base);
      const forward = new URL(req.url, 'http://localhost');
      forward.searchParams.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
      const proxyRes = await fetch(url.toString(), {
        method: 'GET',
        headers: { ...headers, Accept: 'application/json' },
      });
      const body = await proxyRes.text();
      if (!proxyRes.ok) {
        console.error('Audit API error', proxyRes.status, body);
        res.status(proxyRes.status).json({ error: body || `Audit API returned ${proxyRes.status}` });
        return;
      }
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        data = body;
      }
      res.json(data);
    } catch (err) {
      console.error('audit proxy error:', err);
      res.status(502).json({ error: err.message || 'Failed to fetch audit events' });
    }
  };
};
