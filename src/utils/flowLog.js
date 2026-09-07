export const logAuthFlow = (message) => {
  console.log(`[AUTH FLOW] ${message}`);
};

export const logAuthDebug = (message) => {
  console.log(`[AUTH DEBUG] ${message}`);
};

export const logLocationFlow = (message) => {
  console.log(`[LOCATION FLOW] ${message}`);
};

export const logHomeFlow = (message) => {
  console.log(`[HOME FLOW] ${message}`);
};

export const logApiFlow = (message) => {
  console.log(`[API FLOW] ${message}`);
};

const formatApiPath = (config) => {
  const base = config?.baseURL || '';
  const url = config?.url || '';
  return `${base}${url}`.replace(/([^:]\/)\/+/g, '$1');
};

export const logApiRequest = (config) => {
  if (!__DEV__) {
    return;
  }

  const method = (config?.method || 'GET').toUpperCase();
  console.log(`[API REQUEST] ${method} ${formatApiPath(config)}`);
};

export const logApiSuccess = (response) => {
  if (!__DEV__) {
    return;
  }

  const method = (response?.config?.method || 'GET').toUpperCase();
  console.log(`[API SUCCESS] ${method} ${formatApiPath(response?.config)} status=${response?.status}`);
};

export const logApiError = (error) => {
  if (!__DEV__) {
    return;
  }

  const config = error?.config;
  const method = (config?.method || 'GET').toUpperCase();
  const status = error?.response?.status || 'none';
  const code = error?.code || 'none';
  const message = error?.response?.data?.message || error?.message || 'Unknown error';

  console.error(
    `[API ERROR] ${method} ${formatApiPath(config)} status=${status} code=${code} message=${message}`
  );
};

export const logBloodRequest = (message) => {
  console.log(`[BLOOD REQUEST] ${message}`);
};

export const logAuthError = (message, error) => {
  const detail = error?.response?.status
    ? `HTTP ${error.response.status}: ${error.response?.data?.message || error.message}`
    : error?.message || String(error);
  console.error(`[AUTH ERROR] ${message} — ${detail}`);
};

export const logLocationError = (message, error) => {
  const detail = error?.response?.status
    ? `HTTP ${error.response.status}: ${error.response?.data?.message || error.message}`
    : error?.message || String(error);
  console.error(`[LOCATION ERROR] ${message} — ${detail}`);
};

export const logBloodRequestError = (message, error) => {
  const detail = error?.response?.status
    ? `HTTP ${error.response.status}: ${error.response?.data?.message || error.message}`
    : error?.message || String(error);
  console.error(`[BLOOD REQUEST ERROR] ${message} — ${detail}`);
};
