import React from 'react';
import { 
  Sun, Dumbbell, BookOpen, Brain, Droplet, 
  PenTool, Ban, Compass, GraduationCap, Moon, 
  Target, Coffee, Flame, Apple, Smile, Footprints, 
  Activity, Heart, Music, Timer, Shield,
  Landmark, Building2, Wallet2, CreditCard, Coins, 
  PiggyBank, TrendingUp, Briefcase, Globe,
  Bed, Egg, Utensils, Soup, DollarSign, Cigarette, 
  Beer, Car, GlassWater, Cookie
} from 'lucide-react';

export const HABIT_ICONS: { [key: string]: React.ComponentType<any> } = {
  'sun': Sun,
  'dumbbell': Dumbbell,
  'book-open': BookOpen,
  'brain': Brain,
  'droplet': Droplet,
  'pen-tool': PenTool,
  'ban': Ban,
  'compass': Compass,
  'graduation-cap': GraduationCap,
  'moon': Moon,
  'target': Target,
  'coffee': Coffee,
  'flame': Flame,
  'apple': Apple,
  'smile': Smile,
  'footprints': Footprints,
  'activity': Activity,
  'heart': Heart,
  'music': Music,
  'timer': Timer,
  'shield': Shield,
  'sleep': Bed,
  'breakfast': Egg,
  'lunch': Utensils,
  'dinner': Soup,
  'budget': DollarSign,
  'cigarette': Cigarette,
  'alcohol': Beer,
  'taxi': Car,
  'water-glass': GlassWater,
  'sugar': Cookie
};

export const ACCOUNT_ICONS: { [key: string]: React.ComponentType<any> } = {
  'bank': Landmark,
  'building': Building2,
  'wallet': Wallet2,
  'card': CreditCard,
  'coins': Coins,
  'piggy': PiggyBank,
  'trending': TrendingUp,
  'briefcase': Briefcase,
  'globe': Globe,
  'heart': Heart
};

export function HabitIconHelper({ iconName, className = "w-4 h-4" }: { iconName?: string; className?: string }) {
  const IconComponent = HABIT_ICONS[iconName || 'target'] || Target;
  return <IconComponent className={className} />;
}

export function AccountIconHelper({ iconName, className = "w-5 h-5" }: { iconName?: string; className?: string }) {
  const IconComponent = ACCOUNT_ICONS[iconName || 'bank'] || Landmark;
  return <IconComponent className={className} />;
}
