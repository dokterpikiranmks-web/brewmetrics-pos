import {
  Coffee, Milk, Filter, CupSoda, Leaf, Croissant, CakeSlice, Sparkles,
  GlassWater, CupSoda as Cup, Beer, Citrus, type LucideIcon,
} from "lucide-react";

export const PRODUCT_ICONS: Record<string, LucideIcon> = {
  Coffee,
  Milk,
  Filter,
  CupSoda,
  Leaf,
  Croissant,
  CakeSlice,
  Sparkles,
  GlassWater,
  Cup,
  Beer,
  Citrus,
};

export function productIcon(name: string): LucideIcon {
  return PRODUCT_ICONS[name] ?? Coffee;
}

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Coffee,
  Filter,
  CupSoda,
  Croissant,
};

export function categoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name] ?? Coffee;
}
