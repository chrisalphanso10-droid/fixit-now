/**
 * Central API Client for FixIt Now
 * Connects to Express REST API with environment-aware fallback
 * Automatically attaches JWT authentication header from localStorage.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Helper to build common headers with JWT auth
 */
function getAuthHeaders(extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...extraHeaders,
  };

  try {
    const token = localStorage.getItem('fixit_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore in environments without localStorage
  }

  return headers;
}

/**
 * Perform a GET request to the API
 * @param {string} endpoint e.g. '/api/health'
 * @returns {Promise<any>}
 */
export async function get(endpoint) {
  const primaryUrl = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  try {
    const response = await fetch(primaryUrl, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    if (primaryUrl !== endpoint) {
      try {
        const fallbackResponse = await fetch(endpoint, {
          method: 'GET',
          headers: getAuthHeaders(),
        });
        if (fallbackResponse.ok) {
          return await fallbackResponse.json();
        }
      } catch {
        // Fall back to original error
      }
    }
    throw err;
  }
}

/**
 * Perform a POST request to the API
 * @param {string} endpoint
 * @param {object} [data]
 * @returns {Promise<any>}
 */
export async function post(endpoint, data = {}) {
  const primaryUrl = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  try {
    const response = await fetch(primaryUrl, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    if (primaryUrl !== endpoint) {
      try {
        const fallbackResponse = await fetch(endpoint, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        });
        if (fallbackResponse.ok) {
          return await fallbackResponse.json();
        }
      } catch {
        // ignore fallback error
      }
    }
    throw err;
  }
}

/**
 * Perform a PUT request to the API
 * @param {string} endpoint
 * @param {object} [data]
 * @returns {Promise<any>}
 */
export async function put(endpoint, data = {}) {
  const primaryUrl = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  try {
    const response = await fetch(primaryUrl, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    if (primaryUrl !== endpoint) {
      try {
        const fallbackResponse = await fetch(endpoint, {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(data),
        });
        if (fallbackResponse.ok) {
          return await fallbackResponse.json();
        }
      } catch {
        // ignore fallback error
      }
    }
    throw err;
  }
}

/**
 * Perform a POST request with multipart/form-data (for file uploads)
 * @param {string} endpoint
 * @param {FormData} formData
 * @returns {Promise<any>}
 */
export async function postFormData(endpoint, formData) {
  const primaryUrl = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  const headers = {};
  try {
    const token = localStorage.getItem('fixit_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }

  const response = await fetch(primaryUrl, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export default {
  get,
  post,
  put,
  postFormData,
};

