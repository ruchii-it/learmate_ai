import { useEffect, useMemo, useRef, useState } from 'react';
import LearningWorkspace from './LearningWorkspace';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Gauge,
  Languages,
  Lightbulb,
  Mic,
  MicOff,
  Play,
  Presentation,
  RotateCcw,
  Square,
  Video,
  Waves,
} from 'lucide-react';

type Mode = 'learning' | 'viva' | 'presentation';
type Language = 'English' | 'Hindi';
type SpeechRecognitionEventLike = Event & { results: SpeechRecognitionResultList };
type SpeechRecognitionErrorEventLike = Event & { error: string };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

type VivaQuestion = {
  question: string;
  questionHindi: string;
  concepts: string[];
  conceptLabels: string[];
  ideal: string;
};

type VivaAnswer = {
  question: string;
  answer: string;
  matched: string[];
  missing: string[];
  score: number;
};

const topic = 'Renewable Energy in India';
const questions: VivaQuestion[] = [
  {
    question: 'Why is renewable energy important for India’s future?',
    questionHindi: 'भारत के भविष्य के लिए नवीकरणीय ऊर्जा क्यों महत्वपूर्ण है?',
    concepts: ['solar', 'wind', 'emission', 'energy security'],
    conceptLabels: ['Solar and wind potential', 'Lower emissions', 'Energy security'],
    ideal: 'Renewable energy uses India’s strong solar and wind potential to reduce emissions, improve energy security, and meet growing demand without relying only on imported fuels.',
  },
  {
    question: 'What are two challenges to scaling solar and wind power in India?',
    questionHindi: 'भारत में सौर और पवन ऊर्जा बढ़ाने की दो चुनौतियाँ क्या हैं?',
    concepts: ['storage', 'grid', 'land', 'intermittent'],
    conceptLabels: ['Intermittent supply', 'Storage', 'Grid capacity', 'Land or transmission'],
    ideal: 'Solar and wind are intermittent, so India needs storage and a stronger grid. Land availability and transmission from high-resource regions are also important challenges.',
  },
  {
    question: 'How can India make its clean-energy transition more inclusive?',
    questionHindi: 'भारत अपने स्वच्छ ऊर्जा परिवर्तन को अधिक समावेशी कैसे बना सकता है?',
    concepts: ['jobs', 'community', 'affordable', 'training'],
    conceptLabels: ['Affordable access', 'Local jobs', 'Community participation', 'Skills training'],
    ideal: 'The transition should keep electricity affordable, include local communities in decisions and benefits, and invest in skills training so new clean-energy jobs are accessible.',
  },
];

const hindiQuestions: VivaQuestion[] = questions.map((item) => ({
  ...item,
  question: item.questionHindi,
  ideal: item.ideal,
}));

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

function getVivaResult(question: VivaQuestion, answer: string): VivaAnswer {
  const normalized = answer.toLowerCase();
  const matched = question.concepts.filter((concept) => normalized.includes(concept));
  const score = Math.round((matched.length / question.concepts.length) * 100);
  return {
    question: question.question,
    answer,
    matched,
    missing: question.conceptLabels.filter((_, index) => !matched[index]),
    score,
  };
}

function App() {
  const [mode, setMode] = useState<Mode>('learning');
  const [language, setLanguage] = useState<Language>('English');
  const [vivaIndex, setVivaIndex] = useState(0);
  const [vivaDraft, setVivaDraft] = useState('');
  const [vivaAnswers, setVivaAnswers] = useState<VivaAnswer[]>([]);
  const [vivaListening, setVivaListening] = useState(false);
  const [vivaError, setVivaError] = useState('');
  const [presentationError, setPresentationError] = useState('');
  const vivaRecognition = useRef<SpeechRecognitionLike | null>(null);
  const questionsForLanguage = language === 'Hindi' ? hindiQuestions : questions;

  const startVivaSpeech = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setVivaError('Speech recognition is not supported in this browser. You can type your answer instead.');
      return;
    }
    setVivaError('');
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'Hindi' ? 'hi-IN' : 'en-IN';
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setVivaDraft(transcript.trim());
    };
    recognition.onerror = (event) => {
      setVivaListening(false);
      setVivaError(`Microphone transcription could not start: ${event.error}. You can type your answer instead.`);
    };
    recognition.onend = () => setVivaListening(false);
    vivaRecognition.current = recognition;
    try {
      recognition.start();
      setVivaListening(true);
    } catch {
      setVivaListening(false);
      setVivaError('The microphone is already in use or unavailable. You can type your answer instead.');
    }
  };

  const stopVivaSpeech = () => {
    vivaRecognition.current?.stop();
    vivaRecognition.current = null;
    setVivaListening(false);
  };

  const submitViva = () => {
    const answer = vivaDraft.trim();
    if (!answer) {
      setVivaError(language === 'Hindi' ? 'कृपया उत्तर बोलें या लिखें।' : 'Please speak or type an answer before submitting.');
      return;
    }
    stopVivaSpeech();
    setVivaAnswers((current) => [...current, getVivaResult(questionsForLanguage[vivaIndex], answer)]);
    setVivaDraft('');
    setVivaError('');
    setVivaIndex((current) => current + 1);
  };

  const resetViva = () => {
    stopVivaSpeech();
    setVivaIndex(0);
    setVivaDraft('');
    setVivaAnswers([]);
    setVivaError('');
  };

  useEffect(() => () => stopVivaSpeech(), []);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">LM</span><span>LearnMate <em>AI</em></span></div>
        <nav className="main-nav" aria-label="Main navigation">
          <button>Dashboard</button><button className={mode === 'learning' ? 'active' : ''} onClick={() => setMode('learning')}>Study Hub</button><button className={mode !== 'learning' ? 'active' : ''} onClick={() => setMode('presentation')}>Practice</button><button>Library</button><button>Settings</button>
        </nav>
        <div className="top-actions"><div className="search"><CircleHelp size={16} /><span>Practice workspace</span></div><div className="avatar">SJ</div><span className="user-name">Sarah J.</span><button className="end-session">End Session</button></div>
      </header>

      <main className="page-content">
        <div className="page-heading">
          <div><div className="eyebrow">{mode === 'learning' ? 'Adaptive learning workspace' : `Practice studio / ${topic}`}</div><h1>{mode === 'learning' ? 'Learn with intention' : `Mock ${mode === 'viva' ? 'Viva' : 'Presentation'}`}</h1><p>{mode === 'learning' ? 'Choose a subject, test your understanding, and build a learning record that reflects what you actually know.' : 'Build confidence with a focused, honest practice session.'}</p></div>
          <div className="selectors"><label><Languages size={15} /> Language<select value={language} onChange={(event) => setLanguage(event.target.value as Language)}><option>English</option><option>Hindi</option></select></label></div>
        </div>

        <div className="mode-switcher" role="tablist" aria-label="Practice type">
          <button className={mode === 'learning' ? 'selected' : ''} onClick={() => setMode('learning')}><BookOpen size={18} /> Study Hub</button>
          <button className={mode === 'presentation' ? 'selected' : ''} onClick={() => setMode('presentation')}><Presentation size={18} /> Mock Presentation</button>
          <button className={mode === 'viva' ? 'selected' : ''} onClick={() => setMode('viva')}><Waves size={18} /> Mock Viva</button>
        </div>

        {mode === 'learning' ? <LearningWorkspace /> : mode === 'presentation' ? <PresentationStudio error={presentationError} setError={setPresentationError} /> : <VivaStudio index={vivaIndex} draft={vivaDraft} setDraft={setVivaDraft} answers={vivaAnswers} listening={vivaListening} error={vivaError} startSpeech={startVivaSpeech} stopSpeech={stopVivaSpeech} submit={submitViva} reset={resetViva} language={language} questions={questionsForLanguage} />}
      </main>
    </div>
  );
}

type VivaStudioProps = {
  index: number;
  draft: string;
  setDraft: (value: string) => void;
  answers: VivaAnswer[];
  listening: boolean;
  error: string;
  startSpeech: () => void;
  stopSpeech: () => void;
  submit: () => void;
  reset: () => void;
  language: Language;
  questions: VivaQuestion[];
};

function VivaStudio({ index, draft, setDraft, answers, listening, error, startSpeech, stopSpeech, submit, reset, language, questions }: VivaStudioProps) {
  const complete = index >= questions.length;
  const totalScore = answers.length ? Math.round(answers.reduce((total, answer) => total + answer.score, 0) / answers.length) : 0;
  const labels = language === 'Hindi' ? { question: 'प्रश्न', answer: 'आपका उत्तर', speak: 'उत्तर बोलें', stop: 'रिकॉर्डिंग रोकें', submit: 'उत्तर जमा करें', retry: 'फिर से शुरू करें', report: 'वाइवा रिपोर्ट', strength: 'मजबूत बिंदु', improve: 'सुधार के क्षेत्र', ideal: 'आदर्श उत्तर' } : { question: 'Question', answer: 'Your answer', speak: 'Speak answer', stop: 'Stop listening', submit: 'Submit answer', retry: 'Start again', report: 'Viva report', strength: 'Strengths', improve: 'Areas to improve', ideal: 'Ideal answer' };

  return <div className="viva-layout">
    <section className="studio-card viva-card">
      {!complete ? <>
        <div className="card-topline"><span className="status-dot" /> Question {index + 1} of {questions.length}<span className="topline-meta">Actual answer capture</span></div>
        <div className="question-block"><span className="question-label">{labels.question}</span><h2>{questions[index].question}</h2><p>Answer in your own words. You can edit the transcript before submitting.</p></div>
        <div className="answer-label"><span>{labels.answer}</span>{listening && <span className="listening"><span className="pulse" /> Listening…</span>}</div>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={language === 'Hindi' ? 'अपना उत्तर यहाँ लिखें या माइक्रोफ़ोन से बोलें…' : 'Speak or type your answer here…'} />
        {error && <div className="inline-error"><AlertTriangle size={16} />{error}</div>}
        <div className="studio-actions"><button className="secondary-button" onClick={listening ? stopSpeech : startSpeech}>{listening ? <MicOff size={17} /> : <Mic size={17} />}{listening ? labels.stop : labels.speak}</button><button className="primary-button" onClick={submit}>{labels.submit}<ChevronRight size={17} /></button></div>
        <div className="privacy-note"><Mic size={14} /> Only your current answer is used for this session report.</div>
      </> : <VivaReport answers={answers} score={totalScore} labels={labels} reset={reset} />}
    </section>
    <aside className="studio-card side-card"><div className="side-icon"><Gauge size={20} /></div><h3>How this works</h3><p>Each answer is checked against the key concepts for the question. Your report is based on what you actually submit.</p><div className="progress-list">{questions.map((item, questionIndex) => <div className="progress-row" key={item.question}><span className={questionIndex < index ? 'done' : questionIndex === index ? 'current' : ''}>{questionIndex < index ? <Check size={13} /> : questionIndex + 1}</span><div><strong>Question {questionIndex + 1}</strong><small>{questionIndex < index ? 'Submitted' : questionIndex === index ? 'In progress' : 'Waiting'}</small></div></div>)}</div></aside>
  </div>;
}

function VivaReport({ answers, score, labels, reset }: { answers: VivaAnswer[]; score: number; labels: Record<string, string>; reset: () => void }) {
  const strengths = answers.flatMap((answer) => answer.matched).slice(0, 4);
  const missing = answers.flatMap((answer) => answer.missing).slice(0, 5);
  return <div className="report-view"><div className="report-heading"><div><span className="eyebrow">Session complete</span><h2>{labels.report}</h2></div><div className="score-ring"><strong>{score}</strong><span>/ 100</span></div></div><div className="report-grid"><div className="metric"><span>Questions answered</span><strong>{answers.length}</strong></div><div className="metric"><span>Average score</span><strong>{score}%</strong></div><div className="metric"><span>Concepts found</span><strong>{answers.reduce((total, answer) => total + answer.matched.length, 0)}</strong></div></div><div className="report-section"><h3>{labels.strength}</h3><p>{strengths.length ? strengths.join(' · ') : 'No key concepts were detected in the submitted answers.'}</p><h3>{labels.improve}</h3><p>{missing.length ? missing.join(' · ') : 'All listed concepts appeared in your submitted answers.'}</p></div><div className="feedback-list">{answers.map((answer, index) => <article key={`${answer.question}-${index}`}><div className="feedback-title"><span>Q{index + 1}</span><strong>{answer.score}%</strong></div><p>{answer.question}</p><small>Submitted: “{answer.answer}”</small><div className="feedback-columns"><div><b>Missing concepts</b><span>{answer.missing.length ? answer.missing.join(', ') : 'None detected'}</span></div><div><b>{labels.ideal}</b><span>{questions[index].ideal}</span></div></div></article>)}</div><button className="secondary-button" onClick={reset}><RotateCcw size={17} /> {labels.retry}</button></div>;
}

function PresentationStudio({ error, setError }: { error: string; setError: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState('');
  const [transcript, setTranscript] = useState('');
  const [transcriptAvailable, setTranscriptAvailable] = useState(false);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStreamReady(false);
  };

  useEffect(() => () => { stopTracks(); recognitionRef.current?.stop(); if (recordedUrl) URL.revokeObjectURL(recordedUrl); }, [recordedUrl]);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  const startRecognition = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setTranscriptAvailable(false);
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.onresult = (event) => {
      let next = '';
      for (let index = 0; index < event.results.length; index += 1) next += event.results[index][0].transcript;
      setTranscript(next.trim());
      setTranscriptAvailable(Boolean(next.trim()));
    };
    recognition.onerror = () => setTranscriptAvailable(false);
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setTranscriptAvailable(false); }
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('This browser does not support camera recording. Try a current version of Chrome, Edge, or Safari.');
      return;
    }
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStreamReady(true);
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(URL.createObjectURL(blob));
      };
      recorderRef.current = recorder;
      recorder.start();
      setElapsed(0);
      setTranscript('');
      setTranscriptAvailable(false);
      setRecording(true);
      startRecognition();
    } catch (reason) {
      stopTracks();
      const message = reason instanceof DOMException && reason.name === 'NotAllowedError' ? 'Camera and microphone permission was not granted. Allow both devices to begin recording.' : 'Camera or microphone could not be opened. Check that another app is not using them.';
      setError(message);
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  };

  const retake = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(''); setTranscript(''); setTranscriptAvailable(false); setElapsed(0); setError('');
  };

  const topicCoverage = useMemo(() => ['solar', 'wind', 'storage', 'grid', 'jobs', 'community'].filter((keyword) => transcript.toLowerCase().includes(keyword)), [transcript]);
  return <div className="presentation-layout">
    <section className="preview-card"><div className="card-topline"><span className={`status-dot ${recording ? 'recording-dot' : ''}`} /> {recording ? 'Live recording' : streamReady ? 'Camera ready' : 'Camera preview'}<span className="topline-meta">{recording ? <><span className="rec-pill"><span /> REC {formatDuration(elapsed)}</span></> : 'Permission required before start'}</span></div><div className="video-frame">{recordedUrl && !recording ? <video ref={playbackRef} src={recordedUrl} controls playsInline /> : <video ref={videoRef} muted playsInline />}{!streamReady && !recordedUrl && <div className="camera-empty"><Video size={32} /><strong>Your camera preview will appear here</strong><span>Camera and microphone stay local to this practice session.</span></div>}{recording && <span className="video-badge"><span /> REC {formatDuration(elapsed)}</span>}</div><div className="preview-footer"><span><Clock3 size={15} /> {formatDuration(elapsed)}</span><span><Mic size={15} /> Audio {streamReady ? 'connected' : 'not connected'}</span><span><Video size={15} /> Video {streamReady ? 'connected' : 'not connected'}</span></div></section>
    <aside className="studio-card control-card"><div className="eyebrow">Mock presentation</div><h2>{topic}</h2><p className="focus-copy">Focus: Solar & wind adoption, challenges, and an inclusive transition.</p><div className="record-controls"><button className="primary-button" onClick={start} disabled={recording}><Play size={17} /> {recording ? 'Recording' : 'Start'}</button><button className="outline-button" onClick={stop} disabled={!recording}><Square size={16} /> Stop</button><button className="outline-button" onClick={() => playbackRef.current?.play()} disabled={!recordedUrl || recording}><Play size={16} /> Play preview</button><button className="outline-button" onClick={retake} disabled={!recordedUrl && !streamReady}><RotateCcw size={16} /> Retake</button></div>{error && <div className="inline-error"><AlertTriangle size={16} />{error}</div>}<div className="transcript-box"><div className="transcript-heading"><span>Live transcript</span><span className={transcriptAvailable ? 'available' : ''}>{transcriptAvailable ? 'Available' : 'Optional'}</span></div><p>{transcript || 'Transcript appears here when browser speech recognition is available and captures your presentation.'}</p></div><div className="honesty-note"><Lightbulb size={16} /><span>No eye-contact, body-language, or confidence score is invented. This report uses only the recording duration and captured transcript.</span></div></aside>
    <PresentationReport duration={elapsed} transcript={transcript} topics={topicCoverage} hasRecording={Boolean(recordedUrl)} />
  </div>;
}

function PresentationReport({ duration, transcript, topics, hasRecording }: { duration: number; transcript: string; topics: string[]; hasRecording: boolean }) {
  const plan = topics.length < 3 ? ['Explain one more concrete example from India.', 'Connect the challenge to a practical solution.', 'Rehearse the opening and closing once more.'] : ['Add evidence or a statistic to support each section.', 'Practice smoother transitions between ideas.', 'Finish with a concise takeaway for your audience.'];
  return <section className="report-card"><div className="report-title"><div><span className="eyebrow">{hasRecording ? 'Based on this recording' : 'Waiting for a recording'}</span><h2>Presentation report</h2></div><FileText size={22} /></div>{hasRecording ? <div className="presentation-report-grid"><div className="report-stat"><span>Duration</span><strong>{formatDuration(duration)}</strong><small>Actual recording</small></div><div className="report-stat"><span>Topics covered</span><strong>{transcript ? `${topics.length}/6` : '—'}</strong><small>{transcript ? (topics.length ? topics.join(', ') : 'No topic keywords detected') : 'Transcript unavailable'}</small></div><div className="practice-plan"><span>Practice plan</span><ol>{plan.map((item) => <li key={item}>{item}</li>)}</ol></div></div> : <p className="empty-report">Complete a recording to generate duration, transcript coverage, and a practice plan from the data available in this session.</p>}</section>;
}

export default App;
