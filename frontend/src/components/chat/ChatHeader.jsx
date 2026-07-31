const ChatHeader = ({ mood }) => (
  <header className="relative flex items-center justify-between border-b border-white/10 bg-white/5 p-4 backdrop-blur-xl">
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg">
          <i className="fa-solid fa-music text-sm text-white" aria-hidden="true" />
        </div>
        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-green-400" />
      </div>

      <div>
        <h1 className="text-xl font-light tracking-wide text-white">ZENOVA</h1>
        <p className="text-xs text-gray-400">Music wellbeing assistant</p>
      </div>
    </div>

    {mood && (
      <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
        <span className="sr-only">Detected mood: </span>
        {mood}
      </span>
    )}
  </header>
);

export default ChatHeader;
