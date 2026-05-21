import { useState } from 'react';
import StationPage, { EventSelector } from './StationPage';

export default function BarPage() {
  const [eventId, setEventId] = useState<string | null>(null);

  if (!eventId) return <EventSelector onSelect={setEventId} />;
  return <StationPage destination="bar" title="Bar" eventId={eventId} />;
}
