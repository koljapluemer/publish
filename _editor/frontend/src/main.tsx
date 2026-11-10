import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { showError } from './dumb/notice';
import './app.css';

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: showError }),
  // the server is local: a failure won't go away by retrying
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
