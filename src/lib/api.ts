
export function setupFetchInterceptor() {
  const originalFetch = window.fetch;
  
  const interceptedFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem('x-session-token');
    if (token && typeof input === 'string' && input.startsWith('/api')) {
      init = init || {};
      init.headers = init.headers || {};
      if (init.headers instanceof Headers) {
        init.headers.set('x-session-token', token);
      } else if (Array.isArray(init.headers)) {
        let found = false;
        for (let i = 0; i < init.headers.length; i++) {
          if (init.headers[i][0] === 'x-session-token') {
            init.headers[i][1] = token;
            found = true;
            break;
          }
        }
        if (!found) init.headers.push(['x-session-token', token]);
      } else {
        (init.headers as any)['x-session-token'] = token;
      }
    }
    return originalFetch(input, init);
  };

  Object.defineProperty(window, 'fetch', {
    value: interceptedFetch,
    configurable: true,
    writable: true
  });
}
