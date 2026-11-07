import {
  Baby,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Utensils,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * The web's half of the category-symbol dictionary: each stored key and the
 * lucide icon that draws it. The keys are the shared list in
 * docs/features/finance.md § Category symbols — the phone maps the same keys
 * to Material Symbols — so **a key added here is added there too**, in the
 * same change.
 *
 * In code, not in the database: only the icons imported here reach the bundle,
 * so a name from the API could not become an icon without this map anyway.
 * The API checks only a key's shape; a key this map doesn't know (added on the
 * phone first, say) draws the category's initial instead.
 *
 * Ordered as the picker shows them, roughly by what people spend on most:
 * food, home, getting around, health and learning, leisure, things, the rest.
 */
export interface CategorySymbol {
  key: string;
  /** The symbol's name — the picker's accessible label and tooltip. */
  label: string;
  Icon: LucideIcon;
}

export const CATEGORY_SYMBOLS: readonly CategorySymbol[] = [
  { key: 'food', label: 'Food', Icon: Utensils },
  { key: 'groceries', label: 'Groceries', Icon: ShoppingCart },
  { key: 'coffee', label: 'Coffee', Icon: Coffee },
  { key: 'home', label: 'Home', Icon: House },
  { key: 'bills', label: 'Bills', Icon: Receipt },
  { key: 'utilities', label: 'Utilities', Icon: Zap },
  { key: 'phone', label: 'Phone', Icon: Smartphone },
  { key: 'internet', label: 'Internet', Icon: Wifi },
  { key: 'transport', label: 'Transport', Icon: Bus },
  { key: 'car', label: 'Car', Icon: Car },
  { key: 'fuel', label: 'Fuel', Icon: Fuel },
  { key: 'travel', label: 'Travel', Icon: Plane },
  { key: 'health', label: 'Health', Icon: HeartPulse },
  { key: 'fitness', label: 'Fitness', Icon: Dumbbell },
  { key: 'education', label: 'Education', Icon: GraduationCap },
  { key: 'books', label: 'Books', Icon: BookOpen },
  { key: 'entertainment', label: 'Entertainment', Icon: Clapperboard },
  { key: 'games', label: 'Games', Icon: Gamepad2 },
  { key: 'music', label: 'Music', Icon: Music },
  { key: 'subscriptions', label: 'Subscriptions', Icon: Repeat },
  { key: 'shopping', label: 'Shopping', Icon: ShoppingBag },
  { key: 'clothes', label: 'Clothes', Icon: Shirt },
  { key: 'gifts', label: 'Gifts', Icon: Gift },
  { key: 'pets', label: 'Pets', Icon: PawPrint },
  { key: 'kids', label: 'Kids', Icon: Baby },
  { key: 'beauty', label: 'Beauty', Icon: Sparkles },
  { key: 'insurance', label: 'Insurance', Icon: Shield },
  { key: 'savings', label: 'Savings', Icon: PiggyBank },
  { key: 'work', label: 'Work', Icon: Briefcase },
  { key: 'other', label: 'Other', Icon: Tag },
];

const BY_KEY = new Map(CATEGORY_SYMBOLS.map((symbol) => [symbol.key, symbol]));

/** The symbol for a stored key, or null for none — and for a key this app doesn't know yet. */
export function symbolFor(key: string | null | undefined): CategorySymbol | null {
  return (key && BY_KEY.get(key)) || null;
}
