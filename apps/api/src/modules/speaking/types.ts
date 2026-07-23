export type SpeakingServiceResult = { kind: 'transcribed'; transcript: string } | { kind: 'error'; message: string };

export type WordMatchResult =
  | { kind: 'matched'; transcript: string; word: string; similarity: number }
  | { kind: 'mismatched'; transcript: string; word: string; similarity: number }
  | { kind: 'error'; message: string };
