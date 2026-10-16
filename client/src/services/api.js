/**
 * Central API Client for FixIt Now
 * Connects to Express REST API with environment-aware fallback
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Perform a GET request to the API
 * @param {string} endpoint e.g. '/api/health'
 * @returns {Promise<any>}
 */
export async function get(endpoint) {
  // If VITE_API_URL is configured, use it first; otherwise use relative path
  const primaryUrl = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  try {
    const response = await fetch(primaryUrl, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (err) {
    // If calling absolute URL failed, attempt fallback to relative path (Vite proxy)
    if (primaryUrl !== endpoint) {
      try {
        const fallbackResponse = await fetch(endpoint, {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
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
 * @param {object} data
 * @returns {Promise<any>}
 */
export async function post(endpoint, data) {
  const primaryUrl = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;

  const response = await fetch(primaryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}
