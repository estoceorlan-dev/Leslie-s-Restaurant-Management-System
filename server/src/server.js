import { app } from './app.js';
import { config } from './config.js';
import { initializeDatabase } from './database/init.js';

initializeDatabase();

app.listen(config.port, () => {
  console.log(`Leslie's local API is running at http://localhost:${config.port}`);
});

