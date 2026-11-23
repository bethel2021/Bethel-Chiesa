export type SiteThemeId = 'classic' | 'christmas' | 'easter' | 'thanksgiving';

export interface SiteThemeOption {
  id: SiteThemeId;
  name: string;
  subtitle: string;
  swatches: [string, string, string];
}

export const SITE_THEMES: SiteThemeOption[] = [
  {
    id: 'classic',
    name: '常年经典',
    subtitle: '暖米宣纸 · 圣殿深蓝',
    swatches: ['#FAF8F4', '#1E3A5F', '#8B5E34'],
  },
  {
    id: 'christmas',
    name: '圣诞佳音',
    subtitle: '冬青松绿 · 圣诞绯红 · 暖金',
    swatches: ['#EEF2EC', '#1B4332', '#9B2226'],
  },
  {
    id: 'easter',
    name: '受难复活',
    subtitle: '晨曦微紫 · 庄严圣紫 · 金辉',
    swatches: ['#F1EDF5', '#4C2A6A', '#A16207'],
  },
  {
    id: 'thanksgiving',
    name: '感恩丰收',
    subtitle: '暖麦米底 · 胡桃琥珀 · 麦金',
    swatches: ['#F4EDE0', '#7C3D18', '#9A5B13'],
  },
];

export function normalizeSiteTheme(val: unknown): SiteThemeId {
  switch (val) {
    case 'classic':
    case 'christmas':
    case 'easter':
    case 'thanksgiving':
      return val;
    default:
      return 'classic';
  }
}
