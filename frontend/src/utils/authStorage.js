const TOKEN_KEY = "token";
const USER_ID_KEY = "userId";

/**
 * Session-scoped credential storage, in one place.
 *
 * Components previously read the token from sessionStorage in some files and
 * localStorage in others, which silently broke every request made by the
 * localStorage readers.
 */
export const getStoredToken = () => sessionStorage.getItem(TOKEN_KEY);

export const getStoredUserId = () => sessionStorage.getItem(USER_ID_KEY);

export const storeAuth = ({ token, userId }) => {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_ID_KEY, userId);
};

export const clearStoredAuth = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_ID_KEY);
};

export const hasStoredAuth = () => Boolean(getStoredToken() && getStoredUserId());
