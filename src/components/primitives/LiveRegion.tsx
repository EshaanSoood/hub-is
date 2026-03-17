export const LiveRegion = ({ message }: { message: string }) => (
  <div aria-live="polite" aria-atomic="true" className="sr-only">
    {message}
  </div>
);
