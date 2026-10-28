import { useEffect, useRef, useState } from 'react';
import { BookOpen, Brain, Check, ChevronRight, CircleHelp, Eye, Flame, Lightbulb, ListChecks, Mic, Pause, Play, RotateCcw, Send, Sparkles, Square, Target, TriangleAlert, Volume2 } from 'lucide-react';
import { Difficulty, ExplanationStyle, Subject, TopicContent, subjects, topicsForSubject } from './learningData';
import { TopicVisualizer } from './Visualizers';

type LearningLanguage = 'English' | 'Hindi' | 'Hinglish';
type LearningTab = 'lesson' | 'debugger' | 'quiz' | 'progress';
type DiagnosticResult = { correct: boolean; matched: string[]; feedback: string };
type ProgressState = {
  viewed: string[];
  studied: string[];
  verified: string[];
  diagnostics: { topic: string; correct: boolean; date: string }[];
  quizzes: { topic: string; score: number; total: number; date: string }[];
  missed: string[];
  sessions: { topic: string; action: string; date: string }[];
};

const progressKey = 'learnmate-learning-progress';
const emptyProgress: ProgressState = { viewed: [], studied: [], verified: [], diagnostics: [], quizzes: [], missed: [], sessions: [] };

function loadProgress(): ProgressState {
  try {
    const saved = localStorage.getItem(progressKey);
    return saved ? { ...emptyProgress, ...JSON.parse(saved) as ProgressState } : emptyProgress;
  } catch {
    return emptyProgress;
  }
}

function saveProgress(progress: ProgressState): void {
  localStorage.setItem(progressKey, JSON.stringify(progress));
}

function addUnique(items: string[], value: string): string[] {
  return items.includes(value) ? items : [...items, value];
}

function assessAnswer(answer: string, expected: string, concept: string): DiagnosticResult {
  const terms = expected.toLowerCase().split(/\W+/).filter((term) => term.length > 3).slice(0, 8);
  const normalized = answer.toLowerCase();
  const matched = terms.filter((term) => normalized.includes(term));
  const correct = matched.length >= Math.max(1, Math.ceil(terms.length / 4));
  return {
    correct,
    matched,
    feedback: correct
      ? `Your answer included evidence for ${concept}. This rule-based check found ${matched.length} relevant idea${matched.length === 1 ? '' : 's'}.`
      : `Your answer did not yet show the key relationship for ${concept}. The offline checker did not find enough relevant terms to confirm understanding.`,
  };
}

function today(): string {
  return new Date().toISOString();
}

function AppText(language: LearningLanguage, key: string): string {
  const copy: Record<string, Record<LearningLanguage, string>> = {
    lesson: { English: 'Lesson', Hindi: 'पाठ', Hinglish: 'Lesson' },
    debugger: { English: 'Confusion Debugger', Hindi: 'समझ जाँच', Hinglish: 'Confusion Debugger' },
    quiz: { English: 'Quiz', Hindi: 'क्विज़', Hinglish: 'Quiz' },
    progress: { English: 'Progress', Hindi: 'प्रगति', Hinglish: 'Progress' },
    offline: { English: 'Offline curated content', Hindi: 'ऑफ़लाइन चुनी गई सामग्री', Hinglish: 'Offline curated content' },
  };
  return copy[key]?.[language] ?? key;
}

// ─── TTS hook ───────────────────────────────────────────────────────────────

type TtsState = 'idle' | 'speaking' | 'paused' | 'unsupported';

function useTts() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [ttsState, setTtsState] = useState<TtsState>(() =>
    typeof window !== 'undefined' && 'speechSynthesis' in window ? 'idle' : 'unsupported'
  );
  const [rate, setRate] = useState(1);

  const stopAll = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setTtsState('idle');
  };

  useEffect(() => () => { stopAll(); }, []);

  const speak = (text: string, lang: LearningLanguage) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    stopAll();
    const langCode = lang === 'Hindi' ? 'hi-IN' : 'en-IN';
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = rate;
    // pick a matching voice when available
    const voices = window.speechSynthesis.getVoices();
    const matched = voices.find((v) => v.lang.startsWith(lang === 'Hindi' ? 'hi' : 'en'));
    if (matched) utterance.voice = matched;
    utterance.onstart = () => setTtsState('speaking');
    utterance.onend = () => setTtsState('idle');
    utterance.onerror = () => setTtsState('idle');
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setTtsState('speaking');
  };

  const pause = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.pause();
    setTtsState('paused');
  };

  const resume = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.resume();
    setTtsState('speaking');
  };

  return { ttsState, rate, setRate, speak, pause, resume, stop: stopAll };
}

// ─── Root workspace ─────────────────────────────────────────────────────────

export default function LearningWorkspace() {
  const [subject, setSubject] = useState<Subject>('Operating Systems');
  const [topicId, setTopicId] = useState('paging');
  const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
  const [style, setStyle] = useState<ExplanationStyle>('Simple Analogy');
  const [language, setLanguage] = useState<LearningLanguage>('English');
  const [tab, setTab] = useState<LearningTab>('lesson');
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress());
  const [customQuestion, setCustomQuestion] = useState('');
  const [customAnswer, setCustomAnswer] = useState('');
  const tts = useTts();
  const topics = topicsForSubject(subject);
  const topic = topics.find((item) => item.id === topicId) ?? topics[0];

  // stop narration whenever topic, language, or style changes
  useEffect(() => { tts.stop(); }, [topic.id, language, style]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateProgress = (next: ProgressState): void => { setProgress(next); saveProgress(next); };

  const selectSubject = (nextSubject: Subject): void => {
    const nextTopic = topicsForSubject(nextSubject)[0];
    setSubject(nextSubject); setTopicId(nextTopic.id); setTab('lesson'); setCustomAnswer('');
    updateProgress({ ...progress, viewed: addUnique(progress.viewed, nextTopic.id), sessions: [{ topic: nextTopic.id, action: 'viewed', date: today() }, ...progress.sessions].slice(0, 30) });
  };

  const selectTopic = (nextTopicId: string): void => {
    setTopicId(nextTopicId); setTab('lesson'); setCustomAnswer('');
    updateProgress({ ...progress, viewed: addUnique(progress.viewed, nextTopicId), sessions: [{ topic: nextTopicId, action: 'viewed', date: today() }, ...progress.sessions].slice(0, 30) });
  };

  const markStudied = (): void => updateProgress({ ...progress, studied: addUnique(progress.studied, topic.id), sessions: [{ topic: topic.id, action: 'studied', date: today() }, ...progress.sessions].slice(0, 30) });

  const askCustom = (): void => {
    const question = customQuestion.trim();
    if (!question) return;
    setCustomAnswer('This is an offline custom-question response. The current demo can acknowledge your question, but it will not reuse the selected topic or invent an answer without a configured AI provider. Try a specific question after choosing a lesson for curated teaching.');
  };

  const narrationText = style === 'Visual Teaching' ? topic.summary : (topic.explanations[style] ?? topic.summary);

  return (
    <div className="learning-workspace">
      <section className="learning-hero">
        <div><div className="eyebrow">Study Hub / {AppText(language, 'offline')}</div><h2>Choose what to learn next</h2><p>Curated lessons, explainable checks, and progress that reflects your real activity.</p></div>
        <div className="learning-badge"><Sparkles size={15} /> No live AI connected</div>
      </section>

      <section className="selector-panel">
        <div className="selector-field"><label>Subject</label><select value={subject} onChange={(e) => selectSubject(e.target.value as Subject)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="selector-field topic-field"><label>Topic</label><select value={topic.id} onChange={(e) => selectTopic(e.target.value)}>{topics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="selector-field"><label>Difficulty</label><select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
        <div className="selector-field"><label>Language</label><select value={language} onChange={(e) => setLanguage(e.target.value as LearningLanguage)}><option>English</option><option>Hindi</option><option>Hinglish</option></select></div>
      </section>

      <section className="custom-question">
        <div className="custom-icon"><CircleHelp size={19} /></div>
        <div className="custom-content">
          <strong>Ask your own question</strong>
          <span>Get a clearly labeled response without borrowing content from the current lesson.</span>
          <div className="custom-form">
            <input value={customQuestion} onChange={(e) => setCustomQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') askCustom(); }} placeholder="e.g. What is the difference between a page and a frame?" />
            <button className="secondary-button" onClick={askCustom}><Send size={15} /> Ask</button>
          </div>
          {customAnswer && <div className="custom-answer">{customAnswer}</div>}
        </div>
      </section>

      <div className="learning-tabs" role="tablist">
        {(['lesson', 'debugger', 'quiz', 'progress'] as LearningTab[]).map((item) => (
          <button key={item} className={tab === item ? 'selected' : ''} onClick={() => setTab(item)}>
            {item === 'lesson' && <BookOpen size={16} />}{item === 'debugger' && <Brain size={16} />}{item === 'quiz' && <ListChecks size={16} />}{item === 'progress' && <Target size={16} />}
            {AppText(language, item)}
          </button>
        ))}
      </div>

      {tab === 'lesson' && <LessonView topic={topic} difficulty={difficulty} style={style} setStyle={setStyle} markStudied={markStudied} studied={progress.studied.includes(topic.id)} language={language} tts={tts} narrationText={narrationText} />}
      {tab === 'debugger' && <DebuggerView topic={topic} progress={progress} updateProgress={updateProgress} />}
      {tab === 'quiz' && <QuizView topic={topic} progress={progress} updateProgress={updateProgress} setTab={setTab} />}
      {tab === 'progress' && <ProgressView progress={progress} />}
    </div>
  );
}

// ─── Lesson view ────────────────────────────────────────────────────────────

type TtsHook = ReturnType<typeof useTts>;

function LessonView({ topic, difficulty, style, setStyle, markStudied, studied, language, tts, narrationText }: {
  topic: TopicContent; difficulty: Difficulty; style: ExplanationStyle; setStyle: (s: ExplanationStyle) => void;
  markStudied: () => void; studied: boolean; language: LearningLanguage; tts: TtsHook; narrationText: string;
}) {
  const isVisual = style === 'Visual Teaching';

  return (
    <div className="lesson-layout">
      <article className="lesson-card">
        <div className="lesson-card-top">
          <div><span className="eyebrow">{topic.subject} / {topic.name}</span><h2>{topic.name}</h2></div>
          <span className="offline-pill"><span /> {AppText(language, 'offline')}</span>
        </div>
        <p className="lesson-summary">{topic.difficultyNotes[difficulty]}</p>
        <div className="objective-block">
          <h3>Learning objectives</h3>
          <ul>{topic.objectives.map((o) => <li key={o}><Check size={15} />{o}</li>)}</ul>
        </div>

        <div className="explanation-tools">
          <span>Explain this as</span>
          {(['Simple Analogy', 'Step-by-Step', 'Worked Example', 'Visual Teaching'] as ExplanationStyle[]).map((item) => (
            <button key={item} className={style === item ? 'active' : ''} onClick={() => setStyle(item)}>{item}</button>
          ))}
        </div>

        {isVisual ? (
          <div className="visual-panel">
            <div className="teaching-label"><Eye size={16} /> Visual Teaching — interactive diagram</div>
            <TopicVisualizer topicId={topic.id} />
          </div>
        ) : (
          <>
            <div className="teaching-panel">
              <div className="teaching-label"><Lightbulb size={16} /> {style}</div>
              <p>{topic.explanations[style]}</p>
            </div>
            <NarrationControls tts={tts} text={narrationText} language={language} />
          </>
        )}

        <div className="lesson-actions">
          <button className="primary-button" onClick={markStudied} disabled={studied}><Check size={16} /> {studied ? 'Topic studied' : 'Mark as studied'}</button>
          <span>Actions change the explanation approach; they do not call a live AI model.</span>
        </div>
      </article>

      <aside className="lesson-side">
        <div className="side-section">
          <h3>Key concepts</h3>
          <div className="concept-chips">{topic.concepts.map((c) => <span key={c}>{c}</span>)}</div>
        </div>
        <div className="side-section">
          <h3>Common misconceptions</h3>
          {topic.misconceptions.map((item) => <p className="misconception" key={item}><TriangleAlert size={14} />{item}</p>)}
        </div>
        <div className="visualizer-card">
          <div className="visualizer-title"><Eye size={16} /> Topic flow</div>
          <div className="visual-flow">
            {topic.visual.split('→').map((step, i) => (
              <span key={`${step}-${i}`}>{step.trim()}{i < topic.visual.split('→').length - 1 && <ChevronRight size={14} />}</span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ─── Narration controls ──────────────────────────────────────────────────────

function NarrationControls({ tts, text, language }: { tts: TtsHook; text: string; language: LearningLanguage }) {
  if (tts.ttsState === 'unsupported') {
    return (
      <div className="tts-bar unsupported">
        <Volume2 size={15} />
        <span>Browser text-to-speech is not available in this browser. The explanation above contains the full text.</span>
      </div>
    );
  }

  const isSpeaking = tts.ttsState === 'speaking';
  const isPaused = tts.ttsState === 'paused';

  return (
    <div className="tts-bar">
      <div className="tts-controls">
        <span className="tts-badge"><Mic size={13} /> Browser TTS</span>
        {!isSpeaking && !isPaused && (
          <button className="vis-btn primary" onClick={() => tts.speak(text, language)}><Play size={14} /> Read aloud</button>
        )}
        {isSpeaking && (
          <>
            <button className="vis-btn outline" onClick={tts.pause}><Pause size={14} /> Pause</button>
            <button className="vis-btn outline" onClick={tts.stop}><Square size={14} /> Stop</button>
            <span className="tts-speaking"><span className="pulse" /> Speaking…</span>
          </>
        )}
        {isPaused && (
          <>
            <button className="vis-btn primary" onClick={tts.resume}><Play size={14} /> Resume</button>
            <button className="vis-btn outline" onClick={tts.stop}><Square size={14} /> Stop</button>
            <span className="tts-paused">Paused</span>
          </>
        )}
        <label className="tts-rate">Speed
          <input type="range" min={0.5} max={2} step={0.1} value={tts.rate} onChange={(e) => { tts.setRate(Number(e.target.value)); if (isSpeaking) { tts.stop(); tts.speak(text, language); } }} />
          <span>{tts.rate}×</span>
        </label>
      </div>
      <p className="tts-note">Narration reads the current explanation at the chosen speed. Changing topic, language, or style stops the current narration automatically. This uses the browser's built-in speech engine.</p>
    </div>
  );
}

// ─── Debugger ───────────────────────────────────────────────────────────────

type DebuggerProps = { topic: TopicContent; progress: ProgressState; updateProgress: (p: ProgressState) => void };

function DebuggerView({ topic, progress, updateProgress }: DebuggerProps) {
  const [phase, setPhase] = useState<'diagnostic' | 'feedback' | 'verification' | 'verified'>('diagnostic');
  const [answer, setAnswer] = useState('');
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [verificationResult, setVerificationResult] = useState<DiagnosticResult | null>(null);

  useEffect(() => {
    setPhase('diagnostic'); setAnswer(''); setVerificationAnswer(''); setResult(null); setVerificationResult(null);
  }, [topic.id]);

  const submitDiagnostic = (): void => {
    const next = assessAnswer(answer, topic.diagnostic.answer, topic.diagnostic.concept);
    setResult(next);
    setPhase(next.correct ? 'verified' : 'feedback');
    updateProgress({
      ...progress,
      diagnostics: [{ topic: topic.id, correct: next.correct, date: today() }, ...progress.diagnostics],
      missed: next.correct ? progress.missed : addUnique(progress.missed, topic.diagnostic.concept),
      verified: next.correct ? addUnique(progress.verified, topic.diagnostic.concept) : progress.verified,
      sessions: [{ topic: topic.id, action: next.correct ? 'diagnostic-correct' : 'diagnostic-reteach', date: today() }, ...progress.sessions].slice(0, 30),
    });
  };

  const submitVerification = (): void => {
    const next = assessAnswer(verificationAnswer, topic.verification.answer, topic.verification.concept);
    setVerificationResult(next);
    setPhase('verified');
    updateProgress({
      ...progress,
      verified: next.correct ? addUnique(progress.verified, topic.verification.concept) : progress.verified,
      missed: next.correct ? progress.missed : addUnique(progress.missed, topic.verification.concept),
      sessions: [{ topic: topic.id, action: next.correct ? 'concept-verified' : 'verification-missed', date: today() }, ...progress.sessions].slice(0, 30),
    });
  };

  const reset = (): void => { setPhase('diagnostic'); setAnswer(''); setVerificationAnswer(''); setResult(null); setVerificationResult(null); };

  return (
    <div className="debugger-layout">
      <article className="debugger-card">
        <div className="debugger-heading">
          <div><span className="eyebrow">Confusion Debugger / {topic.name}</span><h2>Show what you understand</h2></div>
          <span className="rule-pill">Explainable offline check</span>
        </div>
        <div className="debugger-steps">
          <span className={phase !== 'diagnostic' ? 'complete' : 'current'}>1. Diagnose</span>
          <span className={phase === 'feedback' || phase === 'verification' || phase === 'verified' ? 'complete' : ''}>2. Reteach</span>
          <span className={phase === 'verified' ? 'complete current' : ''}>3. Verify</span>
        </div>
        {phase === 'diagnostic' && <QuestionForm prompt={topic.diagnostic.prompt} value={answer} setValue={setAnswer} submit={submitDiagnostic} label={`Diagnostic question — ${topic.name}`} button="Submit answer" />}
        {phase === 'feedback' && result && (
          <>
            <FeedbackBox result={result} topic={topic} />
            <div className="reteach-box">
              <div className="teaching-label"><Lightbulb size={16} /> Targeted reteaching: {topic.diagnostic.concept}</div>
              <p>{topic.explanations['Step-by-Step']}</p>
              <button className="primary-button" onClick={() => setPhase('verification')}>Show fresh verification question <ChevronRight size={16} /></button>
            </div>
          </>
        )}
        {phase === 'verification' && (
          <>
            <FeedbackBox result={result} topic={topic} />
            <QuestionForm prompt={topic.verification.prompt} value={verificationAnswer} setValue={setVerificationAnswer} submit={submitVerification} label={`Fresh verification — ${topic.name}`} button="Check understanding" />
          </>
        )}
        {phase === 'verified' && (
          <>
            <FeedbackBox result={verificationResult ?? result} topic={topic} />
            <div className="verified-panel">
              <Check size={22} />
              <div>
                <h3>{verificationResult?.correct || result?.correct ? 'Understanding recorded' : 'Keep practicing this concept'}</h3>
                <p>{verificationResult?.correct || result?.correct ? 'This concept is now marked as verified from an actual submitted answer.' : 'This attempt was recorded as not yet verified. Try the debugger again after reviewing the lesson.'}</p>
              </div>
            </div>
            <button className="secondary-button" onClick={reset}><RotateCcw size={16} /> Try another diagnostic</button>
          </>
        )}
      </article>
      <aside className="debugger-side">
        <div className="side-icon"><Brain size={20} /></div>
        <h3>How the debugger works</h3>
        <p>It never shows the answer first. The offline checker looks for topic-specific evidence in your submitted text, then gives a <strong>different</strong> verification question after a missed concept.</p>
        <div className="debugger-stat"><span>Current concept</span><strong>{topic.diagnostic.concept}</strong></div>
      </aside>
    </div>
  );
}

function QuestionForm({ prompt, value, setValue, submit, label, button }: { prompt: string; value: string; setValue: (v: string) => void; submit: () => void; label: string; button: string }) {
  return (
    <div className="question-form">
      <span className="question-label">{label}</span>
      <h3>{prompt}</h3>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Write your answer in your own words…" />
      <button className="primary-button" onClick={submit} disabled={!value.trim()}>{button}<ChevronRight size={16} /></button>
    </div>
  );
}

function FeedbackBox({ result, topic }: { result: DiagnosticResult | null; topic: TopicContent }) {
  if (!result) return null;
  return (
    <div className={`feedback-box ${result.correct ? 'correct' : 'incorrect'}`}>
      <div className="feedback-icon">{result.correct ? <Check size={19} /> : <TriangleAlert size={19} />}</div>
      <div>
        <strong>{result.correct ? 'Your answer shows the key idea.' : `A likely weak point is ${topic.diagnostic.concept}.`}</strong>
        <p>{result.feedback}</p>
        {result.matched.length > 0 && <small>Evidence found: {result.matched.join(', ')}</small>}
      </div>
    </div>
  );
}

// ─── Quiz ────────────────────────────────────────────────────────────────────

function QuizView({ topic, progress, updateProgress, setTab }: { topic: TopicContent; progress: ProgressState; updateProgress: (p: ProgressState) => void; setTab: (t: LearningTab) => void }) {
  const [count, setCount] = useState(5);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);

  useEffect(() => { setIndex(0); setSelected(''); setSubmitted(false); setScore(0); setWrong([]); }, [topic.id]);

  const questions = topic.quiz.slice(0, Math.min(count, topic.quiz.length));
  const current = questions[index];
  const submit = (): void => { if (submitted || !selected) return; const correct = selected === current.answer; setSubmitted(true); if (correct) setScore((v) => v + 1); else setWrong((items) => addUnique(items, current.concept)); };
  const next = (): void => {
    if (index < questions.length - 1) { setIndex((v) => v + 1); setSelected(''); setSubmitted(false); }
    else {
      const finalWrong = selected === current.answer ? wrong : addUnique(wrong, current.concept);
      updateProgress({ ...progress, quizzes: [{ topic: topic.id, score: score + (selected === current.answer ? 1 : 0), total: questions.length, date: today() }, ...progress.quizzes], missed: [...new Set([...progress.missed, ...finalWrong])], sessions: [{ topic: topic.id, action: 'quiz-completed', date: today() }, ...progress.sessions].slice(0, 30) });
    }
  };
  const completed = index === questions.length - 1 && submitted;
  const retry = (): void => { setIndex(0); setSelected(''); setSubmitted(false); setScore(0); setWrong([]); };

  return (
    <div className="quiz-layout">
      <article className="quiz-card">
        <div className="quiz-header">
          <div><span className="eyebrow">Topic quiz / {topic.name}</span><h2>{completed ? 'Quiz complete' : 'One question at a time'}</h2></div>
          <label>Question count<select value={count} onChange={(e) => { setCount(Number(e.target.value)); retry(); }}><option value={5}>5 questions</option><option value={10} disabled={topic.quiz.length < 10}>10 questions (not available)</option><option value={15} disabled={topic.quiz.length < 15}>15 questions (not available)</option></select></label>
        </div>
        {completed ? (
          <QuizResult score={score + (selected === current.answer ? 1 : 0)} total={questions.length} wrong={wrong} retry={retry} setTab={setTab} />
        ) : (
          <>
            <div className="quiz-progress"><span>Question {index + 1} of {questions.length}</span><div><i style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div></div>
            <div className="quiz-question">
              <h3>{current.prompt}</h3>
              <div className="option-list">
                {current.options.map((option) => (
                  <button key={option} className={selected === option ? 'chosen' : ''} onClick={() => !submitted && setSelected(option)}>
                    {option}<span>{selected === option && <Check size={14} />}</span>
                  </button>
                ))}
              </div>
            </div>
            {submitted && (
              <div className={`quiz-feedback ${selected === current.answer ? 'correct' : 'incorrect'}`}>
                <strong>{selected === current.answer ? 'Correct' : 'Not quite'}</strong>
                <p>{current.explanation}</p>
                {selected !== current.answer && <button className="text-button" onClick={() => setTab('lesson')}>Review {current.concept} in the lesson <ChevronRight size={14} /></button>}
              </div>
            )}
            <div className="quiz-footer">
              <span>{submitted ? 'Feedback revealed after submission' : 'Choose an option, then submit once.'}</span>
              {submitted ? <button className="primary-button" onClick={next}>{index === questions.length - 1 ? 'See results' : 'Next question'} <ChevronRight size={16} /></button> : <button className="primary-button" onClick={submit} disabled={!selected}>Submit answer <Check size={16} /></button>}
            </div>
          </>
        )}
      </article>
      <aside className="quiz-side">
        <div className="side-icon"><ListChecks size={20} /></div>
        <h3>Real progress only</h3>
        <p>Your score is calculated from submitted answers. Repeated clicks cannot score the same question twice.</p>
        <div className="quiz-note"><Flame size={16} /> {topic.quiz.length} curated questions available for this topic.</div>
      </aside>
    </div>
  );
}

function QuizResult({ score, total, wrong, retry, setTab }: { score: number; total: number; wrong: string[]; retry: () => void; setTab: (t: LearningTab) => void }) {
  const percentage = Math.round((score / total) * 100);
  return (
    <div className="quiz-result">
      <div className="quiz-score"><strong>{percentage}%</strong><span>{score} of {total} correct</span></div>
      <div className="result-copy">
        <h3>{percentage >= 70 ? 'Solid work.' : 'A focused review will help.'}</h3>
        <p>{wrong.length ? `Concepts to revisit: ${wrong.join(', ')}.` : 'Every submitted answer was correct.'}</p>
        <div className="result-actions">
          <button className="secondary-button" onClick={retry}><RotateCcw size={16} /> Retry quiz</button>
          {wrong.length > 0 && <button className="text-button" onClick={() => setTab('debugger')}>Targeted reteaching <ChevronRight size={14} /></button>}
        </div>
      </div>
    </div>
  );
}

// ─── Progress ────────────────────────────────────────────────────────────────

function ProgressView({ progress }: { progress: ProgressState }) {
  const accuracy = progress.quizzes.length ? Math.round(progress.quizzes.reduce((sum, item) => sum + (item.score / item.total) * 100, 0) / progress.quizzes.length) : 0;
  return (
    <div className="progress-layout">
      <section className="progress-overview">
        <div className="overview-heading"><div><span className="eyebrow">Learning record</span><h2>Your real activity</h2></div><span className="storage-note">Saved on this device</span></div>
        <div className="progress-metrics">
          <div><Eye size={17} /><span>Topics viewed</span><strong>{progress.viewed.length}</strong></div>
          <div><BookOpen size={17} /><span>Topics studied</span><strong>{progress.studied.length}</strong></div>
          <div><Check size={17} /><span>Concepts verified</span><strong>{progress.verified.length}</strong></div>
          <div><Target size={17} /><span>Quiz accuracy</span><strong>{progress.quizzes.length ? `${accuracy}%` : '—'}</strong></div>
        </div>
        <div className="activity-section">
          <h3>Recent sessions</h3>
          {progress.sessions.length ? progress.sessions.slice(0, 8).map((session, i) => (
            <div className="activity-row" key={`${session.date}-${i}`}>
              <span className="activity-dot" />
              <div><strong>{session.topic}</strong><small>{session.action.split('-').join(' ')} · {new Date(session.date).toLocaleDateString()}</small></div>
            </div>
          )) : <p className="empty-report">Your completed lessons, debugger attempts, and quizzes will appear here.</p>}
        </div>
      </section>
      <aside className="progress-side">
        <h3>What each status means</h3>
        <p><Eye size={15} /><span><b>Viewed</b> You opened the topic.</span></p>
        <p><BookOpen size={15} /><span><b>Studied</b> You marked the lesson complete.</span></p>
        <p><Check size={15} /><span><b>Verified</b> You passed a fresh concept check.</span></p>
        <p><Target size={15} /><span><b>Quiz</b> Score reflects submitted answers only.</span></p>
      </aside>
    </div>
  );
}
