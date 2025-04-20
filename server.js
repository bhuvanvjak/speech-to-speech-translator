process.env.GOOGLE_APPLICATION_CREDENTIALS = 'C:/Users/vukke/keys/solid-course-414704-db7457806919.json';    

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const textToSpeech = require('@google-cloud/text-to-speech');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const ttsClient = new textToSpeech.TextToSpeechClient();

app.use(cors());
app.use(bodyParser.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const languageMap = {
  en: { languageCode: 'en-US', voiceName: 'en-US-Wavenet-D' }, // Default English voice
  hi: { languageCode: 'hi-IN', voiceName: 'hi-IN-Wavenet-A' }, // Hindi voice
  ta: { languageCode: 'ta-IN', voiceName: 'ta-IN-Wavenet-A' }, // Tamil voice
  te: { languageCode: 'te-IN', voiceName: 'te-IN-Standard-A' }, // Telugu voice
  kn: { languageCode: 'kn-IN', voiceName: 'kn-IN-Wavenet-A' }, // Kannada voice
  ml: { languageCode: 'ml-IN', voiceName: 'ml-IN-Wavenet-A' }, // Malayalam voice
  bn: { languageCode: 'bn-IN', voiceName: 'bn-IN-Wavenet-A' }, // Bengali voice
  mr: { languageCode: 'mr-IN', voiceName: 'mr-IN-Wavenet-A' }, // Marathi voice
  gu: { languageCode: 'gu-IN', voiceName: 'gu-IN-Wavenet-A' }, // Gujarati voice
  pa: { languageCode: 'pa-IN', voiceName: 'pa-IN-Wavenet-A' }, // Punjabi voice
  ur: { languageCode: 'ur-IN', voiceName: 'ur-IN-Wavenet-A' }, // Urdu voice
};

app.post('/speak', async (req, res) => {
  const { text, langCode } = req.body;

  // Corrected mapping logic
  const language = languageMap[langCode.split('-')[0]] || languageMap['en'];

  console.log("Incoming TTS Request:");
  console.log("Text:", text);
  console.log("langCode from frontend:", langCode);
  console.log("Mapped Google TTS language code:", language.languageCode);  // Corrected to use `language.languageCode`

  const request = {
    input: { text },
    voice: {
      languageCode: language.languageCode,  // Corrected to use `language.languageCode`
      name: language.voiceName,  // Corrected to use `language.voiceName`
      ssmlGender: 'NEUTRAL'
    },
    audioConfig: { audioEncoding: 'MP3' },
  };

  console.log("Google TTS Request Object:", request);

  try {
    const [response] = await ttsClient.synthesizeSpeech(request);
    res.set('Content-Type', 'audio/mpeg');
    res.send(response.audioContent);
  } catch (err) {
    console.error('TTS error:', err.message);
    res.status(500).send('Failed to synthesize speech');
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
