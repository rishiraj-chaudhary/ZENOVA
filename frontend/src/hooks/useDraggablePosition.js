import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks a freely draggable element's position.
 *
 * Move and release are bound to the window rather than the element, so dragging
 * keeps working when the pointer briefly leaves the element's bounds.
 */
const useDraggablePosition = (initialPosition) => {
  const [position, setPosition] = useState(initialPosition);
  const isDraggingRef = useRef(false);

  const startDrag = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  useEffect(() => {
    const handleMove = (event) => {
      if (!isDraggingRef.current) return;
      setPosition({ x: event.clientX, y: event.clientY });
    };

    const handleRelease = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleRelease);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleRelease);
    };
  }, []);

  return { position, startDrag };
};

export default useDraggablePosition;
