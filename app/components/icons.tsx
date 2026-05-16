// Lucide-style icons + the Lighthouse logo, as exported React components.

import * as React from 'react';

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({ children, size = 18, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {children}
  </svg>
);

export const IconShield = (p: IconProps) => (<Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Icon>);
export const IconTrendUp = (p: IconProps) => (<Icon {...p}><path d="M3 3v18h18"/><path d="m7 14 4-4 4 4 5-5"/></Icon>);
export const IconTrendDown = (p: IconProps) => (<Icon {...p}><path d="M3 3v18h18"/><path d="m7 10 4 4 4-4 5 5"/></Icon>);
export const IconMail = (p: IconProps) => (<Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></Icon>);
export const IconAlert = (p: IconProps) => (<Icon {...p}><path d="m12 2 10 18H2L12 2z"/><path d="M12 9v5"/><circle cx="12" cy="17" r="1" fill="currentColor"/></Icon>);
export const IconZap = (p: IconProps) => (<Icon {...p}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></Icon>);
export const IconBriefing = (p: IconProps) => (<Icon {...p}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 14h6"/></Icon>);
export const IconCheckCircle = (p: IconProps) => (<Icon {...p}><path d="M9 11.5 11 13.5 15 9.5"/><circle cx="12" cy="12" r="9"/></Icon>);
export const IconRobot = (p: IconProps) => (<Icon {...p}><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><path d="M8 16h.01M16 16h.01"/></Icon>);
export const IconArrowRight = (p: IconProps) => (<Icon {...p}><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></Icon>);

export const IconLogo: React.FC<{ size?: number }> = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="lhLogoBeacon" cx="50%" cy="40%" r="55%">
        <stop offset="0%" stopColor="#88C9FF"/>
        <stop offset="55%" stopColor="#2F86E8"/>
        <stop offset="100%" stopColor="#081F3D"/>
      </radialGradient>
      <linearGradient id="lhLogoBeam" x1="28" y1="20" x2="52" y2="2" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#88C9FF" stopOpacity="0.9"/>
        <stop offset="100%" stopColor="#88C9FF" stopOpacity="0"/>
      </linearGradient>
      <linearGradient id="lhLogoBeam2" x1="28" y1="20" x2="4" y2="2" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#88C9FF" stopOpacity="0.9"/>
        <stop offset="100%" stopColor="#88C9FF" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <circle cx="28" cy="28" r="27" fill="url(#lhLogoBeacon)"/>
    <circle cx="28" cy="28" r="27" stroke="#5BA8FF" strokeOpacity="0.4"/>
    <path d="M28 19 L52 3 L47 22 Z" fill="url(#lhLogoBeam)"/>
    <path d="M28 19 L4 3 L9 22 Z" fill="url(#lhLogoBeam2)"/>
    <rect x="24.5" y="21" width="7" height="20" fill="#F4F6FB"/>
    <rect x="23" y="19" width="10" height="2.6" fill="#F4F6FB" rx="0.5"/>
    <rect x="26" y="16.5" width="4" height="2.5" fill="#FFFAE6"/>
    <path d="M21 41 L35 41 L37 45 L19 45 Z" fill="#F4F6FB"/>
  </svg>
);
