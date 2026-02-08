
export enum PlayerLevel {
  BEGINNER = 'Новачок',
  AMATEUR = 'Любитель',
  SEMI_PRO = 'Напівпрофесіонал',
  PROFESSIONAL = 'Професіонал',
  LEGEND = 'Легенда'
}

export enum PlayerRole {
  SETTER = 'Зв\'язуючий',
  OPPOSITE = 'Діагональний',
  OUTSIDE_HITTER = 'Доигрувальник',
  MIDDLE_BLOCKER = 'Центральний блокуючий',
  LIBERO = 'Ліберо',
  UNIVERSAL = 'Універсал'
}

export enum GameType {
  CLASSIC = 'Класика',
  BEACH = 'Пляжний',
  MIX = 'Мікс',
  PARK = 'Парковий'
}

export enum EventCategory {
  TOURNAMENT = 'Турнір',
  CHAMPIONSHIP = 'Чемпіонат',
  GAME = 'Гра'
}

export enum EventGender {
  MEN = 'Чоловіки',
  WOMEN = 'Жінки',
  MIXED = 'Мікс'
}

export interface PlayerStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  aces?: number;
  blocks?: number;
  bestAchievement?: string;
}

export interface PlayerReview {
  id: string;
  author: string;
  rating: number; // 1 to 5
  comment: string;
  date: string;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  level: PlayerLevel;
  role: PlayerRole;
  contacts: string;
  bio: string;
  stats: PlayerStats;
  reviews: PlayerReview[];
  overallRating: number; // Calculated field
  photoUrl?: string;
  verified?: boolean;
}

export interface Team {
  id: string;
  name: string;
  type: GameType;
  vacancies: PlayerRole[];
  members: Player[];
  captainId: string;
}

export interface Tournament {
  id: string;
  title: string;
  date: string;
  location: string;
  type: GameType;
  category: EventCategory;
  gender: EventGender;
  ageCategory: string;
  requirements: string;
  organizer: string;
  organizerContact: string;
  photoUrl?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
}
