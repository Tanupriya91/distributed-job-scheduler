import { env } from "./env";
import { app } from "./app";
import { logger } from "./logger";

app.listen(env.PORT, () => {
  logger.info(`Backend API listening on http://localhost:${env.PORT}`);
});
