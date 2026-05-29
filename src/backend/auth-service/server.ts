import '../config/loadEnv';

import app from './app';

const PORT = Number(process.env.AUTH_SERVICE_PORT || 3004);

app.listen(PORT, () => {
  console.log(`[auth-service] listening on port ${PORT}`);
});
