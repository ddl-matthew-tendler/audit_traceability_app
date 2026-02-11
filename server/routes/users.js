/**
 * Proxy GET /api/users -> DOMINO_API_HOST/v4/users
 * Proxy GET /api/me   -> DOMINO_API_HOST/v4/users/self
 */
const { getAuthHeaders } = require('../auth');

module.exports = function userRoutes(getDominoHost) {
  return {
    async users(req, res) {
      const base = getDominoHost();
      if (!base) {
        res.status(503).json({ error: 'DOMINO_API_HOST not set' });
        return;
      }
      try {
        const headers = await getAuthHeaders(req);
        const url = new URL('/v4/users', base);
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
          console.error('Users API error', proxyRes.status, body);
          res.status(proxyRes.status).json({ error: body || `Users API returned ${proxyRes.status}` });
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
        console.error('users proxy error:', err);
        res.status(502).json({ error: err.message || 'Failed to fetch users' });
      }
    },
    async me(req, res) {
      const base = getDominoHost();
      if (!base) {
        res.status(503).json({ error: 'DOMINO_API_HOST not set' });
        return;
      }
      try {
        const headers = await getAuthHeaders(req);
        const url = new URL('/v4/users/self', base);
        const proxyRes = await fetch(url.toString(), {
          method: 'GET',
          headers: { ...headers, Accept: 'application/json' },
        });
        const body = await proxyRes.text();
        if (!proxyRes.ok) {
          console.error('Me API error', proxyRes.status, body);
          res.status(proxyRes.status).json({ error: body || `Me API returned ${proxyRes.status}` });
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
        console.error('me proxy error:', err);
        res.status(502).json({ error: err.message || 'Failed to fetch current user' });
      }
    },
  };
};
