import Image from 'next/image';

/**
 * Lighthouse brand mark, shared by the dashboard and account views.
 * Uses the same warm lighthouse artwork as the desktop Intelligence Network.
 * This small navigation mark stays static; the rotating beam belongs in the hub.
 */
export default function LighthouseBrandMark({ size }: { size: number }) {
  return (
    <span className="lighthouse-brand-emblem" style={{ width: size, height: size }} aria-hidden="true">
      <Image
        src="/lighthouse-grok-lantern.jpg"
        alt=""
        fill
        sizes={`${size}px`}
        className="lighthouse-brand-emblem-image"
      />
    </span>
  );
}
