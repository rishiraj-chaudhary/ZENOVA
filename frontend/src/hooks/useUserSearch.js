import { useEffect, useState } from "react";
import { searchUsers } from "../api/userAPI.js";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Debounced collaborator lookup.
 *
 * Invites previously required typing another user's name exactly, which made
 * sharing effectively unusable unless you already knew the string.
 */
const useUserSearch = (query) => {
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query?.trim() ?? "";

    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      return undefined;
    }

    // Ignores responses that arrive after the query has moved on, so a slow
    // early request cannot overwrite results for what the user typed since.
    let active = true;
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const { users } = await searchUsers(trimmed);
        if (active) setResults(users);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, searching };
};

export default useUserSearch;
