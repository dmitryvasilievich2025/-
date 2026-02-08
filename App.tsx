
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { SevaAssistant } from './components/SevaAssistant';
import { geminiService } from './services/gemini';
import { PlayerLevel, PlayerRole, GameType, Tournament, Team, Player, PlayerStats, ChatMessage, PlayerReview, EventCategory, EventGender } from './types';

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

// Mock Data
const MOCK_PLAYERS: Player[] = [
  {
    id: 'p1',
    name: 'Олександр Волков',
    age: 52,
    level: PlayerLevel.PROFESSIONAL,
    role: PlayerRole.MIDDLE_BLOCKER,
    contacts: '+380671112233',
    bio: 'Майстер спорту міжнародного класу. Грав за збірну. Шукаю серйозну команду для ветеранських ліг.',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
    verified: true,
    stats: { gamesPlayed: 450, wins: 310, losses: 140, blocks: 120, bestAchievement: 'Чемпіон України 2005' },
    reviews: [
      { id: 'r1', author: 'Сергій П.', rating: 5, comment: 'Справжня легенда. Надійна стіна в центрі!', date: '2024-05-10' },
      { id: 'r2', author: 'Анна М.', rating: 4, comment: 'Дуже досвідчений гравець, хоча швидкість вже не та.', date: '2024-04-20' }
    ],
    overallRating: 4.8
  },
  {
    id: 'p2',
    name: 'Ірина Клименко',
    age: 41,
    level: PlayerLevel.SEMI_PRO,
    role: PlayerRole.SETTER,
    contacts: '+380504445566',
    bio: 'Люблю волейбол понад усе. Швидка передача, гарна подача.',
    photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
    stats: { gamesPlayed: 120, wins: 85, losses: 35, aces: 45, bestAchievement: 'Кращий зв\'язуючий Одеської області' },
    reviews: [
      { id: 'r3', author: 'Олег В.', rating: 5, comment: 'Найкращий пасуючий, з яким я грав.', date: '2024-05-15' }
    ],
    overallRating: 4.6
  }
].map(p => ({ ...p, overallRating: calculatePlayerRating(p.stats, p.reviews) }));

const INITIAL_TOURNAMENTS: Tournament[] = [
  { id: '1', title: 'Кубок Ветеранів Києва', date: '2024-06-15', location: 'Київ, Гідропарк', type: GameType.BEACH, category: EventCategory.TOURNAMENT, gender: EventGender.MIXED, ageCategory: '40+', requirements: 'Наявність спортивної форми, медична довідка.', organizer: 'Іван Петренко', organizerContact: '+380671234567', photoUrl: 'https://images.unsplash.com/photo-1592656094267-764a45160876?w=800&q=80' },
  { id: '2', title: 'Чемпіонат України 50+', date: '2024-07-20', location: 'Одеса, Палац Спорту', type: GameType.CLASSIC, category: EventCategory.CHAMPIONSHIP, gender: EventGender.MEN, ageCategory: '50+', requirements: 'Паспорт, страховка, внесок 200 грн.', organizer: 'Марія Коваль', organizerContact: '+380507654321', photoUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80' },
];

const MOCK_MESSAGES: ChatMessage[] = [
  { id: 'm1', sender: 'Олександр Волков', text: 'Привіт усім! Хто готовий до тренування у вівторок?', timestamp: new Date(Date.now() - 3600000) },
  { id: 'm2', sender: 'Ірина Клименко', text: 'Я буду! Можу взяти м’ячі.', timestamp: new Date(Date.now() - 1800000) },
];

const EventsContext = React.createContext<{ events: Tournament[], addEvent: (e: Tournament) => void }>({ events: [], addEvent: () => {} });

// UI Components
const RatingStars = ({ rating, size = "sm" }: { rating: number, size?: "sm" | "md" | "lg" }) => {
  const stars = Array.from({ length: 5 }, (_, i) => i + 1);
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
  <div className={`bg-${color}-50 border border-${color}-100 p-2 rounded-xl text-center`}>
    <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">{label}</p>
    <p className={`text-lg font-black text-${color}-700`}>{value}</p>
  </div>
);

const PlayerCard = ({ player }: { player: Player }) => (
  <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all group animate-in fade-in zoom-in-95 duration-300">
    <div className="relative h-48 overflow-hidden">
      <img src={player.photoUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={player.name} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-4 left-4 right-4 text-white">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-black text-xl leading-none">{player.name}</h3>
          {player.verified && <span className="bg-blue-500 text-white p-0.5 rounded-full text-[10px]">✔</span>}
        </div>
        <RatingStars rating={player.overallRating} />
        <p className="text-sm opacity-90 mt-1">{player.age} років • {player.role}</p>
      </div>
      <div className="absolute top-4 right-4">
        <span className="bg-white/90 backdrop-blur-md text-blue-900 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
          {player.level}
        </span>
      </div>
    </div>
    <div className="p-5">
      <p className="text-gray-600 text-sm line-clamp-2 mb-4 h-10">{player.bio}</p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatBadge label="Ігри" value={player.stats.gamesPlayed} />
        <StatBadge label="Перемоги" value={player.stats.wins} color="green" />
        <StatBadge label="Вінрейт" value={player.stats.gamesPlayed > 0 ? `${Math.round((player.stats.wins / player.stats.gamesPlayed) * 100)}%` : '0%'} color="purple" />
      </div>
      <button className="w-full bg-blue-600 text-white py-3 rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">
        Зв'язатися
      </button>
    </div>
  </div>
);

const Dashboard = () => {
  const { events } = React.useContext(EventsContext);
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-10">
        <h1 className="text-4xl font-black text-blue-950">Спортивна Панель</h1>
        <p className="text-gray-500 font-medium">Вітаємо в системі ветеранів волейболу України!</p>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
              <span className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm italic">{events.length}</span>
              Найближчі Події
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.slice(0, 2).map(t => (
                <div key={t.id} className="group p-6 bg-gray-50 rounded-3xl border border-gray-200 hover:border-blue-400 hover:bg-white transition-all cursor-pointer">
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-blue-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{t.type}</span>
                    <p className="font-bold text-blue-600">{t.date}</p>
                  </div>
                  <h3 className="font-black text-xl text-gray-900 mb-2">{t.title}</h3>
                  <p className="text-sm text-gray-500">📍 {t.location}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black">Топ Рейтинг</h2>
                <Link to="/market" className="text-blue-600 font-bold text-sm hover:underline">Всі гравці →</Link>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {MOCK_PLAYERS.sort((a,b) => b.overallRating - a.overallRating).slice(0, 2).map(p => <PlayerCard key={p.id} player={p} />)}
             </div>
          </div>
        </section>
        <aside className="space-y-8">
           <section className="bg-blue-950 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
            <h2 className="text-xl font-black mb-6">🔥 Швидкі Посилання</h2>
            <Link to="/events" className="block w-full bg-white/10 p-4 rounded-2xl mb-4 hover:bg-white/20 font-bold">Створити Подію</Link>
            <Link to="/media" className="block w-full bg-blue-600 p-4 rounded-2xl hover:bg-blue-700 font-bold text-center">Генератор Медіа</Link>
          </section>
        </aside>
      </div>
    </div>
  );
};

const CreateEventModal = ({ isOpen, onClose, onAdd }: { isOpen: boolean, onClose: () => void, onAdd: (e: Tournament) => void }) => {
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    location: '',
    type: GameType.CLASSIC,
    category: EventCategory.TOURNAMENT,
    gender: EventGender.MEN,
    ageCategory: '',
    requirements: '',
    organizer: 'Моє Ім\'я',
    organizerContact: '+380',
    photoUrl: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ ...formData, id: Date.now().toString() });
    onClose();
  };

  const handleGenerateAIPhoto = async () => {
    if (!formData.title) return alert("Спочатку введіть назву події!");
    setIsGenerating(true);
    try {
      const prompt = `Professional sports promotional photo for a volleyball ${formData.category.toLowerCase()} named '${formData.title}' in ${formData.location}. High resolution, action shot, athletic style.`;
      const url = await geminiService.generatePromoImage(prompt, "1K");
      setFormData(prev => ({ ...prev, photoUrl: url }));
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-blue-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 bg-blue-950 text-white flex justify-between items-center">
          <h2 className="text-2xl font-black">Створення Події</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-full">
              <label className="block text-xs font-black uppercase text-gray-400 mb-2">Назва Події</label>
              <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="Напр. Кубок Осені" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-gray-400 mb-2">Ім'я Організатора</label>
              <input required value={formData.organizer} onChange={e => setFormData({...formData, organizer: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" placeholder="Ім'я та Прізвище" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-gray-400 mb-2">Контакт</label>
              <input required value={formData.organizerContact} onChange={e => setFormData({...formData, organizerContact: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" placeholder="+380..." />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-gray-400 mb-2">Дата</label>
              <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase text-gray-400 mb-2">Локація</label>
              <input required value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none" placeholder="Місто, Адреса" />
            </div>
            <div className="col-span-full">
              <label className="block text-xs font-black uppercase text-gray-400 mb-2">Фото події (URL або ШІ)</label>
              <div className="flex gap-2">
                <input value={formData.photoUrl} onChange={e => setFormData({...formData, photoUrl: e.target.value})} className="flex-1 bg-gray-50 p-4 rounded-2xl font-bold outline-none" placeholder="https://..." />
                <button type="button" onClick={handleGenerateAIPhoto} disabled={isGenerating} className="bg-blue-600 text-white px-6 rounded-2xl font-black text-xs uppercase tracking-widest disabled:opacity-50 hover:bg-blue-700 transition-colors">
                   {isGenerating ? '⏳...' : '🤖 СЕВА ШІ'}
                </button>
              </div>
              {formData.photoUrl && <img src={formData.photoUrl} className="mt-3 w-full h-40 object-cover rounded-2xl border border-gray-100 shadow-sm" alt="Preview" />}
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black text-xl shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all">Опублікувати Подію</button>
        </form>
      </div>
    </div>
  );
};

const Calendar = () => {
  const { events, addEvent } = React.useContext(EventsContext);
  const [currentDate, setCurrentDate] = useState(new Date(2024, 5, 1));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const months = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const days = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const totalDays = daysInMonth(year, month);
    let startDay = firstDayOfMonth(year, month);
    startDay = startDay === 0 ? 6 : startDay - 1;
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));
    return days;
  }, [currentDate]);

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(t => t.date === dateStr);
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-black text-blue-950">Календар</h1>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-8 py-4 rounded-[1.5rem] font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2">➕ Створити Подію</button>
      </div>

      <CreateEventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={addEvent} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black text-blue-900">{months[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
            <div className="flex gap-3">
              <button onClick={() => changeMonth(-1)} className="p-3 bg-gray-50 rounded-2xl hover:bg-blue-50 transition-colors">◀</button>
              <button onClick={() => changeMonth(1)} className="p-3 bg-gray-50 rounded-2xl hover:bg-blue-50 transition-colors">▶</button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-4">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map(d => (
              <div key={d} className="text-center text-xs font-black text-gray-400 uppercase tracking-widest py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="aspect-square opacity-0" />;
              const evOnDay = getEventsForDate(day);
              const isSelected = selectedDate && day.toDateString() === selectedDate.toDateString();
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`relative aspect-square rounded-2xl flex flex-col items-center justify-center transition-all border-2 ${isSelected ? 'bg-blue-600 text-white border-blue-600 scale-105' : 'bg-white border-transparent hover:bg-blue-50'}`}
                >
                  <span className="font-black">{day.getDate()}</span>
                  {evOnDay.length > 0 && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 h-full min-h-[400px] overflow-y-auto">
            <h3 className="text-xl font-black mb-6 text-blue-950">
              {selectedDate ? `Події на ${selectedDate.getDate()} ${months[selectedDate.getMonth()]}` : "Виберіть дату"}
            </h3>
            <div className="space-y-6">
              {selectedDateEvents.map(e => (
                <div key={e.id} className="bg-blue-50 rounded-[2rem] border border-blue-100 overflow-hidden animate-in fade-in slide-in-from-right-4 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:z-10 cursor-default">
                  {e.photoUrl && <img src={e.photoUrl} className="w-full h-44 object-cover" alt={e.title} />}
                  <div className="p-6">
                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className="bg-blue-900 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{e.category}</span>
                      <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{e.type}</span>
                    </div>
                    <h4 className="font-black text-blue-900 text-lg mb-2 leading-tight">{e.title}</h4>
                    <div className="space-y-1 mb-4">
                      <p className="text-xs text-gray-500 flex items-center gap-1">👤 Організатор: <span className="font-black text-blue-900">{e.organizer}</span></p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">📍 Локація: <span className="font-bold">{e.location}</span></p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">📞 Тел: <span className="font-bold">{e.organizerContact}</span></p>
                    </div>
                    <button className="w-full bg-white border border-blue-200 text-blue-600 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-100 transition-colors">Деталі Події</button>
                  </div>
                </div>
              ))}
              {selectedDateEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center opacity-30">
                  <span className="text-5xl mb-4">🏐</span>
                  <p className="font-black uppercase text-xs tracking-widest">Подій немає</p>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

// ... Rest of the components (Chat, MediaLab, TeamMarket, MyProfile, Navigation) ...
// (I will keep them for a complete file replacement to ensure continuity)

const Chat = () => {
  const [messages, setMessages] = useState<(ChatMessage & { translated?: string, isTranslating?: boolean })[]>(MOCK_MESSAGES);
  const [newMessage, setNewMessage] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('Ukrainian');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    setMessages([...messages, { id: Date.now().toString(), sender: 'Ви', text: newMessage, timestamp: new Date() }]);
    setNewMessage('');
  };

  const handleTranslate = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg || msg.translated) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isTranslating: true } : m));
    try {
      const translated = await geminiService.translateMessage(msg.text, selectedLanguage);
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, translated, isTranslating: false } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isTranslating: false } : m));
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-black text-blue-950">Чат</h1>
        <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} className="bg-white px-4 py-2 rounded-2xl font-bold shadow-sm outline-none">
           <option value="Ukrainian">Українська</option>
           <option value="English">English</option>
        </select>
      </div>
      <div className="flex-1 bg-white rounded-[2.5rem] shadow-xl border border-gray-100 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 p-8 overflow-y-auto space-y-6">
          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender === 'Ви' ? 'items-end' : 'items-start'}`}>
              <span className="text-[10px] font-black uppercase text-gray-400 mb-1">{m.sender}</span>
              <div className={`max-w-[80%] p-4 rounded-3xl ${m.sender === 'Ви' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-100 text-blue-950 rounded-tl-none'}`}>
                <p className="font-medium">{m.text}</p>
                {m.translated && <p className="mt-2 text-xs italic opacity-80 pt-2 border-t border-black/10">{m.translated}</p>}
                {m.sender !== 'Ви' && !m.translated && <button onClick={() => handleTranslate(m.id)} className="text-[10px] font-bold text-blue-400 mt-2 hover:underline transition-all">Перекласти</button>}
              </div>
            </div>
          ))}
        </div>
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-4">
          <input type="text" className="flex-1 bg-white border border-gray-200 rounded-2xl px-6 py-3 shadow-sm outline-none" placeholder="Повідомлення..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
          <button onClick={handleSend} className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg shadow-blue-200 active:scale-95 transition-all">➤</button>
        </div>
      </div>
    </div>
  );
};

const MediaLab = () => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: 'img' | 'vid', url: string } | null>(null);

  const generateImage = async () => {
    setLoading(true);
    try {
      const url = await geminiService.generatePromoImage(prompt, "1K");
      setResult({ type: 'img', url });
    } finally { setLoading(false); }
  };

  const generateVideo = async () => {
    setLoading(true);
    try {
      const url = await geminiService.generatePromoVideo(prompt, "16:9");
      setResult({ type: 'vid', url });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-4xl font-black text-blue-950 mb-4">Медіа Лаб</h1>
      <p className="text-gray-500 mb-10 font-medium">Створюйте промо-контент одним кліком.</p>
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-gray-100 mb-8 overflow-hidden">
        <textarea className="w-full p-6 bg-gray-50 border-none rounded-3xl outline-none text-lg min-h-[150px] shadow-inner" placeholder="Опишіть ваше промо..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div className="flex gap-4 mt-6">
          <button onClick={generateImage} disabled={loading || !prompt} className="flex-1 bg-blue-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-blue-200 active:scale-95 transition-all uppercase tracking-widest">🖼️ Фото</button>
          <button onClick={generateVideo} disabled={loading || !prompt} className="flex-1 bg-blue-950 text-white py-5 rounded-2xl font-black shadow-xl active:scale-95 transition-all uppercase tracking-widest">🎬 Відео</button>
        </div>
      </div>
      {result && (
        <div className="bg-white p-6 rounded-[3rem] shadow-2xl animate-in zoom-in-95">
          {result.type === 'img' ? <img src={result.url} className="w-full rounded-[2rem] shadow-lg" alt="Promo" /> : <video src={result.url} controls className="w-full rounded-[2rem] shadow-lg" />}
        </div>
      )}
    </div>
  );
};

const TeamMarket = () => {
  const [selectedLevel, setSelectedLevel] = useState<PlayerLevel | 'all'>('all');
  const filteredPlayers = useMemo(() => {
    if (selectedLevel === 'all') return MOCK_PLAYERS;
    return MOCK_PLAYERS.filter(p => p.level === selectedLevel);
  }, [selectedLevel]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-end gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-black text-blue-950">Ринок Гравців</h1>
          <p className="text-gray-500 font-medium mt-2">Знайдіть кращих ветеранів для своєї команди.</p>
        </div>
        <div className="flex gap-2 bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100 overflow-x-auto no-scrollbar">
          <button onClick={() => setSelectedLevel('all')} className={`px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${selectedLevel === 'all' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-blue-600'}`}>Всі</button>
          {Object.values(PlayerLevel).map(level => (
            <button key={level} onClick={() => setSelectedLevel(level)} className={`px-5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${selectedLevel === level ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-blue-600'}`}>{level}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredPlayers.map(p => <PlayerCard key={p.id} player={p} />)}
      </div>
    </div>
  );
};

const MyProfile = () => {
  const [me, setMe] = useState<Player>(MOCK_PLAYERS[0]);
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-4xl font-black text-blue-950 mb-8">Мій Профіль</h1>
      <div className="bg-white rounded-[3rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-blue-900 h-32 relative" />
        <div className="px-8 pb-8">
           <div className="flex gap-6 -mt-16 items-end mb-8">
              <img src={me.photoUrl} className="w-32 h-32 rounded-[2.5rem] border-8 border-white shadow-xl object-cover" alt="Profile" />
              <div className="flex-1">
                <h2 className="text-3xl font-black text-blue-950 leading-tight">{me.name}</h2>
                <div className="flex items-center gap-3">
                  <RatingStars rating={me.overallRating} size="md" />
                  <span className="text-gray-400 font-bold text-sm">• {me.level}</span>
                </div>
              </div>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                 <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Біографія</h3>
                    <p className="text-gray-700 bg-gray-50 p-6 rounded-3xl font-medium leading-relaxed">{me.bio}</p>
                 </div>
              </div>
              <div className="space-y-4">
                 <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Статистика</h3>
                 <StatBadge label="Ігор" value={me.stats.gamesPlayed} />
                 <StatBadge label="Перемоги" value={me.stats.wins} color="green" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

const Navigation = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-100 py-3 px-6 flex justify-around items-center z-40 md:relative md:border-none md:flex-col md:w-80 md:h-screen md:bg-white md:text-blue-950 md:py-10 md:px-8 shadow-2xl md:shadow-none">
      <div className="hidden md:flex flex-col items-center mb-16">
        <div className="w-20 h-20 bg-blue-900 rounded-[2.5rem] shadow-xl flex items-center justify-center mb-4 transition-transform hover:rotate-6">
          <span className="text-white text-3xl font-black italic">УВ</span>
        </div>
        <h1 className="text-2xl font-black leading-tight text-center">Асоціація<br/><span className="text-blue-600">Ветеранів</span></h1>
      </div>
      <div className="flex md:flex-col justify-around w-full gap-2">
        {[
          { to: '/', icon: '🏠', label: 'Головна' },
          { to: '/events', icon: '📅', label: 'Події' },
          { to: '/market', icon: '🫂', label: 'Гравці' },
          { to: '/chat', icon: '💬', label: 'Чат' },
          { to: '/media', icon: '🪄', label: 'Медіа' },
          { to: '/profile', icon: '👤', label: 'Профіль' },
        ].map((link) => (
          <Link key={link.to} to={link.to} className="flex flex-col md:flex-row md:gap-4 md:w-full md:px-6 items-center hover:bg-blue-50 p-3 rounded-2xl transition-all group shrink-0">
            <span className="text-2xl md:text-xl group-hover:scale-125 transition-transform">{link.icon}</span>
            <span className="text-[10px] md:text-base md:font-black md:uppercase md:tracking-widest md:text-[11px] opacity-70 group-hover:opacity-100 whitespace-nowrap">{link.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

function App() {
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [events, setEvents] = useState<Tournament[]>(INITIAL_TOURNAMENTS);

  const addEvent = (e: Tournament) => setEvents(prev => [...prev, e]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && await window.aistudio.hasSelectedApiKey()) setApiKeySelected(true);
    };
    checkKey();
  }, []);

  const handleCommand = async (cmd: string) => {
    const lowerCmd = cmd.toLowerCase();
    if (lowerCmd.includes('головна')) window.location.hash = '/';
    if (lowerCmd.includes('ринок')) window.location.hash = '/market';
    if (lowerCmd.includes('медіа')) window.location.hash = '/media';
    if (lowerCmd.includes('профіль')) window.location.hash = '/profile';
    if (lowerCmd.includes('чат')) window.location.hash = '/chat';
    if (lowerCmd.includes('події')) window.location.hash = '/events';
  };

  const handleOpenKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setApiKeySelected(true);
    }
  };

  return (
    <EventsContext.Provider value={{ events, addEvent }}>
      <HashRouter>
        <div className="flex flex-col md:flex-row min-h-screen bg-gray-50 text-blue-950">
          <Navigation />
          <main className="flex-1 pb-24 md:pb-0 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-transparent to-transparent">
            {!apiKeySelected ? (
               <div className="flex flex-col items-center justify-center h-full p-10 text-center">
                  <h2 className="text-4xl font-black mb-4">Авторизація</h2>
                  <p className="text-gray-500 mb-8 max-w-sm">Будь ласка, активуйте API ключ для роботи ШІ функцій та СЕВА помічника.</p>
                  <button onClick={handleOpenKey} className="bg-blue-600 text-white px-12 py-5 rounded-[2rem] font-black text-xl shadow-2xl active:scale-95 transition-all">Активувати</button>
                  <p className="mt-4 text-xs text-gray-400 underline cursor-pointer hover:text-blue-500" onClick={() => window.open('https://ai.google.dev/gemini-api/docs/billing')}>Детальніше про білінг</p>
               </div>
            ) : (
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/events" element={<Calendar />} />
                <Route path="/market" element={<TeamMarket />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/media" element={<MediaLab />} />
                <Route path="/profile" element={<MyProfile />} />
              </Routes>
            )}
          </main>
          <SevaAssistant onCommand={handleCommand} />
        </div>
      </HashRouter>
    </EventsContext.Provider>
  );
}

export default App;
