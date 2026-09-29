import type { ReactNode, SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

function Svg({ size = 24, children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const Drop = (p: IconProps) => (
  <Svg {...p}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" /></Svg>
);

export const Heart = (p: IconProps) => (
  <Svg {...p}><path d="M12 20s-7-4.3-9.3-8.5A4.7 4.7 0 0 1 12 7a4.7 4.7 0 0 1 9.3 4.5C19 15.7 12 20 12 20Z" /></Svg>
);

export const Syringe = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 5l-2-2" />
    <path d="M15 9l-2-2" />
    <path d="M13.5 4.5l6 6" />
    <path d="M11 7L4 14l-1 6 6-1 7-7" />
    <path d="M8 13l3 3" />
  </Svg>
);

export const Clipboard = (p: IconProps) => (
  <Svg {...p}>
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4h6v3H9z" />
    <path d="M9 12h6" />
    <path d="M9 16h4" />
  </Svg>
);

export const Hospital = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 21V8l8-5 8 5v13" />
    <path d="M4 21h16" />
    <path d="M12 8v6" />
    <path d="M9 11h6" />
  </Svg>
);

export const Trophy = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />
    <path d="M8 5H5v2a3 3 0 0 0 3 3" />
    <path d="M16 5h3v2a3 3 0 0 1-3 3" />
    <path d="M12 12v4" />
    <path d="M9 20h6" />
    <path d="M10 16h4v4h-4z" />
  </Svg>
);

export const Gift = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="9" width="16" height="11" rx="2" />
    <path d="M4 13h16" />
    <path d="M12 9v11" />
    <path d="M12 9C12 6 9 4 7.5 5.5S9 9 12 9Z" />
    <path d="M12 9c0-3 3-5 4.5-3.5S15 9 12 9Z" />
  </Svg>
);

export const User = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </Svg>
);

export const Gem = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
    <path d="M3 9h18" />
    <path d="M9 4 7 9l5 11" />
    <path d="M15 4l2 5-5 11" />
  </Svg>
);

export const Refresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </Svg>
);

export const Alert = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4" />
    <path d="M12 17h.01" />
  </Svg>
);

export const CheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l3 3 5-6" />
  </Svg>
);

export const Package = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7l9-4 9 4-9 4-9-4Z" />
    <path d="M3 7v10l9 4 9-4V7" />
    <path d="M12 11v10" />
  </Svg>
);

export const ClipboardList = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4h6v3H9z" />
    <path d="M8 12h8" />
    <path d="M8 16h8" />
    <path d="M8 20h8" />
  </Svg>
);

export const Search = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4-4" />
  </Svg>
);

export const Inbox = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 13l3-8h10l3 8" />
    <path d="M4 13v6h16v-6" />
    <path d="M4 13h5l1 3h4l1-3h5" />
  </Svg>
);

export const Microscope = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 21h12" />
    <path d="M9 21a5 5 0 0 0 6-6" />
    <path d="M15 4a3 3 0 0 1 0 6" />
    <path d="M12 7l3 3" />
    <path d="M9 11V8" />
  </Svg>
);

export const Home = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v10h12V10" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);

export const ShoppingBag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 8h12l1 12H5L6 8Z" />
    <path d="M9 8a3 3 0 0 1 6 0" />
  </Svg>
);

export const X = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </Svg>
);

export const Upload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 16V4" />
    <path d="M7 9l5-5 5 5" />
    <path d="M4 20h16" />
  </Svg>
);

export const Tag = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 12l9-9 9 9-9 9-9-9Z" />
    <circle cx="15" cy="9" r="1.4" />
  </Svg>
);

export const Sparkles = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l1.6 4.9L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.1Z" />
    <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8Z" />
  </Svg>
);

export const Star = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.8 6.6 20l1-6.1L3.2 9.5l6.1-.9Z" />
  </Svg>
);

export const Medal = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="9" r="5" />
    <path d="M9 13l-2 8 5-3 5 3-2-8" />
  </Svg>
);

export const Shield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
  </Svg>
);

export const Wallet = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
    <path d="M3 8v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z" />
    <circle cx="16" cy="13.5" r="1.3" />
  </Svg>
);

// 商品图标按索引循环
const PRODUCT_ICONS = [Gift, Tag, Sparkles, Star, Heart, Medal, Package, Shield];
export const getProductIcon = (index: number) => {
  const C = PRODUCT_ICONS[index % PRODUCT_ICONS.length];
  return <C size={26} />;
};
