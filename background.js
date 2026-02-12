// Service worker para la extensión de Texto a Voz

// Listener para cuando se instala la extensión
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extensión de Lector de Texto instalada');
  
  // Configuración inicial
  chrome.storage.local.set({
    rate: 1.0,
    pitch: 1.0,
    selectedVoice: 0
  });
});

// Listener para mensajes (por si se necesita en el futuro)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'speak') {
    sendResponse({ success: true });
  }
  return true;
});