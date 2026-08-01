/**
 * What "optional" should mean on a JSON body.
 *
 * express-validator's bare `.optional()` skips a field only when it is
 * `undefined`. A client that sends `{"sessionId": null}` — which is what any UI
 * does when it holds the value in state and has nothing yet — gets a 400
 * "Invalid value" for a field it was entitled to omit.
 *
 * That is exactly how the like/dislike buttons broke: the chat sends
 * `sessionId` and `moodAtTime` straight from state, both null before a session
 * or a detected mood exists, and every rating outside an open session was
 * rejected. The component treats a failed write as advisory and reverts
 * quietly, so the thumb just flicked back and nothing said why.
 *
 * `values: "null"` skips undefined *and* null, which is what callers mean.
 */
export const OPTIONAL = { values: "null" };

export default OPTIONAL;
