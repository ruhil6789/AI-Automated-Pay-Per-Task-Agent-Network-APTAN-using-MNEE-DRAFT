// API Configuration
// In production, set REACT_APP_API_URL environment variable
// For local development, defaults to http://localhost:3001
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Helper function to get full API endpoint URL
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_URL}/${cleanEndpoint}`;
};

