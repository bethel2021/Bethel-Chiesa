export type MapsTravelMode = 'DRIVING' | 'TRANSIT' | 'WALKING';

export function buildGoogleMapsDirectionsUrl(params: {
  destination: string;
  destinationPlaceId?: string;
  origin?: string;
  travelMode?: MapsTravelMode;
}): string {
  const query = new URLSearchParams({
    api: '1',
    destination: params.destination,
  });
  if (params.destinationPlaceId) {
    query.set('destination_place_id', params.destinationPlaceId);
  }
  if (params.origin && params.origin.trim()) {
    query.set('origin', params.origin.trim());
  }
  if (params.travelMode) {
    query.set('travelmode', params.travelMode.toLowerCase());
  }
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}
