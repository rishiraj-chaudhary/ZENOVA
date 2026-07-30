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
    <div className="min-h-screen">
      {showCheckIn && (
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <DailyCheckIn onDone={() => setShowCheckIn(false)} />
        </div>
      )}

      <Chatbot />
    </div>
  );
};

export default Profile;
