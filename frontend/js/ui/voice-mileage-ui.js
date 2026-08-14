import { $, $getInner, $queryOneInput } from "../lib/dom.js";
import { isSpeechRecognitionSupported, listenOnce } from "../lib/speechRecognition.js";
import { parseSpanishNumber } from "../lib/spanishNumbers.js";
import { svg_mic } from "../svg/svgFn.js";
import { haptic } from "../lib/haptics.js";


const micBtn = $('voiceMileageBtn');
const statusEl = $getInner($('mileageForm'), '.voice-status');
const mileageInput = $queryOneInput('#mileageForm input[name="mileage"]');

/** @type {(() => void) | null} */
let activeStop = null;

/** @type {Record<string, string>} */
const ERROR_MESSAGES = {
  'not-allowed': 'Se necesita permiso del micrófono.',
  'no-speech': 'No se detectó voz. Probá de nuevo.',
  'audio-capture': 'No se encontró un micrófono.',
};

/**
 * Adds a mic button to the mileage form that dictates the reading in
 * Spanish (parsed via lib/spanishNumbers.js) instead of typing it.
 * No-ops (button stays hidden) where the Web Speech API isn't supported.
 */
function initVoiceMileageUi() {
  if (!isSpeechRecognitionSupported()) {
    micBtn.classList.add('display-none');
    return;
  }

  micBtn.innerHTML = svg_mic();
  micBtn.addEventListener('click', () => {
    if (activeStop) {
      activeStop();
      return;
    }
    startListening();
  });
}

/** Clears any stale status message from a previous dictation attempt. */
function resetVoiceStatus() {
  setStatus('', '');
}

function startListening() {
  setStatus('Escuchando…', 'listening');
  micBtn.classList.add('listening');
  haptic();

  const handle = listenOnce({
    lang: 'es-ES',
    onResult: transcript => {
      const value = parseSpanishNumber(transcript);
      if (value === null) {
        setStatus(`No se entendió ("${transcript}"). Probá de nuevo o escribilo.`, 'error');
        return;
      }
      mileageInput.value = String(value);
      mileageInput.focus();
      mileageInput.select();
      setStatus(`Se detectó ${value.toLocaleString('es')} km — revisá y confirmá.`, 'success');
    },
    onError: error => {
      setStatus(ERROR_MESSAGES[error] || 'No se pudo reconocer la voz. Intentá de nuevo.', 'error');
    },
    onEnd: () => {
      micBtn.classList.remove('listening');
      activeStop = null;
    },
  });

  if (!handle) {
    setStatus('No se pudo iniciar el micrófono.', 'error');
    micBtn.classList.remove('listening');
    return;
  }
  activeStop = handle.stop;
}

/**
 * @param {string} text
 * @param {string} type
 */
function setStatus(text, type) {
  statusEl.innerText = text;
  statusEl.dataset.type = type;
}


export { initVoiceMileageUi, resetVoiceStatus };
