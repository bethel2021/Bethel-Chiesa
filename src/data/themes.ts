export type SiteThemeId = 'classic' | 'christmas' | 'easter' | 'thanksgiving';

export interface SiteThemePreviewTokens {
  bg: string;
  surface: string;
  card: string;
  border: string;
  ink: string;
  inkMuted: string;
  accent: string;
  gold: string;
  heroBg: string;
  topBar: string;
}

export interface SiteThemeOption {
  id: SiteThemeId;
  name: string;
  badge: string;
  subtitle: string;
  description: string;
  swatches: [string, string, string];
  preview: SiteThemePreviewTokens;
}

export const SITE_THEMES: SiteThemeOption[] = [
  {
    id: 'classic',
    name: '经典',
    badge: '常年默认',
    subtitle: '暖米宣纸 · 圣殿深蓝 · 古铜金',
    description: '庄重典雅的传统教堂色调，适合常年主日崇拜与日常教会牧养信息发布。',
    swatches: ['#FAF8F4', '#1E3A5F', '#8B5E34'],
    preview: {
      bg: '#FAF8F4',
      surface: '#F3EFE6',
      card: '#FFFFFF',
      border: '#E5DFD3',
      ink: '#1C1917',
      inkMuted: '#57534E',
      accent: '#1E3A5F',
      gold: '#8B5E34',
      heroBg: '#1C1917',
      topBar: 'transparent',
    },
  },
  {
    id: 'christmas',
    name: '圣诞节',
    badge: '节期喜乐',
    subtitle: '冬青松绿 · 圣诞绯红 · 暖金',
    description: '融入深松木绿与绯红金彩的圣诞佳音氛围，适合将临期、平安夜及圣诞节聚会。',
    swatches: ['#EEF2EC', '#1B4332', '#9B2226'],
    preview: {
      bg: '#FBF9F5',
      surface: '#EEF2EC',
      card: '#FFFFFF',
      border: '#DCE3D8',
      ink: '#17211B',
      inkMuted: '#4B5B51',
      accent: '#1B4332',
      gold: '#9B2226',
      heroBg: '#132219',
      topBar: 'linear-gradient(90deg, #1B4332 0%, #A67C2E 50%, #9B2226 100%)',
    },
  },
  {
    id: 'easter',
    name: '复活节',
    badge: '圣周晨曦',
    subtitle: '晨曦微紫 · 庄严圣紫 · 荣耀金',
    description: '礼仪紫搭配柔和金辉，呈现受难周默想与复活主日盼望更新的圣洁氛围。',
    swatches: ['#F1EDF5', '#4C2A6A', '#A16207'],
    preview: {
      bg: '#FAF9FB',
      surface: '#F1EDF5',
      card: '#FFFFFF',
      border: '#E3DCEB',
      ink: '#1E1926',
      inkMuted: '#584F63',
      accent: '#4C2A6A',
      gold: '#A16207',
      heroBg: '#1A1423',
      topBar: 'linear-gradient(90deg, #4C2A6A 0%, #A16207 50%, #4C2A6A 100%)',
    },
  },
  {
    id: 'thanksgiving',
    name: '感恩节',
    badge: '秋收颂赞',
    subtitle: '暖麦米底 · 胡桃琥珀 · 麦穗金',
    description: '温润麦田暖米与胡桃木棕调，传递数算主恩、欢喜丰收与爱筵团契的温暖气息。',
    swatches: ['#F4EDE0', '#7C3D18', '#9A5B13'],
    preview: {
      bg: '#FBF8F2',
      surface: '#F4EDE0',
      card: '#FFFFFF',
      border: '#E6DCCB',
      ink: '#241911',
      inkMuted: '#614E3F',
      accent: '#7C3D18',
      gold: '#9A5B13',
      heroBg: '#1F1610',
      topBar: 'linear-gradient(90deg, #7C3D18 0%, #B7791F 50%, #7C3D18 100%)',
    },
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
