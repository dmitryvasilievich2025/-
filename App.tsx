import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { SevaAssistant } from './components/SevaAssistant';
import { geminiService } from './services/gemini';
import { PlayerLevel, PlayerRole, GameType, Tournament, Player, PlayerStats, ChatMessage, PlayerReview, EventCategory, EventGender } from './types';

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
    bio: 'Майстер спорту міжнародного класу. Грав за збірну. Шукаю серйозну команду для ветеранських ліг.',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    verified: true,
    stats: { gamesPlayed: 450, wins: 310, losses: 140, blocks: 120, bestAchievement: 'Чемпіон України 2005' },
    reviews: [{ id: 'r1', author: 'Сергій П.', rating: 5, comment: 'Справжня легенда.', date: '2024-05-10' }],
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
    bio: 'Заслужений майстер спорту. Потужна атака та досвід.',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
    verified: true,
    stats: { gamesPlayed: 600, wins: 480, losses: 120, aces: 90, bestAchievement: 'Олімпійська надія 2000' },
    reviews: [],
    overallRating: 4.9
  }
];

const INITIAL_TOURNAMENTS: Tournament[] = [
  { id: '1', title: 'Кубок Ветеранів Києва', date: '2024-06-15', location: 'Київ, Гідропарк', type: GameType.BEACH, category: EventCategory.TOURNAMENT, gender: EventGender.MEN, ageCategory: '40+', requirements: 'Наявність форми.', organizer: 'Іван Петренко', organizerContact: '+380671234567', photoUrl: 'https://images.unsplash.com/photo-1592656094267-764a45160876?w=800&q=80' },
  { id: '2', title: 'Чемпіонат України 50+', date: '2024-07-20', location: 'Одеса, Палац Спорту', type: GameType.CLASSIC, category: EventCategory.CHAMPIONSHIP, gender: EventGender.MEN, ageCategory: '50+', requirements: 'Паспорт.', organizer: 'Марія Коваль', organizerContact: '+380507654321', photoUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80' },
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
    <div className="flex items-center gap-0.5">
      {stars.map(s => (
        <span key={s} className={`${iconSize} ${s <= Math.round(rating) ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
      ))}
      <span className={`ml-1 font-black text-amber-600 ${size === "lg" ? 'text-2xl' : 'text-xs'}`}>{rating}</span>
    </div>
  );
};

const StatBadge = ({ label, value, color = "blue" }: { label: string, value: string | number, color?: string }) => (
  <div className={`bg-${color}-50 border border-${color}-100 p-2 rounded-xl text-center flex-1`}>
    <p className="text-[9px] uppercase font-black text-gray-400 tracking-wider mb-1">{label}</p>
    <p className={`text-sm font-black text-${color}-900`}>{value}</p>
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
    ageCategory: '', requirements: '', organizer: '', organizerContact: '', photoUrl: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (initialData) setFormData(initialData);
    else if (isOpen) setFormData({
      id: '', title: '', date: '', location: '', type: GameType.CLASSIC, category: EventCategory.TOURNAMENT, gender: EventGender.MEN,
      ageCategory: '', requirements: '', organizer: '', organizerContact: '', photoUrl: ''
    });
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 bg-blue-950 text-white flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-black">{initialData ? 'Редагувати подію' : 'Створити подію'}</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">✕</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); onClose(); }} className="p-8 overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Назва турніру</label>
              <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none transition-all" placeholder="Наприклад: Кубок Незалежності" />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Тип гри</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.values(GameType).map(t => (
                  <label key={t} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer font-bold transition-all ${formData.type === t ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105' : 'bg-white text-gray-400 border-gray-100 hover:border-blue-200'}`}>
                    <input type="radio" name="gameType" value={t} checked={formData.type === t} onChange={() => setFormData({...formData, type: t})} className="hidden" />
                    <span className="text-2xl mb-1">{getGameTypeIcon(t as GameType)}</span>
                    <span className="text-[10px] uppercase tracking-widest">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Дата</label>
                <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Локація</label>
                <input required placeholder="Місто, стадіон" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              </div>
            </div>
            
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Зображення (URL)</label>
                <input value={formData.photoUrl} onChange={e => setFormData({...formData, photoUrl: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" placeholder="https://..." />
              </div>
              <button 
                type="button" 
                onClick={async () => {
                  if(!formData.title) return alert("Введіть назву турніру для AI!");
                  setIsGenerating(true);
                  try {
                    const url = await geminiService.generatePromoImage(`Professional volleyball photography for tournament: ${formData.title}`, "1K");
                    setFormData(prev => ({ ...prev, photoUrl: url }));
                  } catch(err) {
                    console.error(err);
                  } finally { setIsGenerating(false); }
                }} 
                disabled={isGenerating}
                className="bg-blue-600 text-white px-6 h-[56px] rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center min-w-[60px]"
              >
                {isGenerating ? '⏳' : '🤖 AI'}
              </button>
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-900 text-white py-5 rounded-3xl font-black text-xl shadow-xl hover:bg-black transition-all">
            {initialData ? 'Зберегти зміни' : 'Створити подію'}
          </button>
        </form>
      </div>
    </div>
  );
};

const PlayerModal = ({ isOpen, onClose, onSave, initialData }: { isOpen: boolean, onClose: () => void, onSave: (p: Player) => void, initialData?: Player | null }) => {
  const [formData, setFormData] = useState<Player>({
    id: '', name: '', age: 40, gender: EventGender.MEN, level: PlayerLevel.AMATEUR, role: PlayerRole.UNIVERSAL, contacts: '', bio: '',
    stats: { gamesPlayed: 0, wins: 0, losses: 0 }, reviews: [], overallRating: 3.5, photoUrl: '', verified: false
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else if (isOpen) {
      setFormData({
        id: '', name: '', age: 40, gender: EventGender.MEN, level: PlayerLevel.AMATEUR, role: PlayerRole.UNIVERSAL, contacts: '', bio: '',
        stats: { gamesPlayed: 0, wins: 0, losses: 0 }, reviews: [], overallRating: 3.5, photoUrl: '', verified: false
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-blue-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 bg-blue-950 text-white flex justify-between items-center shrink-0">
          <h2 className="text-2xl font-black">{initialData ? 'Редагувати анкету' : 'Додати анкету гравця'}</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white text-2xl">✕</button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSave(formData); onClose(); }} className="p-8 overflow-y-auto space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Прізвище та Ім'я</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" placeholder="Введіть повне ім'я" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Стать</label>
                <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as EventGender})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500">
                  {Object.values(EventGender).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Вік</label>
                <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: parseInt(e.target.value) || 0})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" placeholder="Вік" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Амплуа</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as PlayerRole})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500">
                  {Object.values(PlayerRole).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Рівень</label>
                <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value as PlayerLevel})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500">
                  {Object.values(PlayerLevel).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Контактний телефон / Telegram</label>
              <input required placeholder="+380..." value={formData.contacts} onChange={e => setFormData({...formData, contacts: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">Біографія / Досягнення</label>
              <textarea placeholder="Опишіть свій досвід..." value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold h-32 outline-none border-2 border-transparent focus:border-blue-500" />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-gray-400 mb-2 block tracking-widest">URL Фото</label>
              <input placeholder="https://images.unsplash.com/..." value={formData.photoUrl} onChange={e => setFormData({...formData, photoUrl: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-[2rem] font-black shadow-xl hover:bg-blue-700 transition-all">
            {initialData ? 'Зберегти зміни' : 'Опублікувати анкету'}
          </button>
        </form>
      </div>
    </div>
  );
};

const RequestPlayModal = ({ isOpen, onClose, player, tournaments }: { isOpen: boolean, onClose: () => void, player: Player | null, tournaments: Tournament[] }) => {
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !player) return null;

  const handleSend = () => {
    if (!selectedTournament) return alert("Оберіть турнір!");
    setIsSending(true);
    setTimeout(() => {
      alert(`Запит для гравця ${player.name} надіслано!`);
      setIsSending(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-blue-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-10 bg-blue-950 text-white shrink-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-black italic">Запросити на гру</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors text-2xl">✕</button>
          </div>
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-blue-600 shadow-xl">
              <img src={player.photoUrl || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=100&fit=crop'} className="w-full h-full object-cover" alt={player.name} />
            </div>
            <div>
              <p className="text-xl font-black">{player.name}</p>
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">{player.role}</p>
            </div>
          </div>
        </div>
        <div className="p-10 overflow-y-auto flex-1 space-y-8">
          <div>
            <label className="text-[10px] font-black uppercase text-gray-400 mb-4 block tracking-[0.2em]">Оберіть доступний турнір</label>
            <div className="space-y-3">
              {tournaments.length > 0 ? tournaments.map(t => (
                <label key={t.id} className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all cursor-pointer group ${selectedTournament === t.id ? 'bg-blue-50 border-blue-600 shadow-lg' : 'bg-gray-50 border-transparent hover:bg-white hover:border-blue-200'}`}>
                  <input type="radio" name="tournament" value={t.id} checked={selectedTournament === t.id} onChange={() => setSelectedTournament(t.id)} className="w-5 h-5 accent-blue-600" />
                  <div className="flex-1">
                    <p className={`font-black text-sm transition-colors ${selectedTournament === t.id ? 'text-blue-950' : 'text-gray-600'}`}>{t.title}</p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-[10px] font-bold text-gray-400">📅 {t.date}</span>
                      <span className="text-[10px] font-bold text-gray-400">📍 {t.location}</span>
                    </div>
                  </div>
                </label>
              )) : (
                <p className="text-center py-10 text-gray-400 font-bold italic">Турнірів поки не заплановано...</p>
              )}
            </div>
          </div>
        </div>
        <div className="p-10 bg-gray-50 border-t border-gray-100 shrink-0">
          <button 
            disabled={!selectedTournament || isSending} 
            onClick={handleSend}
            className={`w-full py-6 rounded-[2rem] font-black text-xl shadow-xl transition-all ${!selectedTournament || isSending ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-black hover:scale-105 active:scale-95 shadow-blue-200'}`}
          >
            {isSending ? 'НАДСИЛАННЯ...' : 'НАДІСЛАТИ ЗАПИТ'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Pages
const Dashboard = () => {
  const { events } = React.useContext(EventsContext);
  const { players } = React.useContext(PlayersContext);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in">
      <header>
        <h1 className="text-5xl font-black text-blue-950 mb-2">Головна</h1>
        <p className="text-gray-500 text-lg font-medium">Ваш центр волейбольної активності.</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-black">🌟 Найближчі події</h2>
            <Link to="/events" className="text-blue-600 font-black text-xs uppercase tracking-widest hover:underline">Всі події</Link>
          </div>
          <div className="grid gap-4">
            {events.slice(0, 3).map(e => (
              <div key={e.id} className="p-6 bg-gray-50 rounded-[2.5rem] flex items-center justify-between hover:bg-white hover:shadow-xl transition-all border border-transparent hover:border-blue-100 cursor-default">
                <div className="flex gap-5 items-center">
                   <div className="w-16 h-16 bg-blue-900 rounded-[1.5rem] flex items-center justify-center text-white italic font-black text-xl shadow-lg">УВ</div>
                   <div>
                      <h4 className="text-xl font-black text-blue-950 mb-1">{e.title}</h4>
                      <div className="flex gap-4 text-xs text-gray-500 font-bold">
                         <span>📅 {e.date}</span>
                         <span>📍 {e.location}</span>
                      </div>
                   </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xl">{getGameTypeIcon(e.type)}</span>
                  <span className="bg-blue-100 text-blue-600 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">{e.type}</span>
                </div>
              </div>
            ))}
            {events.length === 0 && <p className="text-gray-400 font-bold text-center py-10 italic">Подій поки немає...</p>}
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
                    <p className="text-[10px] font-bold opacity-60 uppercase mt-1 tracking-widest">Турнірів</p>
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

const CalendarPage = () => {
  const { events, addEvent, updateEvent, deleteEvent } = React.useContext(EventsContext);
  const [modal, setModal] = useState<{ open: boolean, data: Tournament | null }>({ open: false, data: null });
  const [currentDate, setCurrentDate] = useState(new Date(2024, 5, 1)); // Червень 2024
  const [selectedDay, setSelectedDay] = useState<number>(15);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const startDayOfMonth = (year: number, month: number) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // 0=Pn, 6=Nd
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

  const handleExport = () => {
    const csv = ["ID,Title,Date,Location,Type", ...events.map(e => `"${e.id}","${e.title}","${e.date}","${e.location}","${e.type}"`)].join("\n");
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "events_export.csv";
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").slice(1);
      lines.forEach(l => {
        const parts = l.split(",").map(p => p.replace(/"/g, ''));
        if (parts.length >= 4) {
          addEvent({
            id: Math.random().toString(), title: parts[1], date: parts[2], location: parts[3],
            type: parts[4] as GameType || GameType.CLASSIC,
            category: EventCategory.TOURNAMENT, gender: EventGender.MEN, organizer: 'Імпорт', organizerContact: '-', ageCategory: '', requirements: ''
          });
        }
      });
      alert("Дані успішно імпортовано!");
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-4xl font-black text-blue-950">Календар подій</h1>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport} className="bg-white border border-gray-100 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2">📥 Експорт</button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-gray-100 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2">📤 Імпорт</button>
          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".csv" />
          <button onClick={() => setModal({ open: true, data: null })} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:scale-105 transition-all">➕ Нова подія</button>
        </div>
      </div>

      <EventModal isOpen={modal.open} onClose={() => setModal({ open: false, data: null })} onSave={modal.data ? updateEvent : addEvent} initialData={modal.data} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 bg-white p-8 sm:p-12 rounded-[4rem] shadow-xl border border-gray-100">
           <div className="flex justify-between items-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-black text-blue-950 capitalize">{currentDate.toLocaleString('uk-UA', { month: 'long', year: 'numeric' })}</h2>
              <div className="flex gap-3">
                 <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()-1, 1))} className="p-3 sm:p-4 bg-gray-50 rounded-2xl hover:bg-blue-50 transition-colors">◀</button>
                 <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 1))} className="p-3 sm:p-4 bg-gray-50 rounded-2xl hover:bg-blue-50 transition-colors">▶</button>
              </div>
           </div>
           
           <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-4 text-center">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map(d => <div key={d} className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{d}</div>)}
           </div>
           
           <div className="grid grid-cols-7 gap-2 sm:gap-4">
              {Array.from({ length: offset }).map((_, i) => <div key={`off-${i}`} />)}
              {Array.from({ length: monthDaysCount }).map((_, i) => {
                const day = i + 1;
                const dailyEvents = getEventsForDay(day);
                const hasEvents = dailyEvents.length > 0;
                const isSelected = selectedDay === day;
                return (
                  <button 
                    key={day} 
                    onClick={() => setSelectedDay(day)}
                    className={`aspect-square rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center transition-all relative ${isSelected ? 'bg-blue-600 text-white scale-110 shadow-2xl z-10' : hasEvents ? 'bg-blue-50 text-blue-900 font-black border border-blue-100' : 'bg-gray-50 text-gray-400 hover:bg-white'}`}
                  >
                     <span className="text-lg sm:text-xl font-black">{day}</span>
                     {hasEvents && !isSelected && <div className="absolute bottom-2 sm:bottom-3 w-1.5 h-1.5 bg-blue-500 rounded-full" />}
                  </button>
                );
              })}
           </div>
        </div>

        <aside className="lg:col-span-4 bg-gray-50 p-8 rounded-[3rem] border border-gray-100 flex flex-col overflow-hidden max-h-[700px]">
           <h3 className="text-2xl font-black mb-8 flex items-center justify-between shrink-0">
              <span>Події {selectedDay}-го</span>
              {selectedDayEvents.length > 0 && <span className="bg-blue-950 text-white px-3 py-1 rounded-full text-[10px]">{selectedDayEvents.length}</span>}
           </h3>
           <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">
              {selectedDayEvents.length > 0 ? selectedDayEvents.map(e => (
                <div key={e.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 group hover:shadow-xl transition-all">
                   <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getGameTypeIcon(e.type)}</span>
                        <span className="bg-blue-900 text-white px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">{e.type}</span>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                         <button onClick={() => setModal({ open: true, data: e })} className="text-blue-500 text-sm hover:scale-125">✏️</button>
                         <button onClick={() => deleteEvent(e.id)} className="text-red-500 text-sm hover:scale-125">🗑️</button>
                      </div>
                   </div>
                   <h4 className="text-xl font-black text-blue-950 mb-2 leading-tight">{e.title}</h4>
                   <p className="text-xs text-gray-400 font-bold mb-4">📍 {e.location}</p>
                   <button className="w-full py-3 bg-gray-50 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-blue-600 transition-all">ПЕРЕГЛЯНУТИ</button>
                </div>
              )) : (
                <div className="py-24 text-center opacity-20 flex flex-col items-center select-none">
                   <div className="text-7xl mb-6 grayscale">🏐</div>
                   <p className="font-black text-sm uppercase tracking-widest">Немає подій на цей день</p>
                </div>
              )}
           </div>
        </aside>
      </div>
    </div>
  );
};

const MarketPage = () => {
  const { players, addPlayer, updatePlayer, deletePlayer } = React.useContext(PlayersContext);
  const { events } = React.useContext(EventsContext);
  const [modal, setModal] = useState<{ open: boolean, data: Player | null }>({ open: false, data: null });
  const [requestModal, setRequestModal] = useState<{ open: boolean, player: Player | null }>({ open: false, player: null });
  const [filters, setFilters] = useState({ level: 'all', role: 'all', gender: 'all' });

  const filtered = useMemo(() => players.filter(p => {
    return (filters.level === 'all' || p.level === filters.level) &&
           (filters.role === 'all' || p.role === filters.role) &&
           (filters.gender === 'all' || p.gender === filters.gender);
  }), [players, filters]);

  const resetFilters = () => setFilters({ level: 'all', role: 'all', gender: 'all' });

  const handleSavePlayer = (p: Player) => {
    if (modal.data) {
      updatePlayer(p);
    } else {
      addPlayer({
        ...p,
        id: Date.now().toString(),
        overallRating: 3.5,
        stats: p.stats || { gamesPlayed: 0, wins: 0, losses: 0 },
        reviews: []
      });
    }
    setModal({ open: false, data: null });
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Ви впевнені, що хочете видалити цю анкету?")) {
      deletePlayer(id);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-blue-950">Ринок гравців</h1>
          <p className="text-gray-500 text-lg font-medium">Знайди ідеального напарника для своєї команди.</p>
        </div>
        <button onClick={() => setModal({ open: true, data: null })} className="bg-blue-600 text-white px-10 py-4 rounded-[1.5rem] font-black shadow-xl hover:scale-105 transition-all">➕ Додати анкету</button>
      </div>

      <PlayerModal 
        isOpen={modal.open} 
        onClose={() => setModal({ open: false, data: null })} 
        onSave={handleSavePlayer} 
        initialData={modal.data} 
      />

      <RequestPlayModal
        isOpen={requestModal.open}
        onClose={() => setRequestModal({ open: false, player: null })}
        player={requestModal.player}
        tournaments={events}
      />

      <div className="bg-white p-8 sm:p-10 rounded-[4rem] shadow-sm border border-gray-100 flex flex-col gap-8">
         <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="space-y-4">
               <label className="text-[11px] font-black uppercase text-gray-400 tracking-widest ml-1">Стать</label>
               <div className="flex flex-wrap gap-2">
                  <button onClick={() => setFilters({...filters, gender: 'all'})} className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filters.gender === 'all' ? 'bg-blue-900 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:text-blue-900'}`}>Всі</button>
                  {Object.values(EventGender).map(g => (
                    <button key={g} onClick={() => setFilters({...filters, gender: g})} className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filters.gender === g ? 'bg-blue-900 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:text-blue-900'}`}>{g}</button>
                  ))}
               </div>
            </div>
            <div className="space-y-4">
               <label className="text-[11px] font-black uppercase text-gray-400 tracking-widest ml-1">Рівень</label>
               <div className="flex flex-wrap gap-2">
                  <button onClick={() => setFilters({...filters, level: 'all'})} className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filters.level === 'all' ? 'bg-blue-900 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:text-blue-900'}`}>Всі</button>
                  {Object.values(PlayerLevel).map(l => (
                    <button key={l} onClick={() => setFilters({...filters, level: l})} className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${filters.level === l ? 'bg-blue-900 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:text-blue-900'}`}>{l}</button>
                  ))}
               </div>
            </div>
            <div className="space-y-4">
               <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black uppercase text-gray-400 tracking-widest ml-1">Амплуа</label>
                  <button onClick={resetFilters} className="text-[9px] font-black text-blue-600 uppercase hover:underline">Скинути</button>
               </div>
               <select value={filters.role} onChange={(e) => setFilters({...filters, role: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-black text-[11px] uppercase tracking-widest outline-none border-2 border-transparent focus:border-blue-900 transition-all cursor-pointer">
                  <option value="all">ВСІ РОЛІ</option>
                  {Object.values(PlayerRole).map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
               </select>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {filtered.length > 0 ? filtered.map(p => (
          <div key={p.id} className="bg-white rounded-[4rem] shadow-xl overflow-hidden border border-gray-100 flex flex-col group hover:shadow-2xl transition-all animate-in fade-in zoom-in-95">
             <div className="h-64 relative overflow-hidden">
               <img src={p.photoUrl || 'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=800&fit=crop'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.name} />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
               <div className="absolute top-6 right-6 flex gap-2">
                 <button onClick={() => setModal({ open: true, data: p })} className="bg-white/90 p-3 rounded-2xl text-blue-600 shadow-xl hover:scale-110 transition-all">✏️</button>
                 <button onClick={() => handleDelete(p.id)} className="bg-white/90 p-3 rounded-2xl text-red-600 shadow-xl hover:scale-110 transition-all">🗑️</button>
               </div>
               <div className="absolute bottom-8 left-8 text-white">
                 <h3 className="text-2xl font-black leading-none mb-2">{p.name}</h3>
                 <RatingStars rating={p.overallRating} size="md" />
               </div>
               <span className="absolute top-6 left-8 bg-blue-900 text-white px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-2xl">{p.level}</span>
             </div>
             <div className="p-10 flex-1 flex flex-col">
               <p className="text-gray-500 text-sm mb-4 italic line-clamp-3 leading-relaxed">"{p.bio || 'Майстер своєї справи, завжди готовий до нових викликів на майданчику.'}"</p>
               <p className="text-blue-600 font-black text-[10px] uppercase mb-4 tracking-widest">📞 {p.contacts || 'Контакти не вказані'}</p>
               <div className="flex gap-2 mt-auto">
                 <StatBadge label="Ігри" value={p.stats.gamesPlayed} />
                 <StatBadge label="Перемоги" value={p.stats.wins} color="green" />
                 <StatBadge label="Роль" value={p.role.split(' ')[0]} color="purple" />
               </div>
               <div className="grid grid-cols-2 gap-3 mt-10">
                 <button className="bg-gray-50 text-blue-900 py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-all">ЗВ'ЯЗАТИСЯ</button>
                 <button 
                  onClick={() => setRequestModal({ open: true, player: p })}
                  className="bg-blue-600 text-white py-4 rounded-3xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-blue-100"
                 >
                   ЗАПРОСИТИ
                 </button>
               </div>
             </div>
          </div>
        )) : (
          <div className="col-span-full py-40 text-center opacity-20 flex flex-col items-center select-none">
             <div className="text-9xl mb-8 grayscale">🫂</div>
             <p className="text-2xl font-black uppercase tracking-[0.2em]">Нікого не знайдено за фільтрами</p>
             <button onClick={resetFilters} className="mt-6 text-blue-600 font-black uppercase tracking-widest hover:underline text-sm">Скинути фільтри</button>
          </div>
        )}
      </div>
    </div>
  );
};

// Main App Component
function App() {
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [events, setEvents] = useState<Tournament[]>(INITIAL_TOURNAMENTS);
  const [players, setPlayers] = useState<Player[]>(INITIAL_PLAYERS);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) setApiKeySelected(true);
    };
    checkKey();
  }, []);

  const eventActions = {
    addEvent: (e: Tournament) => setEvents(prev => [{ ...e, id: e.id || Date.now().toString() }, ...prev]),
    updateEvent: (e: Tournament) => setEvents(prev => prev.map(item => item.id === e.id ? e : item)),
    deleteEvent: (id: string) => setEvents(prev => prev.filter(item => item.id !== id))
  };

  const playerActions = {
    addPlayer: (p: Player) => setPlayers(prev => [{ ...p, id: p.id || Date.now().toString() }, ...prev]),
    updatePlayer: (p: Player) => setPlayers(prev => prev.map(item => item.id === p.id ? p : item)),
    deletePlayer: (id: string) => setPlayers(prev => prev.filter(item => item.id !== id))
  };

  return (
    <EventsContext.Provider value={{ events, ...eventActions }}>
      <PlayersContext.Provider value={{ players, ...playerActions }}>
        <HashRouter>
          <div className="flex flex-col md:flex-row min-h-screen bg-[#FDFDFF] text-blue-950 font-['Roboto'] selection:bg-blue-100">
            {/* Sidebar Navigation */}
            <nav className="fixed bottom-0 md:relative w-full md:w-80 lg:w-96 bg-white border-r border-gray-100 p-6 sm:p-8 z-50 flex md:flex-col justify-around md:justify-start gap-4 shadow-2xl md:shadow-none">
              <div className="hidden md:flex flex-col items-center mb-16 lg:mb-24">
                <div className="w-20 h-20 lg:w-24 lg:h-24 bg-blue-950 rounded-[2.5rem] shadow-2xl flex items-center justify-center mb-6 hover:rotate-6 transition-transform">
                  <span className="text-white text-3xl lg:text-4xl font-black italic">УВ</span>
                </div>
                <h1 className="text-xl lg:text-2xl font-black leading-tight text-center tracking-tight text-blue-950">Асоціація<br/><span className="text-blue-600">Ветеранів</span></h1>
              </div>
              {[
                { to: '/', icon: '🏠', label: 'Головна' },
                { to: '/events', icon: '📅', label: 'Події' },
                { to: '/market', icon: '🫂', label: 'Ринок' },
                { to: '/profile', icon: '👤', label: 'Профіль' },
              ].map(l => (
                <Link key={l.to} to={l.to} className="flex flex-col md:flex-row items-center gap-4 lg:gap-5 p-4 sm:p-5 rounded-[2rem] hover:bg-blue-50 font-black uppercase text-[10px] lg:text-[11px] tracking-[0.2em] text-gray-400 hover:text-blue-900 transition-all group">
                  <span className="text-xl lg:text-2xl group-hover:scale-125 transition-transform">{l.icon}</span>
                  <span className="hidden md:inline">{l.label}</span>
                </Link>
              ))}
            </nav>

            <main className="flex-1 pb-24 md:pb-0 overflow-y-auto bg-[#FDFDFF]">
              {!apiKeySelected ? (
                <div className="h-full flex flex-col items-center justify-center p-8 sm:p-20 text-center space-y-8 animate-in fade-in">
                  <div className="w-32 h-32 sm:w-40 sm:h-40 bg-blue-50 rounded-[4rem] flex items-center justify-center text-6xl sm:text-7xl shadow-inner animate-bounce">🦾</div>
                  <h2 className="text-4xl sm:text-5xl font-black">СЕВА ШІ</h2>
                  <p className="text-gray-500 max-w-md text-base sm:text-lg font-medium leading-relaxed">Підключіть свій API ключ для активації помічника та розумних функцій Асоціації.</p>
                  <button onClick={() => window.aistudio.openSelectKey().then(() => setApiKeySelected(true))} className="bg-blue-600 text-white px-12 sm:px-16 py-5 sm:py-6 rounded-[2.5rem] font-black text-xl sm:text-2xl shadow-2xl hover:scale-105 transition-all">УВІЙТИ</button>
                </div>
              ) : (
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/events" element={<CalendarPage />} />
                  <Route path="/market" element={<MarketPage />} />
                  <Route path="/profile" element={<div className="p-20 text-4xl font-black text-center opacity-10 uppercase tracking-widest h-full flex items-center justify-center italic">В розробці...</div>} />
                </Routes>
              )}
            </main>
            <SevaAssistant onCommand={(c) => {
               const cmd = c.toLowerCase();
               if (cmd.includes('поді')) window.location.hash = '/events';
               if (cmd.includes('ринок')) window.location.hash = '/market';
               if (cmd.includes('голов')) window.location.hash = '/';
            }} />
          </div>
        </HashRouter>
      </PlayersContext.Provider>
    </EventsContext.Provider>
  );
}

export default App;