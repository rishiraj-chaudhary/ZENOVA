import { API_BASE_URL } from "../config/api.js";
import { getAccessToken } from "../utils/authStorage.js";
import apiClient from "./client.js";

/**
 * Downloads the export as a file. Uses fetch directly because the shared client
 * unwraps JSON bodies, and this response is a downloadable attachment.
 */
export const downloadMyData = async () => {
  const response = await fetch(`${API_BASE_URL}/privacy/export`, {
    headers: { Authorization: `Bearer ${getAccessToken()}` },
    credentials: "include",
  });

  if (!response.ok) throw new Error("Could not export your data");

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "zenova-my-data.json";
  link.click();

  URL.revokeObjectURL(url);
};

export const deleteWellbeingData = () => apiClient.delete("/privacy/wellbeing-data");

export const deleteAccount = () =>
  apiClient.delete("/privacy/account", { data: { confirm: "DELETE MY ACCOUNT" } });
