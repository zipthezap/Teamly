import '../config/loadEnv';

import app from './app';

const PORT = Number(process.env.NOTIFICATION_SERVICE_PORT || 3003);

app.listen(PORT, () => {
  console.log(`[notification-service] listening on port ${PORT}`);
});
