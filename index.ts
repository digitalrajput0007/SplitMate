import { registerRootComponent } from 'expo';
import { initSentry } from './src/config/sentry';
import App from './App';

initSentry();
registerRootComponent(App);

