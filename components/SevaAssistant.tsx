
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';

interface SevaAssistantProps {
  onCommand?: (command: string) => void;
}

export const SevaAssistant: React.FC<SevaAssistantProps> = ({ onCommand }) => {
  const [isActive, setIsActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [transcription, setTranscription] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number) => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
      }
    }
    return buffer;
  };

  const startSession = async () => {
    try {
      // Створюємо новий екземпляр безпосередньо перед використанням, щоб гарантувати використання останнього ключа API
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              
              let binary = '';
              const bytes = new Uint8Array(int16.buffer);
              for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
              const base64 = btoa(binary);

              // Використовуємо sessionPromise для запобігання станам гонитви
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: any) => {
            if (msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data) {
              setIsSpeaking(true);
              const audioBuffer = await decodeAudioData(
                decode(msg.serverContent.modelTurn.parts[0].inlineData.data),
                outputCtx, 24000, 1
              );
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsSpeaking(false);
              };
            }
            if (msg.serverContent?.inputTranscription) {
              setTranscription(msg.serverContent.inputTranscription.text);
            }
            if (msg.serverContent?.turnComplete) {
              setTranscription(t => {
                if (onCommand && t) onCommand(t);
                return '';
              });
            }
            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onerror: (e) => console.error("SEVA Error", e),
          onclose: () => setIsActive(false),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
          systemInstruction: "Ти - СЕВА, спортивний помічник Асоціації ветеранів волейболу України. Спілкуйся по-чоловічому, професійно. Допомагай створювати події, генерувати фото, та керувати додатком. Ти завжди на зв'язку у плаваючому віджеті.",
        }
      });

      sessionRef.current = await sessionPromise;
      setIsActive(true);
      setIsMinimized(false);
    } catch (err) {
      console.error("Failed to start SEVA", err);
    }
  };

  const stopSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsActive(false);
    setIsMinimized(true);
  };

  if (!isVisible) return (
    <button onClick={() => setIsVisible(true)} className="fixed bottom-6 right-6 bg-blue-900 text-white w-12 h-12 rounded-full shadow-2xl z-50 flex items-center justify-center font-bold">🦾</button>
  );

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex flex-col items-end transition-all duration-300 ${isMinimized ? 'w-16' : 'w-72'}`}>
      <div className={`bg-white rounded-[2rem] shadow-2xl border border-blue-100 overflow-hidden mb-3 transition-all duration-300 transform ${isMinimized ? 'scale-0 h-0 opacity-0' : 'scale-100 h-auto opacity-100 p-6'}`}>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
            <span className="font-black text-blue-900 text-sm">СЕВА ШІ</span>
          </div>
          <button onClick={() => setIsMinimized(true)} className="text-gray-400 hover:text-blue-900">_</button>
        </div>
        <div className="min-h-[80px] flex items-center justify-center">
          <p className="text-xl text-blue-950 font-black italic text-center leading-tight">
            {transcription || "Вітаю! Як я можу допомогти вам сьогодні?"}
          </p>
        </div>
        <div className="mt-4 flex gap-2">
           <button onClick={stopSession} className="flex-1 bg-red-50 text-red-600 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors">Вимкнути</button>
           <button onClick={() => setIsVisible(false)} className="flex-1 bg-gray-50 text-gray-400 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-colors">Приховати</button>
        </div>
      </div>

      <button
        onClick={() => {
          if (isMinimized) {
            if (isActive) {
              setIsMinimized(false);
            } else {
              startSession();
            }
          } else {
            setIsMinimized(true);
          }
        }}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all transform hover:scale-110 relative ${
          isActive ? 'bg-blue-600 text-white' : 'bg-blue-950 text-white'
        }`}
      >
        <span className="text-2xl">{isActive ? '🏐' : '🦾'}</span>
        {isActive && !isMinimized && <div className="absolute inset-0 border-4 border-blue-400 rounded-full animate-ping opacity-20" />}
      </button>
    </div>
  );
};
