import React, { useState, useRef, useEffect } from 'react';
import { Menu, Sparkles, Share2, MoreVertical, Key, Sun, Moon, User as UserIcon, LogIn, History as HistoryIcon, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/Sidebar';
import { ChatInput } from './components/ChatInput';
import { ChatMessage } from './components/ChatMessage';
import { Message, UserProfile, ChatSession } from './types';
import { chatWithAI } from './services/gemini';
import { cn } from './lib/utils';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [language, setLanguage] = useState<'fr' | 'he' | 'en'>('fr');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>(Date.now().toString());
  const [profileForm, setProfileForm] = useState<UserProfile>({ name: '', email: '' });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      } else {
        setHasApiKey(true);
      }
    };
    checkKey();

    // Load theme
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light';
    if (savedTheme) setTheme(savedTheme);

    // Load language
    const savedLang = localStorage.getItem('language') as 'fr' | 'he' | 'en';
    if (savedLang) setLanguage(savedLang);

    // Load user
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setProfileForm(JSON.parse(savedUser));
    }

    // Load messages
    const savedMessages = localStorage.getItem('machpia_chat_history');
    if (savedMessages) setMessages(JSON.parse(savedMessages));

    // Load sessions
    const savedSessions = localStorage.getItem('machpia_sessions');
    if (savedSessions) setSessions(JSON.parse(savedSessions));
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('machpia_chat_history', JSON.stringify(messages));
      
      // Update current session in sessions list
      setSessions(prev => {
        const existing = prev.find(s => s.id === currentSessionId);
        if (existing) {
          return prev.map(s => s.id === currentSessionId ? { ...s, messages, timestamp: Date.now() } : s);
        } else {
          const newSession: ChatSession = {
            id: currentSessionId,
            title: messages[0]?.content.slice(0, 30) + (messages[0]?.content.length > 30 ? '...' : '') || 'Nouveau chat',
            messages,
            timestamp: Date.now()
          };
          return [newSession, ...prev];
        }
      });
    }
  }, [messages, currentSessionId]);

  useEffect(() => {
    localStorage.setItem('machpia_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const handleSend = async (text: string, deepSearch: boolean) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await chatWithAI([...messages, userMessage], language, deepSearch);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI Error:', error);
      if (error?.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
      }
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Désolé, une erreur est survenue lors de la communication avec MachpIA. Veuillez vérifier votre connexion ou réessayer plus tard.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setCurrentSessionId(Date.now().toString());
    localStorage.removeItem('machpia_chat_history');
  };

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    setShowActivityModal(false);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (profileForm.name && profileForm.email) {
      setUser(profileForm);
      localStorage.setItem('user', JSON.stringify(profileForm));
      setShowProfileModal(false);
    }
  };

  const handleGoogleLogin = () => {
    const mockUser = { name: 'Utilisateur Google', email: 'google.user@example.com' };
    setUser(mockUser);
    setProfileForm(mockUser);
    localStorage.setItem('user', JSON.stringify(mockUser));
    setShowProfileModal(false);
  };

  const handleSessionDelete = (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      handleNewChat();
    }
  };

  return (
    <div className="flex h-screen w-full bg-[var(--bg-main)] overflow-hidden">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onNewChat={() => {
          handleNewChat();
          if (window.innerWidth < 768) setIsSidebarOpen(false);
        }} 
        onClose={() => setIsSidebarOpen(false)}
        onSettingsClick={() => setShowSettingsModal(true)}
        onHelpClick={() => setShowHelpModal(true)}
        onActivityClick={() => setShowActivityModal(true)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSessionSelect={loadSession}
        onSessionDelete={handleSessionDelete}
      />
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-4 h-16 shrink-0 border-b border-[var(--border-color)]">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors"
            >
              <Menu className="h-5 w-5 text-[var(--text-muted)]" />
            </button>
              <div className="flex flex-col">
                <span className="text-lg md:text-xl font-medium text-[var(--text-main)] leading-none">MachpIA</span>
                <span className="text-[9px] md:text-[10px] text-[var(--text-muted)] font-medium">l’IA de la Hassidout</span>
              </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors"
              title="Changer le thème"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5 text-[var(--text-muted)]" /> : <Moon className="h-5 w-5 text-[var(--text-muted)]" />}
            </button>
            
            {user ? (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowProfileModal(true)}
                  className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors"
                  title="Profil"
                >
                  <UserIcon className="h-5 w-5 text-[var(--text-muted)]" />
                </button>
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-color)] text-white text-sm font-medium hover:opacity-90 transition-colors"
              >
                <LogIn className="h-4 w-4" />
                <span>Se connecter</span>
              </button>
            )}
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto scroll-smooth"
        >
          {messages.length === 0 ? (
            <div className="min-h-full flex flex-col items-center pt-12 pb-12 px-4 max-w-3xl mx-auto text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-12"
              >
                <h1 className="text-5xl md:text-6xl font-medium mb-4 text-[var(--text-main)] tracking-tighter">
                  MachpIA
                </h1>
                <p className="text-xl md:text-2xl text-[var(--text-muted)]">
                  l’IA de la Hassidout
                </p>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                {[
                  { title: "Explique un concept", desc: "Qu'est-ce que l'unité de Dieu dans le Tanya ?", icon: "📖" },
                  { title: "Traduction & Explication", desc: "Traduis et explique ce passage de Sichos...", icon: "🌍" },
                  { title: "Minhaguim", desc: "Quels sont les coutumes de Habad pour Pessah ?", icon: "🕯️" },
                  { title: "Recherche approfondie", desc: "Trouve des sources sur le concept de Bitoul", icon: "🔍" }
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(item.desc, i === 3)}
                    className="p-4 rounded-2xl bg-[var(--bg-sidebar)] hover:bg-[var(--bg-hover)] transition-colors text-left group border border-[var(--border-color)]"
                  >
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <div className="text-sm font-medium text-[var(--text-main)] mb-1">{item.title}</div>
                    <div className="text-xs text-[var(--text-muted)] group-hover:text-[var(--text-main)]">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto pb-32">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="flex gap-4 py-8 px-4 md:px-6">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[var(--bg-sidebar)] border-[var(--border-color)]">
                    <Sparkles className="h-5 w-5 text-[var(--accent-color)] animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-2 w-full">
                    <div className="h-4 w-3/4 bg-[var(--bg-hover)] rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-[var(--bg-hover)] rounded animate-pulse" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)] to-transparent pt-10">
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <h2 className="text-2xl font-semibold text-[var(--text-main)] mb-6">Paramètres</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-3 uppercase tracking-wider">Langue de réponse</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['fr', 'he', 'en'] as const).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className={cn(
                          "py-2 rounded-xl border transition-all font-medium",
                          language === lang 
                            ? "bg-[var(--accent-color)] border-[var(--accent-color)] text-white" 
                            : "border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                        )}
                      >
                        {lang === 'fr' ? 'Français' : lang === 'he' ? 'עברית' : 'English'}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-3 bg-[var(--text-main)] text-[var(--bg-main)] rounded-xl font-medium hover:opacity-90 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <h2 className="text-2xl font-semibold text-[var(--text-main)] mb-6">À propos de MachpIA</h2>
              <div className="space-y-4 text-[var(--text-main)]">
                <p>MachpIA est une intelligence artificielle spécialisée dans les enseignements de la Hassidout Habad.</p>
                <div className="space-y-2">
                  <h3 className="font-semibold">Ce que MachpIA peut faire :</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-[var(--text-muted)]">
                    <li>Expliquer des concepts complexes du Tanya.</li>
                    <li>Traduire et commenter des Sichos et Maamarim.</li>
                    <li>Répondre à des questions sur les Minhaguim (coutumes).</li>
                    <li>Aider dans l'Avodat Hachem (service de Dieu).</li>
                    <li>Rechercher des sources précises dans les textes classiques.</li>
                  </ul>
                </div>
                <p className="text-sm italic text-[var(--text-muted)]">
                  Note : MachpIA est un outil d'étude. Pour des décisions halakhiques ou des conseils personnels cruciaux, consultez toujours un Rav.
                </p>
                <button
                  onClick={() => setShowHelpModal(false)}
                  className="w-full py-3 bg-[var(--text-main)] text-[var(--bg-main)] rounded-xl font-medium hover:opacity-90 transition-colors mt-4"
                >
                  Compris
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activity Modal */}
      <AnimatePresence>
        {showActivityModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col"
            >
              <h2 className="text-2xl font-semibold text-[var(--text-main)] mb-6">Activité</h2>
              
              <div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">
                {sessions.length === 0 ? (
                  <div className="text-center py-12 text-[var(--text-muted)]">
                    <HistoryIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>Aucun historique de chat pour le moment.</p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all border",
                        currentSessionId === session.id 
                          ? "bg-[var(--accent-color)] border-[var(--accent-color)] text-white" 
                          : "bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                      )}
                    >
                      <MessageSquare className="h-5 w-5 shrink-0 opacity-70" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{session.title}</div>
                        <div className={cn(
                          "text-[10px] mt-1",
                          currentSessionId === session.id ? "text-white/70" : "text-[var(--text-muted)]"
                        )}>
                          {new Date(session.timestamp).toLocaleDateString()} à {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowActivityModal(false)}
                className="w-full py-3 bg-[var(--text-main)] text-[var(--bg-main)] rounded-xl font-medium hover:opacity-90 transition-colors"
              >
                Fermer
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-[var(--accent-color)]/10">
                  <LogIn className="h-6 w-6 text-[var(--accent-color)]" />
                </div>
                <h2 className="text-2xl font-semibold text-[var(--text-main)]">Connexion</h2>
              </div>
              
              <p className="text-[var(--text-muted)] mb-6">
                Connectez-vous pour sauvegarder votre historique de chat et personnaliser votre expérience.
              </p>

              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[var(--border-color)] bg-white text-black font-medium hover:bg-gray-50 transition-colors"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                  Continuer avec Google
                </button>

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--border-color)]"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[var(--bg-sidebar)] px-2 text-[var(--text-muted)]">Ou avec email</span>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Nom</label>
                    <input
                      type="text"
                      required
                      value={profileForm.name}
                      onChange={e => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-colors"
                      placeholder="Votre nom"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">Email</label>
                    <input
                      type="email"
                      required
                      value={profileForm.email}
                      onChange={e => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-main)] focus:border-[var(--accent-color)] outline-none transition-colors"
                      placeholder="votre@email.com"
                    />
                  </div>
                  
                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowProfileModal(false)}
                      className="flex-1 py-3 px-4 rounded-xl border border-[var(--border-color)] text-[var(--text-main)] font-medium hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 px-4 rounded-xl bg-[var(--accent-color)] text-white font-medium hover:opacity-90 transition-colors"
                    >
                      {user ? 'Mettre à jour' : 'Se connecter'}
                    </button>
                  </div>
                </form>
              </div>
              
              <p className="text-[10px] text-[var(--text-muted)] mt-6 text-center">
                Note: L'historique des chats sera synchronisé avec votre compte.
              </p>
              
              <p className="text-[10px] text-[var(--text-muted)] mt-6 text-center">
                Note: L'authentification Google a été désactivée car la configuration Firebase a été refusée. Vos données sont stockées localement.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
