import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { testRemoteConnection, fetchRemoteDatabaseObjects, executeRemoteQuery } from './src/server/dbBridge.ts';

function dbApiPlugin(): Plugin {
  return {
    name: 'db-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/db/')) {
          return next();
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const data = body ? JSON.parse(body) : {};

            if (req.url === '/api/db/test') {
              const result = await testRemoteConnection(data);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } else if (req.url === '/api/db/objects') {
              const objects = await fetchRemoteDatabaseObjects(data);
              res.statusCode = 200;
              res.end(JSON.stringify(objects));
            } else if (req.url === '/api/db/query') {
              const result = await executeRemoteQuery(data, data.sql);
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Endpoint not found' }));
            }
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err?.message || String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), dbApiPlugin()],
});
