import { useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext.jsx";

/**
 * Subscribes to a map of socket events and unsubscribes on cleanup.
 *
 * Handlers are held in a ref so the subscription is not torn down and rebuilt
 * on every render. Components previously listed their (unmemoised) handlers in
 * the dependency array, which re-registered every listener on each render.
 */
const useSocketEvents = (handlers) => {
  const { socket } = useSocket();
  const handlersRef = useRef(handlers);

  handlersRef.current = handlers;

  useEffect(() => {
    if (!socket) return undefined;

    const entries = Object.keys(handlersRef.current).map((event) => [
      event,
      (payload) => handlersRef.current[event]?.(payload),
    ]);

    entries.forEach(([event, listener]) => socket.on(event, listener));

    return () => entries.forEach(([event, listener]) => socket.off(event, listener));
    // Re-subscribing only when the socket itself changes is intentional; the
    // ref indirection keeps the listeners current without re-binding.
  }, [socket]);
};

export default useSocketEvents;
