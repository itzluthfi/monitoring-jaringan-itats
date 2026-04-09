// Helper for fetching with Auth Token
export const authFetch = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/'; 
  }
  
  return response;
};
