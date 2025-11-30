import { SpacetimeApp } from './core/SpacetimeApp';

const container = document.getElementById('app');
const hud = document.getElementById('hud');

if (!container || !hud) {
  throw new Error('Missing app container or HUD element');
}

const app = new SpacetimeApp(container, hud);
app.start();
