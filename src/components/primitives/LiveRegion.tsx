interface LiveRegionProps {
  message: string;
  role?: 'status' | 'alert' | 'log';
  ariaLive?: 'off' | 'polite' | 'assertive';
}

export const LiveRegion = ({ message, role, ariaLive = 'polite' }: LiveRegionProps) => (
  <div role={role} aria-live={ariaLive} aria-atomic="true" className="sr-only">
    {message}
  </div>
);
