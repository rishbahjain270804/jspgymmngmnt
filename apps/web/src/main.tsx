import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { SessionProvider } from './demo/session';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './components/ui/ui.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root — index.html did not load.');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
