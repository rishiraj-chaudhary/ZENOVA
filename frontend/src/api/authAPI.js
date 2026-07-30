import apiClient from "./client.js";

export const register = (credentials) =>
  apiClient.post("/auth/register", credentials);

export const login = (credentials) => apiClient.post("/auth/login", credentials);

export const logout = () => apiClient.post("/auth/logout");
