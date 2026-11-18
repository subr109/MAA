import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  registerSW({immediate: true});
}

createRoot(document.getElementById('root')!).render(<App />);
