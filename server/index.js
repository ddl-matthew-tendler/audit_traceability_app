/**
 * Traceability Explorer server.
 * - Serves static build from client/dist
 * - Proxies /api/audit, /api/users, /api/me to Domino with auth
 * - Bind 0.0.0.0:8888 for Domino
 */
const path = require('path');
const express = require('express');
const auditHandler = require('./routes/audit');
const userRoutes = require('./routes/users');

const PORT = Number(process.env.PORT) || 8888;
const HOST = '0.0.0.0';
const DOMINO_API_HOST = process.env.DOMINO_API_HOST || '';

function getDominoHost() {
  const host = (process.env.DOMINO_API_HOST || '').trim();
  return host || null;
}

const app = express();

app.use(express.json());

app.get('/api/audit', auditHandler(getDominoHost));
const users = userRoutes(getDominoHost);
app.get('/api/users', users.users);
app.get('/api/me', users.me);

const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Traceability Explorer listening on ${HOST}:${PORT}`);
  if (!DOMINO_API_HOST) {
    console.warn('DOMINO_API_HOST not set; /api/* will return 503 until set.');
  }
});
