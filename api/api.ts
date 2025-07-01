// @ts-ignore
import { app } from './app.js';
// DEV/TEST ONLY: POST /rehide-test endpoint for manual walnut testing
app.post('/rehide-test', async (c) => {
  const id = c.env.FOREST.idFromName('forest');
  console.log('DO ID for /rehide-test:', id.toString());
  const forestManager = c.env.FOREST.get(id);
  const response = await forestManager.fetch('http://internal/rehide-test');
  const result = await response.json();
  return c.json(result);
});

app.get('/map-state', async (c) => {
  const id = c.env.FOREST.idFromName('forest');
  console.log('DO ID for /map-state:', id.toString());
  const forestManager = c.env.FOREST.get(id);
  const response = await forestManager.fetch('http://internal/map-state');
  const result = await response.json();
  return c.json(result);
});

app.get('/join', async (c) => {
  const id = c.env.FOREST.idFromName('forest');
  console.log('DO ID for /join:', id.toString());
  const forestManager = c.env.FOREST.get(id);
  const response = await forestManager.fetch('http://internal/join');
  const result = await response.json();
  return c.json(result);
});

// Add server metrics endpoint for Task 2
app.get('/server-metrics', async (c) => {
  const id = c.env.FOREST.idFromName('forest');
  console.log('DO ID for /server-metrics:', id.toString());
  const forestManager = c.env.FOREST.get(id);
  const response = await forestManager.fetch('http://internal/server-metrics');
  const result = await response.json();
  return c.json(result);
}); 