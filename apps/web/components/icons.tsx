// Platform icon set. The UI icons come from Lucide (lucide-react) — a modern,
// consistent 24x24 stroke set — re-exported here under the app's own `Icon*`
// names so call sites never import lucide-react directly and can be restyled
// in one place. Brand/app-store marks stay hand-drawn (multi-colour / filled).
import type { SVGProps } from 'react';
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  Star,
  ShieldCheck,
  Truck,
  Wallet,
  Check,
  ChevronLeft,
  Globe,
  Sun,
  Package,
  Heart,
  MessageCircle,
  Plus,
  LayoutGrid,
  MapPin,
  Eye,
  Undo2,
  Shirt,
  Monitor,
  Smartphone,
  House,
  Coffee,
  Sparkles,
  Share2,
  Car,
  KeyRound,
  Wrench,
  Briefcase,
  Leaf,
  Ticket,
  Bell,
  Gift,
  ShoppingBag,
  Mic,
  Camera,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

// Wrap a Lucide icon so it defaults to the app's size for its slot and is
// hidden from assistive tech (icons here are always decorative, paired with
// text). Callers can still override width/height/size or any prop. `extra`
// bakes in per-icon style (e.g. a filled variant).
type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };
function icon(C: LucideIcon, size = 20, extra?: Partial<LucideProps>) {
  const Wrapped = (p: IconProps) => (
    <C aria-hidden size={size} {...extra} {...(p as LucideProps)} />
  );
  Wrapped.displayName = `Icon(${C.displayName ?? 'lucide'})`;
  return Wrapped;
}

// Chrome / navigation
export const IconSearch = icon(Search);
export const IconCart = icon(ShoppingCart);
export const IconUser = icon(User);
export const IconMenu = icon(Menu);
export const IconChevronLeft = icon(ChevronLeft);
export const IconGlobe = icon(Globe);
export const IconSun = icon(Sun);
export const IconPlus = icon(Plus);
export const IconGrid = icon(LayoutGrid);
export const IconBell = icon(Bell);

// Trust / commerce (larger slots keep their original sizes)
export const IconStar = icon(Star, 20, { fill: 'currentColor' });
export const IconShield = icon(ShieldCheck, 24);
export const IconTruck = icon(Truck, 24);
export const IconWallet = icon(Wallet, 24);
export const IconCheck = icon(Check, 16);
export const IconBox = icon(Package, 40);
export const IconBag = icon(ShoppingBag);
export const IconGift = icon(Gift);

// Favourites / messaging / sharing
export const IconHeart = icon(Heart);
export const IconHeartFilled = icon(Heart, 20, { fill: 'currentColor' });
export const IconChat = icon(MessageCircle);
export const IconShare = icon(Share2);
export const IconMapPin = icon(MapPin);
export const IconEye = icon(Eye);
export const IconReturn = icon(Undo2);

// Category glyphs (home tiles + verticals)
export const IconShirt = icon(Shirt);
export const IconDevice = icon(Monitor);
export const IconPhone = icon(Smartphone);
export const IconHome = icon(House);
export const IconCup = icon(Coffee);
export const IconSparkle = icon(Sparkles);
export const IconMic = icon(Mic);
export const IconCamera = icon(Camera);
export const IconCar = icon(Car);
export const IconKey = icon(KeyRound);
export const IconTools = icon(Wrench);
export const IconBriefcase = icon(Briefcase);
export const IconLeaf = icon(Leaf);
export const IconTicket = icon(Ticket);

// ---------------------------------------------------------------------------
// Brand & app-store marks: kept hand-drawn (multi-colour / filled), NOT part of
// the Lucide outline set. Used only on their official "sign in with…" / badge
// buttons and must stay faithful to each brand's mark.
// ---------------------------------------------------------------------------
export const IconGoogle = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden="true" {...p}>
    <path
      fill="#4285F4"
      d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
    />
    <path
      fill="#34A853"
      d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
    />
    <path
      fill="#FBBC05"
      d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
    />
    <path
      fill="#EA4335"
      d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
    />
  </svg>
);
export const IconFacebook = (p: SVGProps<SVGSVGElement>) => (
  <svg width={18} height={18} viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path
      fill="#fff"
      d="M15.12 12.75h2.34l.37-2.98h-2.71V8.02c0-.86.24-1.45 1.45-1.45h1.55V3.9c-.27-.04-1.19-.12-2.27-.12-2.25 0-3.79 1.4-3.79 3.97v2.02H9.7v2.98h2.35V20h3.07z"
    />
  </svg>
);
export const IconApple = (p: SVGProps<SVGSVGElement>) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
  </svg>
);
export const IconGooglePlay = (p: SVGProps<SVGSVGElement>) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.181l11.04 10.975zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
  </svg>
);
export const IconWhatsApp = (p: SVGProps<SVGSVGElement>) => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
