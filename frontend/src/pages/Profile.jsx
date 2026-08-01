import { useState } from "react";
import Chatbot from "../components/Chatbot.jsx";
import DailyCheckIn, { hasCheckedInToday } from "../components/DailyCheckIn.jsx";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * The signed-in home: a check-in prompt, then the assistant.
 *
 * Profile details and preferences now live on the Settings page. They were
 * previously hidden inside a floating draggable button, which was undiscoverable
 * and completely unusable on touch devices.
 */
const Profile = () => {
  const { user } = useAuth();
  const [showCheckIn, setShowCheckIn] = useState(
    () => Boolean(user?.consent?.moodTracking) && !hasCheckedInToday()
  );

  return (
    <>
      {/* A dialog over the chat rather than a card above it: inline, it pushed
          the conversation down the page every visit and could be scrolled past
          without answering. */}
      <DailyCheckIn open={showCheckIn} onDone={() => setShowCheckIn(false)} />
      <Chatbot />
    </>
  );
};

export default Profile;
