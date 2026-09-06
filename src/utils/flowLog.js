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
