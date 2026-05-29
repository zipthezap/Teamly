import '../config/loadEnv';

import app from './app';

const PORT = Number(process.env.TOURNAMENT_SERVICE_PORT || 3001);

app.listen(PORT, () => {
  console.log(`[tournament-service] listening on port ${PORT}`);
});
