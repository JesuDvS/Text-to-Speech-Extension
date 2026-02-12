// Elementos del DOM
const textPreview = document.getElementById('textPreview');
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const voiceSelect = document.getElementById('voiceSelect');
const rateRange = document.getElementById('rateRange');
const pitchRange = document.getElementById('pitchRange');
const rateValue = document.getElementById('rateValue');
const pitchValue = document.getElementById('pitchValue');
const status = document.getElementById('status');

// Variables globales
let selectedText = '';
let synth = window.speechSynthesis;
let voices = [];

// Cargar voces disponibles
function loadVoices() {
  voices = synth.getVoices();
  voiceSelect.innerHTML = '';
  
  // Filtrar voces en ingles primero
  const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
  const otherVoices = voices.filter(voice => !voice.lang.startsWith('en'));
  
  // Agregar voces en ingles primero
  if (englishVoices.length > 0) {
    const spanishGroup = document.createElement('optgroup');
    spanishGroup.label = 'English';
    englishVoices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${voice.name} (${voice.lang})`;
      spanishGroup.appendChild(option);
    });
    voiceSelect.appendChild(spanishGroup);
  }
  
  // Agregar otras voces
  if (otherVoices.length > 0) {
    const otherGroup = document.createElement('optgroup');
    otherGroup.label = 'Otros idiomas';
    otherVoices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = englishVoices.length + index;
      option.textContent = `${voice.name} (${voice.lang})`;
      otherGroup.appendChild(option);
    });
    voiceSelect.appendChild(otherGroup);
  }
  
  // Cargar configuración guardada
  chrome.storage.local.get(['selectedVoice', 'rate', 'pitch'], (result) => {
    if (result.selectedVoice !== undefined) {
      voiceSelect.value = result.selectedVoice;
    }
    if (result.rate !== undefined) {
      rateRange.value = result.rate;
      rateValue.textContent = result.rate + 'x';
    }
    if (result.pitch !== undefined) {
      pitchRange.value = result.pitch;
      pitchValue.textContent = result.pitch;
    }
  });
}

// Cargar voces cuando estén disponibles
if (synth.onvoiceschanged !== undefined) {
  synth.onvoiceschanged = loadVoices;
}
loadVoices();

// Obtener texto seleccionado de la página
// Obtener texto seleccionado de la página
async function getSelectedText() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Ejecutar en todos los frames (incluye el principal y los iframes)
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => window.getSelection().toString()
    });
    
    // Buscar texto en cualquiera de los frames
    selectedText = '';
    if (results) {
      for (const result of results) {
        if (result.result && result.result.trim()) {
          selectedText = result.result.trim();
          break; // Usar el primer texto encontrado
        }
      }
    }
    
    if (selectedText) {
      textPreview.textContent = selectedText;
      textPreview.classList.remove('empty');
      playBtn.disabled = false;
      status.textContent = `${selectedText.length} caracteres seleccionados`;
    } else {
      textPreview.textContent = 'No hay texto seleccionado';
      textPreview.classList.add('empty');
      playBtn.disabled = true;
      status.textContent = 'Selecciona texto en la página';
    }
  } catch (error) {
    console.error('Error al obtener texto:', error);
    status.textContent = 'Error al obtener texto seleccionado';
  }
}

// Reproducir texto
function speakText() {
  if (!selectedText) return;
  
  // Detener cualquier reproducción en curso
  synth.cancel();
  
  const utterance = new SpeechSynthesisUtterance(selectedText);
  
  // Configurar voz
  const selectedVoiceIndex = parseInt(voiceSelect.value);
  if (voices[selectedVoiceIndex]) {
    utterance.voice = voices[selectedVoiceIndex];
  }
  
  // Configurar velocidad y tono
  utterance.rate = parseFloat(rateRange.value);
  utterance.pitch = parseFloat(pitchRange.value);
  
  // Eventos
  utterance.onstart = () => {
    status.textContent = '🔊 Reproduciendo...';
    status.classList.add('speaking');
    playBtn.disabled = true;
    stopBtn.disabled = false;
  };
  
  utterance.onend = () => {
    status.textContent = 'Reproducción finalizada';
    status.classList.remove('speaking');
    playBtn.disabled = false;
    stopBtn.disabled = true;
  };
  
  utterance.onerror = (event) => {
    console.error('Error en síntesis de voz:', event);
    status.textContent = 'Error al reproducir';
    status.classList.remove('speaking');
    playBtn.disabled = false;
    stopBtn.disabled = true;
  };
  
  // Iniciar síntesis
  synth.speak(utterance);
}

// Detener reproducción
function stopSpeaking() {
  synth.cancel();
  status.textContent = 'Reproducción detenida';
  status.classList.remove('speaking');
  playBtn.disabled = false;
  stopBtn.disabled = true;
}

// Event Listeners
playBtn.addEventListener('click', speakText);
stopBtn.addEventListener('click', stopSpeaking);

// Actualizar valores de los rangos
rateRange.addEventListener('input', (e) => {
  rateValue.textContent = e.target.value + 'x';
  chrome.storage.local.set({ rate: e.target.value });
});

pitchRange.addEventListener('input', (e) => {
  pitchValue.textContent = e.target.value;
  chrome.storage.local.set({ pitch: e.target.value });
});

voiceSelect.addEventListener('change', (e) => {
  chrome.storage.local.set({ selectedVoice: e.target.value });
});

// Obtener texto seleccionado al abrir el popup
getSelectedText();

// Actualizar cada segundo por si el usuario selecciona texto
setInterval(getSelectedText, 1000);