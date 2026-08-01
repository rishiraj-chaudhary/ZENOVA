import { useEffect, useRef, useState } from "react";
import * as musicAPI from "../api/musicAPI.js";
import * as playlistAPI from "../api/playlistAPI.js";
import * as wellbeingAPI from "../api/wellbeingAPI.js";
import { colorsForMood } from "../constants/moodColors.js";
import { useAuth } from "../context/AuthContext.jsx";
import useChatMessages from "../hooks/useChatMessages.js";
import useSpeechRecognition from "../hooks/useSpeechRecognition.js";
import ChatComposer from "./chat/ChatComposer.jsx";
import ChatHeader from "./chat/ChatHeader.jsx";
import MessageList from "./chat/MessageList.jsx";
import PlaylistPickerModal from "./chat/PlaylistPickerModal.jsx";
import RecommendationPanel from "./chat/RecommendationPanel.jsx";
import CrisisSupport from "./CrisisSupport.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";

const CONVERSATION_CONTEXT_SIZE = 10;
const SAVE_ALL = Symbol("save-all");

/**
 * Orchestrates the conversation.
 *
 * Presentation lives in ./chat/*, message persistence in useChatMessages, and
 * dictation in useSpeechRecognition. What remains here is the flow between them:
 * send a message, handle the reply, save songs.
 */
function Chatbot() {
  const { user } = useAuth();
  const userId = user?._id;

  const { messages, appendMessage, recommendations, setRecommendations, mood, setMood } =
    useChatMessages(userId);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [support, setSupport] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [checkInPhase, setCheckInPhase] = useState(null);
  // The after-rating is only meaningful once something was actually heard.
  const [hasListened, setHasListened] = useState(false);

  const [playlists, setPlaylists] = useState([]);
  const [pendingSong, setPendingSong] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [playlistError, setPlaylistError] = useState(null);

  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(null);

  const messagesEndRef = useRef(null);

  const {
    listening: isListening,
    supported: voiceSupported,
    start: handleVoiceInput,
  } = useSpeechRecognition({ onResult: setInput });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!input.trim() || !userId) return;

    const text = input;
    appendMessage({ text, sender: "user" });
    setInput("");
    setIsTyping(true);
    setSupport(null);

    try {
      const result = await musicAPI.fetchRecommendations({
        message: text,
        conversationHistory: messages.slice(-CONVERSATION_CONTEXT_SIZE),
      });

      appendMessage({ text: result.response, sender: "assistant" });

      // Support contacts accompany an elevated-risk reply and replace it
      // entirely at crisis level, where the server returns no recommendations.
      if (result.supportResources?.length) {
        setSupport({
          level: result.riskLevel,
          resources: result.supportResources,
          notice: result.emergencyNotice,
        });
      }

      if (result.recommendations?.length) {
        setRecommendations(result.recommendations);
        setSessionId(result.sessionId ?? null);
        setCheckInPhase(result.sessionId ? "before" : null);
        setHasListened(false);
      }
      if (result.detectedMood) setMood(result.detectedMood);
    } catch (error) {
      appendMessage({
        text: `Sorry, I couldn't get recommendations: ${error.message}`,
        sender: "system",
      });
    } finally {
      setIsTyping(false);
    }
  };

  const openPlaylistPicker = async (target) => {
    setPlaylistError(null);
    setPendingSong(target);

    try {
      setPlaylists(await playlistAPI.fetchMyPlaylists());
    } catch (error) {
      setPlaylistError(error.message);
    }
  };

  const songsToSave = () =>
    pendingSong === SAVE_ALL
      ? recommendations.map((song) => song.musicId)
      : [pendingSong];

  const saveToPlaylist = async (playlistId) => {
    const targets = songsToSave().filter(Boolean);
    if (targets.length === 0) return;

    // Settled rather than all: one duplicate must not abort the rest.
    const results = await Promise.allSettled(
      targets.map((songId) => playlistAPI.addSong({ playlistId, songId }))
    );

    const failures = results.filter((result) => result.status === "rejected");
    const saved = results.length - failures.length;

    if (saved === 0) {
      setPlaylistError(failures[0]?.reason?.message ?? "Could not save");
      return;
    }

    setPlaylistError(null);
    setPendingSong(null);
  };

  const createAndSave = async () => {
    if (!newPlaylistName.trim()) {
      setPlaylistError("Please enter a playlist name");
      return;
    }

    try {
      const created = await playlistAPI.createPlaylist(newPlaylistName);
      setPlaylists((current) => [...current, created]);
      setNewPlaylistName("");
      await saveToPlaylist(created._id);
    } catch (error) {
      setPlaylistError(error.message);
    }
  };

  const advanceTrack = (index) => {
    if (autoplayEnabled && index < recommendations.length - 1) {
      setCurrentPlayingIndex(index + 1);
    }
  };

  /**
   * Playing a track is what makes the after-rating worth asking for.
   *
   * The prompt was previously unreachable: answering the before-rating set the
   * phase to null on both branches, so it never returned and every
   * SessionOutcome.moodAfter stayed null — the measurement the product depends
   * on was never collected.
   */
  const startTrack = (index) => {
    setCurrentPlayingIndex(index);

    // Only the first play of a session needs recording; the server ignores the
    // rest, and a failure here must not interrupt playback.
    if (sessionId && !hasListened) {
      wellbeingAPI.recordSessionListened(sessionId).catch(() => {});
    }

    setHasListened(true);
  };

  const completeBeforeRating = () => setCheckInPhase("listening");

  const completeAfterRating = () => {
    setCheckInPhase(null);
    setSessionId(null);
    setHasListened(false);
  };

  const shuffle = () =>
    setRecommendations((current) =>
      [...current].sort(() => Math.random() - 0.5)
    );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 text-white">
      <ChatHeader mood={mood} />

      <div className="flex flex-grow flex-col overflow-hidden lg:flex-row">
        <div className="flex h-full flex-col overflow-hidden lg:w-1/2">
          <MessageList messages={messages} isTyping={isTyping} endRef={messagesEndRef}>
            {support && (
              <CrisisSupport
                level={support.level}
                resources={support.resources}
                notice={support.notice}
                onDismiss={() => setSupport(null)}
              />
            )}
          </MessageList>

          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={handleSendMessage}
            isListening={isListening}
            onVoiceInput={handleVoiceInput}
            voiceSupported={voiceSupported}
            disabled={!userId}
          />
        </div>

        {recommendations.length > 0 && (
          <div className="h-full overflow-hidden lg:w-1/2">
            <ErrorBoundary label="the recommendations">
              <RecommendationPanel
                recommendations={recommendations}
                moodColors={colorsForMood(mood)}
                mood={mood}
                sessionId={sessionId}
                checkInPhase={checkInPhase}
                autoplayEnabled={autoplayEnabled}
                currentPlayingIndex={currentPlayingIndex}
                onToggleAutoplay={() => setAutoplayEnabled((on) => !on)}
                onShuffle={shuffle}
                onSaveAll={() => openPlaylistPicker(SAVE_ALL)}
                onAddToPlaylist={openPlaylistPicker}
                onTrackEnded={advanceTrack}
                onPlay={startTrack}
                hasListened={hasListened}
                onBeforeRated={completeBeforeRating}
                onAfterRated={completeAfterRating}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {pendingSong !== null && (
        <PlaylistPickerModal
          playlists={playlists}
          newPlaylistName={newPlaylistName}
          onNewPlaylistNameChange={setNewPlaylistName}
          onSelect={saveToPlaylist}
          onCreate={createAndSave}
          onClose={() => setPendingSong(null)}
          error={playlistError}
          songCount={songsToSave().length}
        />
      )}
    </div>
  );
}

export default Chatbot;
