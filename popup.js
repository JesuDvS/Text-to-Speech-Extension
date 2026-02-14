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
const translateToggle = document.getElementById('translateToggle');
const translationSection = document.getElementById('translationSection');
const translatedText = document.getElementById('translatedText');

// Variables globales
let selectedText = '';
let synth = window.speechSynthesis;
let voices = [];
let checkingSelection = true;
let translationMode = false;

// Cargar voces disponibles
function loadVoices() {
  voices = synth.getVoices();
  voiceSelect.innerHTML = '';
  
  // Filtrar voces en inglés primero
  const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
  const otherVoices = voices.filter(voice => !voice.lang.startsWith('en'));
  
  // Agregar voces en inglés primero
  if (englishVoices.length > 0) {
    const englishGroup = document.createElement('optgroup');
    englishGroup.label = 'English';
    englishVoices.forEach((voice, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = `${voice.name} (${voice.lang})`;
      englishGroup.appendChild(option);
    });
    voiceSelect.appendChild(englishGroup);
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

// Función para traducir texto
async function translateText(text) {
  try {
    status.textContent = '🌐 Traduciendo...';
    
    const response = await fetch("http://localhost:5000/translate", {
      method: "POST",
      body: JSON.stringify({
        q: text,
        source: "en",
        target: "es",
        format: "text",
        alternatives: 3,
        api_key: ""
      }),
      headers: { "Content-Type": "application/json" }
    });
    
    if (!response.ok) {
      throw new Error('Error en la traducción');
    }
    
    const data = await response.json();
    translatedText.value = data.translatedText;
    status.textContent = '✅ Traducción completada';
    
  } catch (error) {
    console.error('Error al traducir:', error);
    translatedText.value = 'Error: No se pudo conectar con el servidor de traducción. Asegúrate de que esté ejecutándose en http://localhost:5000';
    status.textContent = '❌ Error en la traducción';
  }
}

// Alternar modo traducción
translateToggle.addEventListener('click', () => {
  translationMode = !translationMode;
  
  if (translationMode) {
    translateToggle.classList.add('active');
    translationSection.classList.add('active');
    
    // Si hay texto, traducirlo automáticamente
    const currentText = textPreview.value.trim();
    if (currentText) {
      translateText(currentText);
    }
  } else {
    translateToggle.classList.remove('active');
    translationSection.classList.remove('active');
    translatedText.value = '';
  }
});

// Obtener texto seleccionado de la página
async function getSelectedText() {
  if (!checkingSelection) return;
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Ejecutar en todos los frames (incluye el principal y los iframes)
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => window.getSelection().toString()
    });
    
    // Buscar texto en cualquiera de los frames
    let foundText = '';
    if (results) {
      for (const result of results) {
        if (result.result && result.result.trim()) {
          foundText = result.result.trim();
          break; // Usar el primer texto encontrado
        }
      }
    }
    
    // Solo actualizar si hay texto seleccionado
    if (foundText) {
      selectedText = foundText;
      textPreview.value = selectedText;
      updateStatus();
      
      // Si el modo traducción está activo, traducir automáticamente
      if (translationMode) {
        translateText(foundText);
      }
    }
  } catch (error) {
    console.error('Error al obtener texto:', error);
  }
}

// Actualizar estado
function updateStatus() {
  const currentText = textPreview.value.trim();
  
  if (currentText) {
    playBtn.disabled = false;
    status.textContent = `${currentText.length} caracteres listos para leer`;
  } else {
    playBtn.disabled = true;
    status.textContent = 'Escribe o selecciona texto para leer';
  }
}

// Reproducir texto
function speakText() {
  const textToSpeak = textPreview.value.trim();
  if (!textToSpeak) return;
  
  // Detener cualquier reproducción en curso
  synth.cancel();
  
  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  
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

// Escuchar cambios en el textarea
textPreview.addEventListener('input', () => {
  // Si el usuario está escribiendo, dejar de buscar texto seleccionado
  checkingSelection = false;
  updateStatus();
  
  // Si el modo traducción está activo, traducir el nuevo texto
  const currentText = textPreview.value.trim();
  if (translationMode && currentText) {
    // Usar debounce para no traducir en cada tecla
    clearTimeout(textPreview.translateTimeout);
    textPreview.translateTimeout = setTimeout(() => {
      translateText(currentText);
    }, 1000);
  }
});

// Reactivar búsqueda de selección cuando el campo está vacío
textPreview.addEventListener('focus', () => {
  if (!textPreview.value.trim()) {
    checkingSelection = true;
  }
});

// Obtener texto seleccionado al abrir el popup
getSelectedText();
updateStatus();

// Actualizar cada segundo por si el usuario selecciona texto
setInterval(getSelectedText, 1000);