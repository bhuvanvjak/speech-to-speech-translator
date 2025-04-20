document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const inputLangSelect = document.getElementById('inputLang');
  const outputLangSelect = document.getElementById('outputLang');
  const toggleButton = document.getElementById('toggleButton');
  const inputTextArea = document.getElementById('inputText');
  const translatedTextArea = document.getElementById('translatedText');
  const errorDiv = document.getElementById('error');
  const themeToggle = document.getElementById('themeToggle');
  const langSwapButton = document.getElementById('langSwap');
  const copyInputButton = document.getElementById('copyInput');
  const copyTranslatedButton = document.getElementById('copyTranslated');
  const downloadAudioButton = document.getElementById('downloadAudio');
  const clearInputButton = document.getElementById('clearInput');
  const clearTranslatedButton = document.getElementById('clearTranslated');
  const micAnimation = document.getElementById('micAnimation');
  const offlineIndicator = document.getElementById('offlineIndicator');
  const voiceSettingsButton = document.getElementById('voiceSettingsButton');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsButton = document.getElementById('closeSettings');
  const saveSettingsButton = document.getElementById('saveSettings');
  const resetSettingsButton = document.getElementById('resetSettings');
  const pitchSlider = document.getElementById('pitchSlider');
  const speedSlider = document.getElementById('speedSlider');
  const pitchValue = document.getElementById('pitchValue');
  const speedValue = document.getElementById('speedValue');
  const historySection = document.getElementById('historySection');
  const historyList = document.getElementById('historyList');
  const clearHistoryButton = document.getElementById('clearHistory');

  // State variables
  let recognition = null;
  let isListening = false;
  let isLoading = false;
  let currentAudioUrl = null;
  let translationHistory = [];
  let voiceSettings = {
    pitch: 1.0,
    speed: 1.0
  };

  // Initialize the application
  init();

  function init() {
    // Load saved settings
    loadSettings();
    
    // Set up service worker
    setupServiceWorker();
    
    // Check if speech recognition is supported
    if (!('webkitSpeechRecognition' in window)) {
      showError('Web Speech API is not supported. Please use Chrome browser.');
      toggleButton.disabled = true;
      return;
    }
    
    // Initialize speech recognition
    setupSpeechRecognition();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update offline status immediately and listen for changes
    updateOfflineStatus();
    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);
    
    // Load translation history
    loadTranslationHistory();
  }

  function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => console.log('Service Worker registered:', registration.scope))
        .catch(error => console.error('SW registration failed:', error));
    }
  }

  function setupSpeechRecognition() {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = inputLangSelect.value;
  }

  function setupEventListeners() {
    // Language selection events
    inputLangSelect.addEventListener('change', handleInputLangChange);
    langSwapButton.addEventListener('click', swapLanguages);
    
    // Main button events
    toggleButton.addEventListener('click', toggleListening);
    
    // Text manipulation events
    copyInputButton.addEventListener('click', () => copyToClipboard(inputTextArea));
    copyTranslatedButton.addEventListener('click', () => copyToClipboard(translatedTextArea));
    clearInputButton.addEventListener('click', () => clearTextArea(inputTextArea));
    clearTranslatedButton.addEventListener('click', () => clearTextArea(translatedTextArea));
    downloadAudioButton.addEventListener('click', downloadCurrentAudio);
    
    // Settings events
    themeToggle.addEventListener('click', toggleTheme);
    voiceSettingsButton.addEventListener('click', () => toggleSettingsModal(true));
    closeSettingsButton.addEventListener('click', () => toggleSettingsModal(false));
    saveSettingsButton.addEventListener('click', saveSettings);
    resetSettingsButton.addEventListener('click', resetSettings);
    
    // Sliders
    pitchSlider.addEventListener('input', updatePitchValue);
    speedSlider.addEventListener('input', updateSpeedValue);
    
    // History events
    clearHistoryButton.addEventListener('click', clearTranslationHistory);
  }

  function handleInputLangChange() {
    if (!isListening) {
      const newLang = inputLangSelect.value === 'auto' ? 'en-US' : inputLangSelect.value;
      recognition.lang = newLang;
    }
  }

  function swapLanguages() {
    // This will only swap output languages and input text, since input language is for speech recognition
    const tempOutput = outputLangSelect.value;
    
    // Only swap if input language is not set to auto
    if (inputLangSelect.value !== 'auto') {
      // Find a matching option in the output select for the current input language
      const inputLangCode = inputLangSelect.value.split('-')[0];
      let matchFound = false;
      
      // Check if a matching option exists in output select
      for (let i = 0; i < outputLangSelect.options.length; i++) {
        if (outputLangSelect.options[i].value === inputLangCode) {
          outputLangSelect.value = inputLangCode;
          matchFound = true;
          break;
        }
      }
      
      // If no match was found, keep the output language the same
      if (matchFound) {
        // Now set the input language to match the previous output language if possible
        for (let i = 0; i < inputLangSelect.options.length; i++) {
          if (inputLangSelect.options[i].value.startsWith(tempOutput)) {
            inputLangSelect.value = inputLangSelect.options[i].value;
            break;
          }
        }
      }
    }
    
    // Swap the text content
    const tempText = inputTextArea.value;
    inputTextArea.value = translatedTextArea.value;
    translatedTextArea.value = tempText;
    
    // If there's text to translate, translate it in the new direction
    if (inputTextArea.value) {
      translateText(inputTextArea.value);
    }
  }

  function toggleListening() {
    if (isLoading) return;
    
    if (!isListening) {
      startListening();
    } else {
      stopListening();
    }
  }

  function startListening() {
    isListening = true;
    isLoading = true;
    toggleButton.innerHTML = '<span class="loading"></span>Processing...';
    toggleButton.classList.add('stop');
    errorDiv.textContent = '';
    errorDiv.classList.remove('visible');
    
    if (!navigator.onLine) {
      showError('You are offline. Please connect to the internet.');
      stopListening();
      return;
    }
    
    const selectedLang = inputLangSelect.value === 'auto' ? 'en-US' : inputLangSelect.value;
    if (recognition.lang !== selectedLang) {
      recognition.lang = selectedLang;
    }
    
    micAnimation.classList.add('active', 'pulsing');
    
    try {
      recognition.start();
      
      recognition.onresult = handleRecognitionResult;
      recognition.onerror = handleRecognitionError;
      recognition.onend = handleRecognitionEnd;
    } catch (error) {
      showError(`Recognition failed to start: ${error.message}`);
      stopListening();
    }
  }

  function handleRecognitionResult(event) {
    const transcript = event.results[event.results.length - 1][0].transcript;
    inputTextArea.value = transcript;
    translateText(transcript);
  }

  function handleRecognitionError(event) {
    showError(`Recognition error: ${event.error}`);
    stopListening();
  }

  function handleRecognitionEnd() {
    if (isListening) {
      try {
        recognition.start();
      } catch (error) {
        showError(`Failed to restart recognition: ${error.message}`);
        stopListening();
      }
    } else {
      isLoading = false;
      toggleButton.textContent = 'Start Translation';
      toggleButton.classList.remove('stop');
      micAnimation.classList.remove('active', 'pulsing');
    }
  }

  function stopListening() {
    isListening = false;
    try {
      recognition.stop();
    } catch (error) {
      console.error('Error stopping recognition:', error);
    }
    
    isLoading = false;
    toggleButton.textContent = 'Start Translation';
    toggleButton.classList.remove('stop');
    micAnimation.classList.remove('active', 'pulsing');
  }

  async function translateText(text) {
    if (!text) return;
    
    isLoading = true;
    errorDiv.textContent = '';
    errorDiv.classList.remove('visible');
    translatedTextArea.value = 'Translating...';
    
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${
          inputLangSelect.value === 'auto' ? 'auto' : inputLangSelect.value.split('-')[0]
        }&tl=${outputLangSelect.value}&dt=t&q=${encodeURIComponent(text)}`
      );
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const data = await response.json();
      const translated = data[0].map(item => item[0]).join('');
      translatedTextArea.value = translated;
      
      // Add to history
      addToHistory(text, translated);
      
      // Automatically trigger TTS for the translated text
      await speakText(translated);
    } catch (err) {
      showError(`Translation error: ${err.message}`);
      translatedTextArea.value = '';
    } finally {
      isLoading = false;
      if (!isListening) toggleButton.textContent = 'Start Translation';
    }
  }

  async function speakText(text) {
    if (!text) return;
    
    try {
      // Release previous audio URL if it exists
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
      }
      
      const response = await fetch('http://localhost:5000/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          langCode: outputLangSelect.value,
          pitch: voiceSettings.pitch,
          speed: voiceSettings.speed
        })
      });
      
      if (!response.ok) throw new Error(`TTS failed: ${response.statusText}`);
      
      const audioBlob = await response.blob();
      currentAudioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(currentAudioUrl);
      audio.play();
      
      // Enable download button now that we have audio
      downloadAudioButton.disabled = false;
    } catch (err) {
      showError(`TTS error: ${err.message}`);
      console.error('TTS error details:', err);
    }
  }

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('visible');
  }

  function updateOfflineStatus() {
    if (navigator.onLine) {
      offlineIndicator.classList.remove('visible');
    } else {
      offlineIndicator.classList.add('visible');
    }
  }

  async function copyToClipboard(textArea) {
    try {
      await navigator.clipboard.writeText(textArea.value);
      showToast('Text copied to clipboard', 'success');
    } catch (err) {
      showToast('Failed to copy text', 'error');
    }
  }

  function clearTextArea(textArea) {
    textArea.value = '';
  }

  async function downloadCurrentAudio() {
    if (!currentAudioUrl) {
      showToast('No audio available to download', 'error');
      return;
    }
    
    try {
      const link = document.createElement('a');
      link.href = currentAudioUrl;
      link.download = `translation_${new Date().toISOString().replace(/[:.]/g, '-')}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Audio download started', 'success');
    } catch (err) {
      showToast('Failed to download audio', 'error');
    }
  }

  function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    
    // Update the icon
    themeToggle.innerHTML = isDarkMode ? '☀️' : '🌙';
  }
  
  function toggleSettingsModal(show) {
    if (show) {
      settingsModal.classList.add('visible');
      // Update slider values
      pitchSlider.value = voiceSettings.pitch;
      speedSlider.value = voiceSettings.speed;
      pitchValue.textContent = voiceSettings.pitch.toFixed(1);
      speedValue.textContent = voiceSettings.speed.toFixed(1);
    } else {
      settingsModal.classList.remove('visible');
    }
  }
  
  function updatePitchValue() {
    const value = parseFloat(pitchSlider.value);
    pitchValue.textContent = value.toFixed(1);
  }
  
  function updateSpeedValue() {
    const value = parseFloat(speedSlider.value);
    speedValue.textContent = value.toFixed(1);
  }
  
  function saveSettings() {
    voiceSettings.pitch = parseFloat(pitchSlider.value);
    voiceSettings.speed = parseFloat(speedSlider.value);
    
    // Save to localStorage
    localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
    
    toggleSettingsModal(false);
    showToast('Voice settings saved', 'success');
  }
  
  function resetSettings() {
    voiceSettings = {
      pitch: 1.0,
      speed: 1.0
    };
    
    pitchSlider.value = 1.0;
    speedSlider.value = 1.0;
    pitchValue.textContent = '1.0';
    speedValue.textContent = '1.0';
    
    // Save to localStorage
    localStorage.setItem('voiceSettings', JSON.stringify(voiceSettings));
    
    showToast('Voice settings reset to default', 'success');
  }
  
  function loadSettings() {
    // Load theme
    const darkMode = localStorage.getItem('darkMode') === 'true';
    if (darkMode) {
      document.body.classList.add('dark-mode');
      themeToggle.innerHTML = '☀️';
    } else {
      themeToggle.innerHTML = '🌙';
    }
    
    // Load voice settings
    const savedVoiceSettings = localStorage.getItem('voiceSettings');
    if (savedVoiceSettings) {
      try {
        voiceSettings = JSON.parse(savedVoiceSettings);
      } catch (error) {
        console.error('Failed to parse voice settings:', error);
        voiceSettings = { pitch: 1.0, speed: 1.0 };
      }
    }
  }
  
  function addToHistory(original, translated) {
    if (!original || !translated) return;
    
    const historyItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      original,
      translated,
      fromLang: inputLangSelect.options[inputLangSelect.selectedIndex].text,
      toLang: outputLangSelect.options[outputLangSelect.selectedIndex].text,
      fromLangCode: inputLangSelect.value,
      toLangCode: outputLangSelect.value
    };
    
    translationHistory.unshift(historyItem);
    
    // Limit history to 20 items
    if (translationHistory.length > 20) {
      translationHistory.pop();
    }
    
    // Save to localStorage
    localStorage.setItem('translationHistory', JSON.stringify(translationHistory));
    
    // Update the UI
    renderHistory();
    historySection.classList.add('visible');
  }
  
  function loadTranslationHistory() {
    const savedHistory = localStorage.getItem('translationHistory');
    if (savedHistory) {
      try {
        translationHistory = JSON.parse(savedHistory);
        renderHistory();
        if (translationHistory.length > 0) {
          historySection.classList.add('visible');
        }
      } catch (error) {
        console.error('Failed to parse translation history:', error);
        translationHistory = [];
      }
    }
  }
  
  function renderHistory() {
    historyList.innerHTML = '';
    
    translationHistory.forEach(item => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      
      historyItem.innerHTML = `
        <div class="history-languages">
          <span>${item.fromLang}</span>
          <span>${item.toLang}</span>
        </div>
        <div class="history-text-pair">
          <div class="history-text">
            <div class="history-text-label">Original</div>
            <p>${item.original}</p>
          </div>
          <div class="history-text">
            <div class="history-text-label">Translated</div>
            <p>${item.translated}</p>
          </div>
        </div>
        <div class="history-actions">
          <button class="icon-button reuse-translation" data-id="${item.id}">
            <i class="fa-solid fa-arrow-rotate-left"></i> Reuse
          </button>
          <button class="icon-button speak-translation" data-text="${encodeURIComponent(item.translated)}" data-lang="${item.toLangCode}">
            <i class="fa-solid fa-volume-high"></i> Speak
          </button>
        </div>
      `;
      
      historyList.appendChild(historyItem);
    });
    
    // Add event listeners to history item buttons
    document.querySelectorAll('.reuse-translation').forEach(button => {
      button.addEventListener('click', () => {
        const id = parseInt(button.getAttribute('data-id'));
        const item = translationHistory.find(h => h.id === id);
        if (item) {
          inputTextArea.value = item.original;
          translatedTextArea.value = item.translated;
          
          // Set languages if possible
          if (item.fromLangCode) {
            for (let i = 0; i < inputLangSelect.options.length; i++) {
              if (inputLangSelect.options[i].value === item.fromLangCode) {
                inputLangSelect.value = item.fromLangCode;
                break;
              }
            }
          }
          
          if (item.toLangCode) {
            outputLangSelect.value = item.toLangCode;
          }
        }
      });
    });
    
    document.querySelectorAll('.speak-translation').forEach(button => {
      button.addEventListener('click', () => {
        const text = decodeURIComponent(button.getAttribute('data-text'));
        const lang = button.getAttribute('data-lang');
        
        // Store the current output language
        const currentOutputLang = outputLangSelect.value;
        
        // Temporarily set the output language to the history item's language
        outputLangSelect.value = lang;
        
        // Speak the text
        speakText(text).then(() => {
          // Restore the original output language
          outputLangSelect.value = currentOutputLang;
        });
      });
    });
  }
  
  function clearTranslationHistory() {
    translationHistory = [];
    localStorage.removeItem('translationHistory');
    historyList.innerHTML = '';
    historySection.classList.remove('visible');
    showToast('Translation history cleared', 'success');
  }
  
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Force reflow
    toast.offsetHeight;
    
    // Show the toast
    toast.classList.add('visible');
    
    // Hide after 3 seconds
    setTimeout(() => {
      toast.classList.remove('visible');
      
      // Remove from DOM after animation completes
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
});