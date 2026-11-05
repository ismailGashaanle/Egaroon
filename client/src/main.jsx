import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { store } from './app/store';
import ErrorBoundary from './components/common/ErrorBoundary';
import { LanguageProvider } from './i18n/LanguageContext';
import { SiteContentProvider } from './i18n/SiteContentContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <LanguageProvider>
          <SiteContentProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </SiteContentProvider>
        </LanguageProvider>
      </Provider>
    </ErrorBoundary>
  </StrictMode>
);
