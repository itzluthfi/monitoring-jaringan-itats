// Simple Base64 URL safe encoding for IDs
export const encryptId = (id: string | number): string => {
  try {
    return btoa(String(id)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    return String(id);
  }
};

export const decryptId = (hash: string): string => {
  try {
    let base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    return atob(base64);
  } catch (e) {
    return hash;
  }
};
