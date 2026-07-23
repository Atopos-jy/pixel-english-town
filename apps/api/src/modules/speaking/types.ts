export type SpeakingServiceResult = { kind: 'transcribed'; transcript: string } | { kind: 'error'; message: string };
