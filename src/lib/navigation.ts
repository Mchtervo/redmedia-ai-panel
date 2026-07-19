import {
  LayoutDashboard,
  Inbox,
  Users,
  Target,
  CalendarCheck,
  Sparkles,
  Megaphone,
  BarChart3,
  BookOpen,
  Plug,
  UsersRound,
  Settings,
  Package,
  Tags,
  MapPin,
  Wallet,
  Bell,
  BellRing,
  Workflow,
  MessageSquareReply,
  Brain,
  BriefcaseBusiness,
  CheckCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Komut paletinde aramayı kolaylaştıran ek anahtar kelimeler. */
  keywords?: string[];
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

/**
 * Sidebar ve komut paletinin tek kaynağı.
 * Gruplar iş akışına göre: genel bakış → satış → rezervasyon → pazarlama →
 * AI → operasyon → ayarlar.
 */
export const DASHBOARD_NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Genel Bakış",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        keywords: ["ana sayfa", "özet"],
      },
      {
        label: "CEO Intelligence",
        href: "/dashboard/ceo",
        icon: BriefcaseBusiness,
        keywords: ["rapor", "yönetim", "özet"],
      },
      {
        label: "Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
        keywords: ["analiz", "metrik"],
      },
    ],
  },
  {
    id: "sales",
    label: "Satış",
    items: [
      {
        label: "Inbox",
        href: "/dashboard/inbox",
        icon: Inbox,
        keywords: ["mesaj", "konuşma", "dm"],
      },
      {
        label: "Müşteriler",
        href: "/dashboard/customers",
        icon: Users,
        keywords: ["crm", "kişi", "customers"],
      },
      {
        label: "Lead'ler",
        href: "/dashboard/leads",
        icon: Target,
        keywords: ["potansiyel", "fırsat", "leads"],
      },
      {
        label: "Follow-up",
        href: "/dashboard/follow-ups",
        icon: MessageSquareReply,
        keywords: ["takip"],
      },
    ],
  },
  {
    id: "reservations",
    label: "Rezervasyon",
    items: [
      {
        label: "Rezervasyonlar",
        href: "/dashboard/reservations",
        icon: CalendarCheck,
        keywords: ["takvim", "çekim"],
      },
      {
        label: "Hizmetler",
        href: "/dashboard/services",
        icon: Package,
        keywords: ["paket", "fiyat"],
      },
      {
        label: "Kampanyalar",
        href: "/dashboard/campaigns",
        icon: Tags,
        keywords: ["indirim"],
      },
      {
        label: "Platolar",
        href: "/dashboard/plateaus",
        icon: MapPin,
        keywords: ["mekan", "lokasyon"],
      },
      {
        label: "Ödemeler",
        href: "/dashboard/payments",
        icon: Wallet,
        keywords: ["kapora", "dekont", "tahsilat"],
      },
    ],
  },
  {
    id: "marketing",
    label: "Pazarlama",
    items: [
      {
        label: "Marketing Director",
        href: "/dashboard/marketing",
        icon: Megaphone,
        keywords: ["reklam", "meta", "instagram", "kampanya", "roas"],
      },
    ],
  },
  {
    id: "ai",
    label: "Yapay Zekâ",
    items: [
      {
        label: "Asistan Laboratuvarı",
        href: "/dashboard/ai",
        icon: Sparkles,
        keywords: [
          "learning",
          "konuşma analizi",
          "asistan",
          "test sohbet",
          "laboratuvar",
        ],
      },
      {
        label: "AI Brain",
        href: "/dashboard/ai-brain",
        icon: Brain,
        keywords: ["hafıza", "playbook", "satış öğrenme"],
      },
      {
        label: "Knowledge",
        href: "/dashboard/knowledge",
        icon: BookOpen,
        keywords: ["bilgi", "doküman"],
      },
      {
        label: "Onay Kuyruğu",
        href: "/dashboard/approvals",
        icon: CheckCheck,
        keywords: ["onay", "approval", "insan onayı"],
      },
    ],
  },
  {
    id: "operations",
    label: "Operasyon",
    items: [
      {
        label: "Otomasyonlar",
        href: "/dashboard/automations",
        icon: Workflow,
        keywords: ["kural", "otomatik"],
      },
      {
        label: "Bildirimler",
        href: "/dashboard/notifications",
        icon: BellRing,
        keywords: ["uyarı"],
      },
      {
        label: "Hatırlatmalar",
        href: "/dashboard/reminders",
        icon: Bell,
        keywords: ["görev"],
      },
      {
        label: "Ekip",
        href: "/dashboard/team",
        icon: UsersRound,
        keywords: ["personel", "takım"],
      },
    ],
  },
  {
    id: "settings",
    label: "Ayarlar",
    items: [
      {
        label: "Entegrasyonlar",
        href: "/dashboard/integrations",
        icon: Plug,
        keywords: ["meta", "chatplace", "bağlantı"],
      },
      {
        label: "Ödeme Ayarları",
        href: "/dashboard/settings/payment",
        icon: Wallet,
        keywords: ["iban", "hesap"],
      },
      {
        label: "Ayarlar",
        href: "/dashboard/settings",
        icon: Settings,
        keywords: ["settings"],
      },
    ],
  },
];

/** Düz liste (komut paleti ve eski kullanımlar için). */
export const DASHBOARD_NAV_ITEMS: NavItem[] = DASHBOARD_NAV_GROUPS.flatMap(
  (group) => group.items
);

/** Bir href için grup etiketini döner (breadcrumb/komut paleti). */
export function findNavGroupLabel(href: string): string | null {
  for (const group of DASHBOARD_NAV_GROUPS) {
    if (group.items.some((item) => item.href === href)) {
      return group.label;
    }
  }
  return null;
}
