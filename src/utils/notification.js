import Notification from "../models/notificationModel.js";

export const sendNotification = async ({ userId, message, type = "info" }) => {
  try {
    const notification = new Notification({
      user: userId,
      message,
      type,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Notification Error:", error.message);
    throw new Error("Failed to send notification");
  }
};