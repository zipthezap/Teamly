import '../config/loadEnv';

import app from './app';

const PORT = Number(process.env.COMMUNITY_SERVICE_PORT || 3002);

app.listen(PORT, () => {
  console.log(`[community-service] listening on port ${PORT}`);
});
