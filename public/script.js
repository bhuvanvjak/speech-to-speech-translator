// ✅ script.js (Frontend)
document.addEventListener('DOMContentLoaded', () => {
  const inputLangSelect = document.getElementById('inputLang');
  const outputLangSelect = document.getElementById('outputLang');
  const toggleButton = document.getElementById('toggleButton');
  const inputTextArea = document.getElementById('inputText');
  const translatedTextArea = document.getElementById('translatedText');
  const errorDiv = document.getElementById('error');
  let recognition = null;
  let isListening = false;
  let isLoading = false;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => console.log('Service Worker registered:', registration.scope))
      .catch((error) => console.error('SW registration failed:', error));
  }

  if (!('webkitSpeechRecognition' in window)) {
    errorDiv.textContent = 'Web Speech API is not supported. Use Chrome.';
    return;
  }

  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = inputLangSelect.value;

  inputLangSelect.addEventListener('change', () => {
    if (!isListening) {
      const newLang = inputLangSelect.value === 'auto' ? 'en-US' : inputLangSelect.value;
      recognition.lang = newLang;
    }
  });

  toggleButton.addEventListener('click', () => {
    if (isLoading) return;
    if (!isListening) startListening();
    else stopListening();
  });

  function startListening() {
    isListening = true;
    isLoading = true;
    toggleButton.textContent = 'Processing...';
    toggleButton.classList.add('stop');
    errorDiv.textContent = '';

    if (!navigator.onLine) {
      errorDiv.textContent = 'Offline. Please connect to the internet.';
      stopListening();
      return;
    }

    const selectedLang = inputLangSelect.value === 'auto' ? 'en-US' : inputLangSelect.value;
    if (recognition.lang !== selectedLang) {
      recognition.lang = selectedLang;
    }

    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript;
      inputTextArea.value = transcript;
      translateText(transcript);
    };

    recognition.onerror = (event) => {
      errorDiv.textContent = `Recognition error: ${event.error}`;
      stopListening();
    };

    recognition.onend = () => {
      if (isListening) recognition.start();
      else {
        isLoading = false;
        toggleButton.textContent = 'Start Translation';
        toggleButton.classList.remove('stop');
      }
    };
  }

  function stopListening() {
    isListening = false;
    recognition.stop();
    isLoading = false;
    toggleButton.textContent = 'Start Translation';
    toggleButton.classList.remove('stop');
  }

  async function translateText(text) {
    if (!text) return;
    isLoading = true;
    errorDiv.textContent = '';
    translatedTextArea.value = 'Translating...';

    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${inputLangSelect.value === 'auto' ? 'en' : inputLangSelect.value.split('-')[0]}&tl=${outputLangSelect.value}&dt=t&q=${encodeURIComponent(text)}`
      );
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const translated = data[0][0][0];
      translatedTextArea.value = translated;

      // Automatically trigger TTS for the translated text
      const langCodeMap = {
        'en': 'en-US', 'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN', 'kn': 'kn-IN',
        'ml': 'ml-IN', 'bn': 'bn-IN', 'mr': 'mr-IN', 'gu': 'gu-IN', 'pa': 'pa-IN', 'ur': 'ur-IN'
      };
      const ttsLangCode = langCodeMap[outputLangSelect.value] || 'en-US';
      await speakText(translated, ttsLangCode);
    } catch (err) {
      errorDiv.textContent = `Translation error: ${err.message}`;
    } finally {
      isLoading = false;
      if (!isListening) toggleButton.textContent = 'Start Translation';
    }
  }

  async function speakText(text, langCode) {
    if (!text) return;

    try {
      const response = await fetch('http://localhost:5000/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, langCode })
      });

      if (!response.ok) throw new Error(`TTS failed: ${response.statusText}`);
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (err) {
      errorDiv.textContent = `TTS error: ${err.message}`;
      console.error('TTS error details:', err);
    }
  }
});


// ✅ server.js (Backend) update (no change needed in mapping logic)
// Just ensure langCode comes as something like 'hi-IN', 'ta-IN', etc.

// Already correct:
// const mappedLang = languageMap[langCode] || 'en-US';
