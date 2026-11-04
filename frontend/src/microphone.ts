export interface MicrophoneListener {
  /** True when the browser holds audio back until the user taps or clicks the page. */
  suspended: boolean;
  /** Starts the audio after a tap or click, when the browser held it back. Safe to call any time. */
  resume(): void;
  /** Stops listening and turns the microphone off. Safe to call more than once. */
  stop(): void;
}

/**
 * Asks for the microphone and calls `onLevel` with the peak level (0 to 1) of every audio frame,
 * about 60 times a second. Uses the Web Audio API, so nothing is recorded or sent anywhere.
 * Rejects when the browser has no microphone support, there is no microphone, or the user says no.
 * Browsers only allow the microphone on https or localhost.
 */
export async function listenToMicrophone(
  onLevel: (level: number, timeMs: number) => void,
): Promise<MicrophoneListener> {
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
    throw new Error("This browser cannot use the microphone");
  }
  // Noise suppression and auto gain would soften the sharp peak of a clap, so they are off.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const context = new AudioContext();
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  context.createMediaStreamSource(stream).connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  let frame = 0;
  let stopped = false;
  function tick() {
    analyser.getFloatTimeDomainData(samples);
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    onLevel(Math.min(peak, 1), performance.now());
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  return {
    suspended: context.state === "suspended",
    resume() {
      if (!stopped && context.state === "suspended") void context.resume();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      for (const track of stream.getTracks()) track.stop();
      void context.close();
    },
  };
}
