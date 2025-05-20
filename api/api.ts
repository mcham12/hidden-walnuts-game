// @ts-ignore
import { app } from './app.js';
// DEV/TEST ONLY: POST /rehide-test endpoint for manual walnut testing
app.post('/rehide-test', async (c) => {
  const id = c.env.FOREST_MANAGER.idFromName('forest');
  const forestManager = c.env.FOREST_MANAGER.get(id);
  const response = await forestManager.fetch('http://internal/rehide-test');
  const result = await response.json();
  return c.json(result);
}); 