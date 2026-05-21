import { useState } from 'react';
import StationPage, { EventSelector } from './StationPage';

export default function WarehousePage() {
  const [eventId, setEventId] = useState<string | null>(null);

  if (!eventId) return <EventSelector onSelect={setEventId} />;
  return <StationPage destination="warehouse" title="Bodega" eventId={eventId} />;
}
