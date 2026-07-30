import {
  deleteAccount,
  deleteWellbeingData,
  exportUserData,
} from "../services/privacyService.js";
import asyncHandler from "../utils/asyncHandler.js";

export const exportData = asyncHandler(async (req, res) => {
  const data = await exportUserData(req.user._id);

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="zenova-data-${req.user._id}.json"`
  );
  res.send(JSON.stringify(data, null, 2));
});

export const clearWellbeingData = asyncHandler(async (req, res) => {
  const deleted = await deleteWellbeingData(req.user._id);
  res.json({ message: "Wellbeing data deleted", deleted });
});

export const closeAccount = asyncHandler(async (req, res) => {
  const deleted = await deleteAccount(req.user._id);
  req.session?.destroy?.(() => {});
  res.json({ message: "Account deleted", deleted });
});
