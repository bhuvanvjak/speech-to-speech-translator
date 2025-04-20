process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:/Users/vukke/keys/solid-course-414704-db7457806919.json';    

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const textToSpeech = require('@google-cloud/text-to-speech');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const ttsClient = new textToSpeech.TextToSpeechClient();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const languageMap = {
  en: { languageCode: 'en-US', voiceName: 'en-US-Wavenet-D' },
  hi: { languageCode: 'hi-IN', voiceName: 'hi-IN-Wavenet-A' },
  ta: { languageCode: 'ta-IN', voiceName: 'ta-IN-Wavenet-A' },
  te: { languageCode: 'te-IN', voiceName: 'te-IN-Standard-A' },
  kn: { languageCode: 'kn-IN', voiceName: 'kn-IN-Wavenet-A' },
  ml: { languageCode: 'ml-IN', voiceName: 'ml-IN-Wavenet-A' },
  bn: { languageCode: 'bn-IN', voiceName: 'bn-IN-Wavenet-A' },
  mr: { languageCode: 'mr-IN', voiceName: 'mr-IN-Wavenet-A' },
  gu: { languageCode: 'gu-IN', voiceName: 'gu-IN-Wavenet-A' },
  pa: { languageCode: 'pa-IN', voiceName: 'pa-IN-Wavenet-A' },
  ur: { languageCode: 'ur-IN', voiceName: 'ur-IN-Wavenet-A' },
  es: { languageCode: 'es-ES', voiceName: 'es-ES-Wavenet-B' },
  zh: { languageCode: 'zh-CN', voiceName: 'zh-CN-Wavenet-A' },
  'zh-cn': { languageCode: 'zh-CN', voiceName: 'zh-CN-Wavenet-A' },
  ru: { languageCode: 'ru-RU', voiceName: 'ru-RU-Wavenet-D' },
  ja: { languageCode: 'ja-JP', voiceName: 'ja-JP-Wavenet-B' },
  ko: { languageCode: 'ko-KR', voiceName: 'ko-KR-Wavenet-A' },
  de: { languageCode: 'de-DE', voiceName: 'de-DE-Wavenet-F' },
  fr: { languageCode: 'fr-FR', voiceName: 'fr-FR-Wavenet-C' },
};

app.post('/speak', async (req, res) => {
  const { text, langCode, pitch = 1.0, speed = 1.0 } = req.body;

  const language = languageMap[langCode.split('-')[0]] || languageMap['en'];

  console.log("Incoming TTS Request:", {
    text,
    langCode,
    pitch,
    speed,
    mappedLanguage: language.languageCode
  });

  const request = {
    input: { text },
    voice: {
      languageCode: language.languageCode,
      name: language.voiceName,
      ssmlGender: 'NEUTRAL'
    },
    audioConfig: { 
      audioEncoding: 'MP3',
      pitch: parseFloat(pitch),
      speakingRate: parseFloat(speed)
    },
  };

  try {
    const [response] = await ttsClient.synthesizeSpeech(request);
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.audioContent);
  } catch (err) {
    console.error('TTS error:', err.message);
    res.status(500).send('Failed to synthesize speech');
  }
});

app.post('/save-transcript', async (req, res) => {
  const { original, translated, fromLang, toLang } = req.body;
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `transcript_${timestamp}.txt`;
  
  const content = `
Translation Record
-----------------
Date: ${new Date().toLocaleString()}
From: ${fromLang}
To: ${toLang}

Original Text:
${original}

Translated Text:
${translated}
`;

  try {
    const filePath = path.join(__dirname, 'public', 'transcripts', filename);
    await fs.mkdir(path.join(__dirname, 'public', 'transcripts'), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    res.json({ success: true, filename });
  } catch (err) {
    console.error('Error saving transcript:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('New client connected');
  socket.on('offer', (offer) => socket.broadcast.emit('offer', offer));
  socket.on('answer', (answer) => socket.broadcast.emit('answer', answer));
  socket.on('candidate', (candidate) => socket.broadcast.emit('candidate', candidate));
  socket.on('disconnect', () => console.log('Client disconnected'));
});

server.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});