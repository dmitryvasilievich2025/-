import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { SevaAssistant } from './components/SevaAssistant';
import { geminiService } from './services/gemini';
import { PlayerLevel, PlayerRole, GameType, Tournament, Player, PlayerStats, PlayerReview, EventCategory, EventGender } from './types';

// Utility for calculating rating
const calculatePlayerRating = (stats: PlayerStats, reviews: PlayerReview[]): number => {
  const winRate = stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) : 0;
  const statScore = winRate * 5; 
  const avgReviewScore = reviews.length > 0 
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
    : 0;
  if (reviews.length === 0) return Number(statScore.toFixed(1));
  return Number((statScore * 0.6 + avgReviewScore * 0.4).toFixed(1));
};

// Initial Data
const INITIAL_PLAYERS: Player[] = [
  {
    id: 'p1',
    name: 'Олександр Волков',
    age: 52,
    gender: EventGender.MEN,
    level: PlayerLevel.PROFESSIONAL,
    role: PlayerRole.MIDDLE_BLOCKER,
    contacts: '+380671112233',
    bio: 'Майстер спорту міжнародного класу. Грав за збірну. Шукаю серйозну команду для ветеранських ліг. Багаторазовий чемпіон внутрішніх та закордонних першостей.',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800&h=800&fit=crop',
    verified: true,
    stats: { gamesPlayed: 450, wins: 310, losses: 140, blocks: 120, bestAchievement: 'Чемпіон України 2005' },
    reviews: [
      { id: 'r1', author: 'Сергій П.', rating: 5, comment: 'Справжня легенда. Неймовірна техніка навіть у такому віці.', date: '2024-05-10' },
      { id: 'r2', author: 'Микола Д.', rating: 4, comment: 'Дуже надійний на блоці.', date: '2024-05-15' }
    ],
    overallRating: 4.8
  },
  {
    id: 'p4',
    name: 'Олена Петренко',
    age: 45,
    gender: EventGender.WOMEN,
    level: PlayerLevel.LEGEND,
    role: PlayerRole.OUTSIDE_HITTER,
    contacts: '+380979876543',
    bio: 'Заслужений майстер спорту. Потужна атака та колосальний досвід. Керувала жіночою збірною на багатьох турнірах.',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    verified: true,
    stats: { gamesPlayed: 600, wins: 480, losses: 120, aces: 90, bestAchievement: 'Олімпійська надія 2000' },
    reviews: [
      { id: 'r3', author: 'Тетяна К.', rating: 5, comment: 'Найкращий капітан, з яким я грала.', date: '2024-04-20' }
    ],
    overallRating: 4.9
  }
];

const INITIAL_TOURNAMENTS: Tournament[] = [
  { id: '1', title: 'Кубок Ветеранів Києва', date: '2024-06-15', location: 'Київ, Гідропарк', type: GameType.BEACH, category: EventCategory.TOURNAMENT, gender: EventGender.MEN, ageCategory: '40+', requirements: 'Наявність форми.', organizer: 'Іван П.', organizerContact: '+380671234567', photoUrl: 'https://images.unsplash.com/photo-1592656094267-764a45160876?w=800&q=80', maxTeams: 12, minAge: 40 },
  { id: '2', title: 'Чемпіонат України 50+', date: '2024-07-20', location: 'Одеса, Палац Спорту', type: GameType.CLASSIC, category: EventCategory.CHAMPIONSHIP, gender: EventGender.MEN, ageCategory: '50+', requirements: 'Паспорт.', organizer: 'Марія К.', organizerContact: '+380507654321', photoUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80', maxTeams: 8, minAge: 50 },
  { id: '3', title: 'Вечірня гра 40+', date: '2024-06-18', location: 'Київ, КПІ', type: GameType.CLASSIC, category: EventCategory.GAME, gender: EventGender.MIXED, ageCategory: '40+', requirements: 'Гарний настрій', organizer: 'Олексій', organizerContact: '+380998887766', minAge: 40 }
];

const EventsContext = React.createContext<{
  events: Tournament[];
  addEvent: (e: Tournament) => void;
  updateEvent: (e: Tournament) => void;
  deleteEvent: (id: string) => void;
}>({ events: [], addEvent: () => {}, updateEvent: () => {}, deleteEvent: () => {} });

const PlayersContext = React.createContext<{
  players: Player[];
  addPlayer: (p: Player) => void;
  updatePlayer: (p: Player) => void;
  deletePlayer: (id: string) => void;
}>({ players: [], addPlayer: () => {}, updatePlayer: () => {}, deletePlayer: () => {} });

// UI Helpers
const RatingStars = ({ rating, size = "sm" }: { rating: number, size?: "sm" | "md" | "lg" }) => {
  const stars = [1, 2, 3, 4, 5];
  const iconSize = size === "lg" ? "w-6 h-6" : size === "md" ? "w-4 h-4" : "w-3 h-3";
  return (
    <div className="flex items-center gap-0.5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full">
      {stars.map(s => (
        <span key={s} className={`${iconSize} ${s <= Math.round(rating) ? 'text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]' : 'text-white/30'}`}>★</span>
      ))}
      <span className={`ml-2 font-black text-white ${size === "lg" ? 'text-2xl' : 'text-xs'}`}>{rating}</span>
    </div>
  );
};

const StatBadge = ({ label, value, color = "blue" }: { label: string, value: string | number, color?: string }) => (
  <div className={`bg-${color}-50 border border-${color}-100 p-3 rounded-2xl text-center flex-1`}>
    <p className="text-[10px] uppercase font-black text-gray-400 tracking-wider mb-1">{label}</p>
    <p className={`text-base font-black text-${color}-900`}>{value}</p>
  </div>
);

const getGameTypeIcon = (type: GameType) => {
  switch (type) {
    case GameType.CLASSIC: return '🏟️';
    case GameType.BEACH: return '🏖️';
    case GameType.MIX: return '🚻';
    case GameType.PARK: return '🌲';
    default: return '🏐';
  }
};

// Modals
const EventModal = ({ isOpen, onClose, onSave, initialData }: { isOpen: boolean, onClose: () => void, onSave: (e: Tournament) => void, initialData?: Tournament | null }) => {
  const [formData, setFormData] = useState<Tournament>({
    id: '', title: '', date: '', location: '', type: GameType.CLASSIC, category: EventCategory.TOURNAMENT, gender: EventGender.MEN,
    ageCategory: '', requirements: '', organizer: '', organizerContact: '', photoUrl: '', maxTeams: 0, minAge: 35, teamFormat: '6x6', organizerPhotoUrl: '',
    minAgeMen: 35, minAgeWomen: 35
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingOrganizer, setIsGeneratingOrganizer] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const organizerFileInputRef = useRef<HTMLInputElement>(null);
  const photoUrlInputRef = useRef<HTMLInputElement>(null);
  const organizerPhotoUrlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) setFormData(initialData);
    else if (isOpen) setFormData({
      id: '', title: '', date: '', location: '', type: GameType.CLASSIC, category: EventCategory.TOURNAMENT, gender: EventGender.MEN,
      ageCategory: '', requirements: '', organizer: '', organizerContact: '', photoUrl: '', maxTeams: 12, minAge: 35, teamFormat: '6x6', organizerPhotoUrl: '',
      minAgeMen: 35, minAgeWomen: 35
    });
  }, [initialData, isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'photoUrl' | 'organizerPhotoUrl') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, [field]: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAIImage = async () => {
    if (!formData.title) {
      alert("Будь ласка, спочатку введіть назву події для ШІ-генерації!");
      return;
    }
    setIsGenerating(true);
    try {
      const prompt = `Professional high-quality sports photography poster for a volleyball event titled "${formData.title}". Cinematic lighting, dynamic action, vibrant colors, athletic style.`;
      const url = await geminiService.generatePromoImage(prompt, "1K");
      if (url) {
        setFormData(prev => ({ ...prev, photoUrl: url }));
      }
    } catch (error) {
      console.error("AI Generation failed", error);
      alert("Не вдалося згенерувати зображення. Спробуйте пізніше.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateOrganizerAIImage = async () => {
    if (!formData.organizer) {
      alert("Будь ласка, спочатку введіть ім'я організатора!");
      return;
    }
    setIsGeneratingOrganizer(true);
    try {
      const prompt = `Professional corporate headshot portrait of a sports event organizer named "${formData.organizer}", middle aged, friendly expression, clean background, athletic professional style. High quality photography.`;
      const url = await geminiService.generatePromoImage(prompt, "1K");
      if (url) {
        setFormData(prev => ({ ...prev, organizerPhotoUrl: url }));
      }
    } catch (error) {
      console.error("AI Organizer generation failed", error);
      alert("Не вдалося згенерувати аватар. Спробуйте пізніше.");
    } finally {
      setIsGeneratingOrganizer(false);
    }
  };

  if (!isOpen) return null;

  const isSpecialFormat = formData.type === GameType.MIX || formData.type === GameType.PARK;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-6 bg-blue-950 text-white flex justify-between items-center shrink-0">
          <h2 className="text-xl font-black italic uppercase tracking-wider">{initialData ? 'Редагувати подію' : 'Створити подію'}</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl transition-all hover:rotate-90">✕</button>
        </div>
        
        <div className="bg-gray-100 flex p-1 shrink-0">
          {[EventCategory.TOURNAMENT, EventCategory.GAME].map(cat => (
            <button 
              key={cat} 
              type="button" 
              onClick={() => setFormData({...formData, category: cat})}
              className={`flex-1 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${formData.category === cat ? 'bg-white text-blue-950 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {cat === EventCategory.TOURNAMENT ? '🏆 Турнір' : '🏐 Гра (MVP)'}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); onClose(); }} className="p-6 overflow-y-auto space-y-8 custom-scrollbar">
          <section className="space-y-4">
            <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest border-b border-gray-100 pb-2">Основна інформація</h3>
            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Назва турніру/зустрічі</label>
              <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl font-bold border-2 border-transparent focus:border-blue-500 outline-none transition-all" placeholder="Введіть назву..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Тип гри</label>
                <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as GameType})} className="w-full bg-gray-50 p-3 rounded-xl font-bold text-xs outline-none border-2 border-transparent focus:border-blue-500">
                  {Object.values(GameType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Дата</label>
                <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {isSpecialFormat ? (
                <>
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Мін. вік Чоловіків</label>
                    <input 
                      type="number" 
                      value={formData.minAgeMen} 
                      onChange={e => setFormData({...formData, minAgeMen: parseInt(e.target.value) || 0})} 
                      className="w-full bg-blue-50 p-3 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500" 
                      placeholder="35" 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Мін. вік Жінок</label>
                    <input 
                      type="number" 
                      value={formData.minAgeWomen} 
                      onChange={e => setFormData({...formData, minAgeWomen: parseInt(e.target.value) || 0})} 
                      className="w-full bg-pink-50 p-3 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500" 
                      placeholder="35" 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Формат (2х2, 4х2...)</label>
                    <input 
                      value={formData.teamFormat} 
                      onChange={e => setFormData({...formData, teamFormat: e.target.value})} 
                      className="w-full bg-gray-50 p-3 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500" 
                      placeholder="Напр: 2х2" 
                    />
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2">
                  <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Мінімальний вік</label>
                  <input 
                    type="number" 
                    value={formData.minAge} 
                    onChange={e => setFormData({...formData, minAge: parseInt(e.target.value) || 0})} 
                    className="w-full bg-gray-50 p-3 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500" 
                    placeholder="Напр: 40" 
                  />
                </div>
              )}
              
              <div className={!isSpecialFormat ? "col-span-1" : ""}>
                <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Ліміт команд</label>
                <input 
                  type="number" 
                  value={formData.maxTeams} 
                  onChange={e => setFormData({...formData, maxTeams: parseInt(e.target.value) || 0})} 
                  className="w-full bg-gray-50 p-3 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500" 
                  placeholder="12" 
                />
              </div>
            </div>

            <div>
              <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Локація</label>
              <input required placeholder="Місто, стадіон" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest border-b border-gray-100 pb-2">Зображення події (Афіша)</h3>
            
            {formData.photoUrl && (
              <div className="relative w-full h-40 rounded-2xl overflow-hidden border-2 border-gray-100 shadow-inner group">
                <img src={formData.photoUrl} className="w-full h-full object-cover" alt="Афіша" />
                <button 
                  type="button" 
                  onClick={() => setFormData({...formData, photoUrl: ''})}
                  className="absolute top-2 right-2 bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >✕</button>
              </div>
            )}

            <div className="flex items-center gap-2 group">
              <div className="relative flex-1">
                <input 
                  ref={photoUrlInputRef}
                  value={formData.photoUrl} 
                  onChange={e => setFormData({...formData, photoUrl: e.target.value})} 
                  className="w-full bg-gray-50 p-4 rounded-2xl font-bold text-xs outline-none border-2 border-transparent focus:border-blue-500 pr-32 transition-all" 
                  placeholder="Вставте URL або скористайтеся інструментами..." 
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-white/60 backdrop-blur-md p-1 rounded-xl shadow-sm">
                   <button 
                    type="button" 
                    onClick={() => photoUrlInputRef.current?.focus()} 
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Редагувати текст URL"
                   >
                     ✏️
                   </button>
                   <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'photoUrl')} className="hidden" accept="image/*" />
                   <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Завантажити з пристрою"
                   >
                     📁
                   </button>
                   <button 
                    type="button" 
                    onClick={handleGenerateAIImage} 
                    disabled={isGenerating}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                    title="Згенерувати за допомогою AI"
                   >
                     {isGenerating ? '⏳' : '🤖'}
                   </button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xs font-black text-blue-900 uppercase tracking-widest border-b border-gray-100 pb-2">Інформація про організатора</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">ПІБ Організатора</label>
                <input required value={formData.organizer} onChange={e => setFormData({...formData, organizer: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500" placeholder="Іван Іванов" />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Контакти</label>
                <input required value={formData.organizerContact} onChange={e => setFormData({...formData, organizerContact: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl font-bold outline-none border-2 border-transparent focus:border-blue-500" placeholder="+380..." />
              </div>
            </div>

            <div className="flex gap-4 items-end">
              <div className="relative w-24 h-24 shrink-0 rounded-[1.5rem] overflow-hidden border-2 border-gray-100 shadow-sm bg-gray-50">
                {formData.organizerPhotoUrl ? (
                  <img src={formData.organizerPhotoUrl} className="w-full h-full object-cover" alt="Організатор" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl grayscale opacity-20">👤</div>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <label className="text-[9px] font-black uppercase text-gray-400 block tracking-widest">Фото організатора</label>
                <div className="relative">
                  <input 
                    ref={organizerPhotoUrlInputRef}
                    value={formData.organizerPhotoUrl || ''} 
                    onChange={e => setFormData({...formData, organizerPhotoUrl: e.target.value})} 
                    className="w-full bg-gray-50 p-3 pr-24 rounded-xl font-bold text-[10px] outline-none border-2 border-transparent focus:border-blue-500 transition-all" 
                    placeholder="URL фото..." 
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <input type="file" ref={organizerFileInputRef} onChange={(e) => handleFileChange(e, 'organizerPhotoUrl')} className="hidden" accept="image/*" />
                    <button 
                      type="button" 
                      onClick={() => organizerFileInputRef.current?.click()} 
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Завантажити фото"
                    >📁</button>
                    <button 
                      type="button" 
                      onClick={handleGenerateOrganizerAIImage} 
                      disabled={isGeneratingOrganizer}
                      className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                      title="AI Аватар"
                    >
                      {isGeneratingOrganizer ? '⏳' : '🤖'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <button type="submit" className="w-full bg-blue-950 text-white py-5 rounded-[2rem] font-black text-xl shadow-2xl hover:bg-black transition-all">
            {initialData ? 'ЗБЕРЕГТИ ЗМІНИ' : `ОПУБЛІКУВАТИ ПОДІЮ`}
          </button>
        </form>
      </div>
    </div>
  );
};

// PlayerProfilePage
const PlayerProfilePage = () => {
  const { id } = useParams();
  const { players } = React.useContext(PlayersContext);
  const navigate = useNavigate();
  
  const player = useMemo(() => players.find(p => p.id === id), [players, id]);

  if (!player) return (
    <div className="p-20 text-center font-black opacity-30 uppercase">Гравця не знайдено</div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 space-y-12">
      <button onClick={() => navigate(-1)} className="text-blue-600 font-black uppercase text-xs tracking-widest flex items-center gap-2 hover:underline">
        ← Назад до ринку
      </button>

      <div className="bg-white rounded-[4rem] shadow-2xl overflow-hidden border border-gray-100 flex flex-col md:flex-row">
        <div className="md:w-2/5 h-[500px] relative">
          <img src={player.photoUrl || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=800&fit=crop'} className="w-full h-full object-cover" alt={player.name} />
          {player.verified && (
            <div className="absolute top-8 left-8 bg-blue-600 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
              ✓ Верифіковано
            </div>
          )}
        </div>

        <div className="p-12 flex-1 space-y-8">
          <div>
            <div className="flex justify-between items-start mb-2">
              <h1 className="text-4xl font-black text-blue-950 leading-none">{player.name}</h1>
              <RatingStars rating={player.overallRating} size="lg" />
            </div>
            <div className="flex gap-4">
              <span className="bg-blue-50 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{player.level}</span>
              <span className="bg-purple-50 text-purple-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">{player.role}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <StatBadge label="Вік" value={player.age} color="gray" />
            <StatBadge label="Ігри" value={player.stats.gamesPlayed} color="blue" />
            <StatBadge label="Стать" value={player.gender} color="pink" />
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Про себе</h3>
            <p className="text-gray-600 leading-relaxed font-medium">
              {player.bio || "Інформація відсутня."}
            </p>
          </div>

          <div className="p-6 bg-blue-50 rounded-[2.5rem] flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black uppercase text-blue-400 mb-1">Зв'язатися</p>
              <p className="text-xl font-black text-blue-950">{player.contacts || "+380..."}</p>
            </div>
            <button className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all">
              Надіслати запит
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <section className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
          <h2 className="text-2xl font-black text-blue-950 mb-8 flex items-center gap-3">
             <span className="bg-blue-100 text-blue-600 w-10 h-10 flex items-center justify-center rounded-xl">📊</span>
             Кар'єрна статистика
          </h2>
          <div className="space-y-6">
             <div className="flex justify-between items-end border-b border-gray-50 pb-4">
               <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Вінрейт</span>
               <span className="text-2xl font-black text-green-600">
                 {player.stats.gamesPlayed > 0 ? ((player.stats.wins / player.stats.gamesPlayed) * 100).toFixed(0) : 0}%
               </span>
             </div>
             <div className="flex justify-between items-end border-b border-gray-50 pb-4">
               <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Перемоги</span>
               <span className="text-2xl font-black text-blue-950">{player.stats.wins}</span>
             </div>
             <div className="flex justify-between items-end border-b border-gray-50 pb-4">
               <span className="text-gray-400 font-black uppercase text-[10px] tracking-widest">Найкраще досягнення</span>
               <span className="text-lg font-black text-amber-600 text-right max-w-[200px]">{player.stats.bestAchievement || "-"}</span>
             </div>
          </div>
        </section>

        <section className="bg-white p-10 rounded-[3rem] border border-gray-100 shadow-sm">
          <h2 className="text-2xl font-black text-blue-950 mb-8 flex items-center gap-3">
             <span className="bg-amber-100 text-amber-600 w-10 h-10 flex items-center justify-center rounded-xl">💬</span>
             Відгуки ({player.reviews.length})
          </h2>
          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
            {player.reviews.length > 0 ? player.reviews.map(rev => (
              <div key={rev.id} className="p-6 bg-gray-50 rounded-[2rem] space-y-3">
                <div className="flex justify-between items-center">
                  <p className="font-black text-blue-950 text-sm">{rev.author}</p>
                  <div className="flex text-amber-400 text-xs">{"★".repeat(rev.rating)}</div>
                </div>
                <p className="text-xs text-gray-500 font-medium leading-relaxed italic">"{rev.comment}"</p>
                <p className="text-[9px] text-gray-400 text-right">{rev.date}</p>
              </div>
            )) : (
              <p className="text-center py-10 text-gray-400 italic font-bold">Відгуків поки немає</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

// CalendarPage
const CalendarPage = () => {
  const { events, addEvent, updateEvent, deleteEvent } = React.useContext(EventsContext);
  const [modal, setModal] = useState<{ open: boolean, data: Tournament | null }>({ open: false, data: null });
  const [currentDate, setCurrentDate] = useState(new Date(2024, 5, 1)); // Червень 2024
  const [selectedDay, setSelectedDay] = useState<number>(15);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; 
  };

  const monthDaysCount = daysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const offset = startDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const getEventsForDay = (day: number) => {
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    const dStr = `${year}-${month}-${d}`;
    return events.filter(e => e.date === dStr);
  };

  const selectedDayEvents = getEventsForDay(selectedDay);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-4xl font-black text-blue-950">Календар</h1>
        <button onClick={() => setModal({ open: true, data: null })} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">➕ Створити подію</button>
      </div>

      <EventModal isOpen={modal.open} onClose={() => setModal({ open: false, data: null })} onSave={modal.data ? updateEvent : addEvent} initialData={modal.data} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 bg-white p-8 sm:p-12 rounded-[4rem] shadow-xl border border-gray-100">
           <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-black text-blue-950 capitalize">{currentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}</h2>
              <div className="flex gap-3">
                 <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-3 sm:p-4 bg-gray-50 rounded-2xl">◀</button>
                 <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-3 sm:p-4 bg-gray-50 rounded-2xl">▶</button>
              </div>
           </div>
           <div className="grid grid-cols-7 gap-4">
              {Array.from({ length: offset }).map((_, i) => <div key={`off-${i}`} />)}
              {Array.from({ length: monthDaysCount }).map((_, i) => {
                const day = i + 1;
                const hasEvents = getEventsForDay(day).length > 0;
                return (
                  <button key={day} onClick={() => setSelectedDay(day)} className={`aspect-square rounded-3xl flex flex-col items-center justify-center transition-all ${selectedDay === day ? 'bg-blue-600 text-white scale-110 shadow-2xl z-10' : hasEvents ? 'bg-blue-50 text-blue-900 font-black border border-blue-100' : 'bg-gray-50 text-gray-400 hover:bg-white'}`}>
                     <span className="text-xl font-black">{day}</span>
                  </button>
                );
              })}
           </div>
        </div>

        <aside className="lg:col-span-4 bg-gray-50 p-8 rounded-[3rem] border border-gray-100 flex flex-col max-h-[600px] overflow-y-auto">
           <h3 className="text-2xl font-black mb-8">Події {selectedDay}-го</h3>
           <div className="space-y-6">
              {selectedDayEvents.length > 0 ? selectedDayEvents.map(e => (
                <div key={e.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 group">
                   <div className="flex justify-between items-start mb-4">
                      <span className="text-xl">{getGameTypeIcon(e.type)}</span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                         <button onClick={() => setModal({ open: true, data: e })} className="text-blue-500">✏️</button>
                         <button onClick={() => deleteEvent(e.id)} className="text-red-500">🗑️</button>
                      </div>
                   </div>
                   <h4 className="text-xl font-black text-blue-950 mb-2 leading-tight">{e.title}</h4>
                   <p className="text-xs text-gray-400 font-bold mb-4">📍 {e.location}</p>
                   <button className="w-full py-3 bg-gray-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400">ПЕРЕГЛЯНУТИ</button>
                </div>
              )) : (
                <p className="py-20 text-center text-gray-400 italic">Подій немає</p>
              )}
           </div>
        </aside>
      </div>
    </div>
  );
};

// MarketPage
const MarketPage = () => {
  const { players, addPlayer, updatePlayer, deletePlayer } = React.useContext(PlayersContext);
  const [modal, setModal] = useState<{ open: boolean, data: Player | null }>({ open: false, data: null });
  const [filters, setFilters] = useState({ level: 'all', role: 'all', gender: 'all' });
  const navigate = useNavigate();

  const filtered = useMemo(() => players.filter(p => {
    return (filters.level === 'all' || p.level === filters.level) &&
           (filters.role === 'all' || p.role === filters.role) &&
           (filters.gender === 'all' || p.gender === filters.gender);
  }), [players, filters]);

  const handleSavePlayer = (p: Player) => {
    if (modal.data) updatePlayer(p);
    else addPlayer({ ...p, id: Date.now().toString(), overallRating: 3.5, stats: p.stats || { gamesPlayed: 0, wins: 0, losses: 0 }, reviews: [] });
    setModal({ open: false, data: null });
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in">
      <div className="flex justify-between items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-blue-950">Ринок гравців</h1>
          <p className="text-gray-500 text-lg font-medium">Знайди ідеального партнера по команді.</p>
        </div>
        <button onClick={() => setModal({ open: true, data: null })} className="bg-blue-600 text-white px-10 py-4 rounded-[1.5rem] font-black shadow-xl hover:scale-105 transition-all">➕ Додати анкету</button>
      </div>

      <div className="bg-white p-8 rounded-[4rem] shadow-sm border border-gray-100 flex flex-wrap gap-10">
        <div className="space-y-4">
          <label className="text-[11px] font-black uppercase text-gray-400 tracking-widest ml-1">Рівень</label>
          <select value={filters.level} onChange={(e) => setFilters({...filters, level: e.target.value})} className="w-48 bg-gray-50 p-4 rounded-2xl font-black text-[11px] uppercase outline-none">
            <option value="all">Всі рівні</option>
            {Object.values(PlayerLevel).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="space-y-4">
          <label className="text-[11px] font-black uppercase text-gray-400 tracking-widest ml-1">Амплуа</label>
          <select value={filters.role} onChange={(e) => setFilters({...filters, role: e.target.value})} className="w-48 bg-gray-50 p-4 rounded-2xl font-black text-[11px] uppercase outline-none">
            <option value="all">Всі ролі</option>
            {Object.values(PlayerRole).map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {filtered.map(p => (
          <div key={p.id} className="bg-white rounded-[4rem] shadow-xl overflow-hidden border border-gray-100 flex flex-col group hover:shadow-2xl transition-all">
             <div className="h-64 relative cursor-pointer" onClick={() => navigate(`/player/${p.id}`)}>
               <img src={p.photoUrl || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=800&fit=crop'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={p.name} />
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
               <div className="absolute top-6 right-6 flex gap-2">
                 <button onClick={(e) => { e.stopPropagation(); setModal({ open: true, data: p }); }} className="bg-white/90 p-3 rounded-2xl text-blue-600 shadow-xl">✏️</button>
                 <button onClick={(e) => { e.stopPropagation(); deletePlayer(p.id); }} className="bg-white/90 p-3 rounded-2xl text-red-600 shadow-xl">🗑️</button>
               </div>
               <div className="absolute bottom-8 left-8 text-white">
                 <h3 className="text-2xl font-black leading-none mb-2">{p.name}</h3>
                 <RatingStars rating={p.overallRating} size="md" />
               </div>
             </div>
             <div className="p-10 flex-1 flex flex-col">
               <p className="text-gray-500 text-sm mb-6 italic line-clamp-2">"{p.bio || "Спортивний ентузіаст."}"</p>
               <div className="flex gap-2 mt-auto">
                 <StatBadge label="Ігри" value={p.stats.gamesPlayed} color="blue" />
                 <StatBadge label="Роль" value={p.role.split(' ')[0]} color="purple" />
               </div>
               <button 
                onClick={() => navigate(`/player/${p.id}`)}
                className="w-full mt-8 bg-blue-600 text-white py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest shadow-lg"
               >
                 Переглянути профіль
               </button>
             </div>
          </div>
        ))}
      </div>
      
      <PlayerModal isOpen={modal.open} onClose={() => setModal({ open: false, data: null })} onSave={handleSavePlayer} initialData={modal.data} />
    </div>
  );
};

const PlayerModal = ({ isOpen, onClose, onSave, initialData }: { isOpen: boolean, onClose: () => void, onSave: (p: Player) => void, initialData?: Player | null }) => {
  const [formData, setFormData] = useState<Player>({
    id: '', name: '', age: 40, gender: EventGender.MEN, level: PlayerLevel.AMATEUR, role: PlayerRole.UNIVERSAL, contacts: '', bio: '',
    stats: { gamesPlayed: 0, wins: 0, losses: 0 }, reviews: [], overallRating: 3.5, photoUrl: '', verified: false
  });

  useEffect(() => {
    if (initialData) setFormData(initialData);
    else if (isOpen) setFormData({
      id: '', name: '', age: 40, gender: EventGender.MEN, level: PlayerLevel.AMATEUR, role: PlayerRole.UNIVERSAL, contacts: '', bio: '',
      stats: { gamesPlayed: 0, wins: 0, losses: 0 }, reviews: [], overallRating: 3.5, photoUrl: '', verified: false
    });
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden">
        <div className="p-8 bg-blue-950 text-white flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-black">{initialData ? 'Редагувати анкету' : 'Додати анкету гравця'}</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">✕</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); onClose(); }} className="p-8 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <input required placeholder="ПІБ" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" />
          <div className="grid grid-cols-2 gap-4">
             <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as PlayerRole})} className="bg-gray-50 p-4 rounded-2xl font-bold">
               {Object.values(PlayerRole).map(r => <option key={r} value={r}>{r}</option>)}
             </select>
             <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value as PlayerLevel})} className="bg-gray-50 p-4 rounded-2xl font-bold">
               {Object.values(PlayerLevel).map(l => <option key={l} value={l}>{l}</option>)}
             </select>
          </div>
          <input placeholder="Телефон" value={formData.contacts} onChange={e => setFormData({...formData, contacts: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" />
          <textarea placeholder="Біографія" value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold h-32" />
          <input placeholder="URL Фото" value={formData.photoUrl} onChange={e => setFormData({...formData, photoUrl: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" />
          <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black shadow-xl">Зберегти анкету</button>
        </form>
      </div>
    </div>
  );
};

// Dashboard
const Dashboard = () => {
  const { events } = React.useContext(EventsContext);
  const { players } = React.useContext(PlayersContext);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in">
      <header>
        <h1 className="text-5xl font-black text-blue-950 mb-2">Головна</h1>
        <p className="text-gray-500 text-lg font-medium">Спорт об'єднує серця.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-gray-100 lg:col-span-2">
          <h2 className="text-3xl font-black mb-8">🌟 Найближчі події</h2>
          <div className="grid gap-4">
            {events.slice(0, 3).map(e => (
              <div key={e.id} className="p-6 bg-gray-50 rounded-[2.5rem] flex items-center justify-between hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-blue-100">
                <div className="flex gap-5 items-center">
                   <div className="w-16 h-16 rounded-[1.5rem] bg-blue-900 flex items-center justify-center text-white font-black text-xl shadow-lg">🏐</div>
                   <div>
                      <h4 className="text-xl font-black text-blue-950 mb-1">{e.title}</h4>
                      <p className="text-xs text-gray-500 font-bold">📅 {e.date} • 📍 {e.location}</p>
                   </div>
                </div>
                <span className="bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">{e.type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-950 text-white p-10 rounded-[4rem] shadow-2xl flex flex-col justify-between relative overflow-hidden">
           <div className="relative z-10">
              <h3 className="text-2xl font-black mb-6">📊 Спільнота</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-white/10 rounded-3xl text-center">
                    <p className="text-4xl font-black">{players.length}</p>
                    <p className="text-[10px] font-bold opacity-60 uppercase mt-1 tracking-widest">Гравців</p>
                 </div>
                 <div className="p-4 bg-white/10 rounded-3xl text-center">
                    <p className="text-4xl font-black">{events.length}</p>
                    <p className="text-[10px] font-bold opacity-60 uppercase mt-1 tracking-widest">Подій</p>
                 </div>
              </div>
           </div>
           <Link to="/market" className="block w-full bg-blue-600 py-5 rounded-[2rem] text-center font-black mt-12 hover:bg-blue-500 transition-all shadow-xl relative z-10">РИНОК ГРАВЦІВ</Link>
           <div className="absolute -bottom-10 -right-10 text-9xl opacity-10 rotate-12 select-none">🏐</div>
        </div>
      </div>
    </div>
  );
};

// Main App component
const App = () => {
  const [events, setEvents] = useState<Tournament[]>(INITIAL_TOURNAMENTS);
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);

  const addEvent = (e: Tournament) => setEvents(prev => [...prev, { ...e, id: Date.now().toString() }]);
  const updateEvent = (e: Tournament) => setEvents(prev => prev.map(ev => ev.id === e.id ? e : ev));
  const deleteEvent = (id: string) => setEvents(prev => prev.filter(e => e.id !== id));

  const addPlayer = (p: Player) => setPlayers(prev => [...prev, p]);
  const updatePlayer = (p: Player) => setPlayers(prev => prev.map(pl => pl.id === p.id ? p : pl));
  const deletePlayer = (id: string) => setPlayers(prev => prev.filter(p => p.id !== id));

  const eventsValue = useMemo(() => ({ events, addEvent, updateEvent, deleteEvent }), [events]);
  const playersValue = useMemo(() => ({ players, addPlayer, updatePlayer, deletePlayer }), [players]);

  return (
    <EventsContext.Provider value={eventsValue}>
      <PlayersContext.Provider value={playersValue}>
        <HashRouter>
          <div className="min-h-screen bg-gray-50 font-sans text-blue-950">
            <nav className="bg-white border-b border-gray-100 sticky top-0 z-[80] px-8 py-5">
              <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Link to="/" className="text-2xl font-black italic tracking-tighter flex items-center gap-2">
                  <span className="bg-blue-900 text-white w-10 h-10 flex items-center justify-center rounded-xl not-italic">🏐</span>
                  АВВУ
                </Link>
                <div className="flex gap-8 items-center">
                  <Link to="/" className="text-[11px] font-black uppercase tracking-widest hover:text-blue-600 transition-colors">Головна</Link>
                  <Link to="/events" className="text-[11px] font-black uppercase tracking-widest hover:text-blue-600 transition-colors">Календар</Link>
                  <Link to="/market" className="text-[11px] font-black uppercase tracking-widest hover:text-blue-600 transition-colors">Ринок</Link>
                </div>
              </div>
            </nav>

            <main className="pb-24">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/events" element={<CalendarPage />} />
                <Route path="/market" element={<MarketPage />} />
                <Route path="/player/:id" element={<PlayerProfilePage />} />
              </Routes>
            </main>

            <SevaAssistant />
          </div>
        </HashRouter>
      </PlayersContext.Provider>
    </EventsContext.Provider>
  );
};

export default App;