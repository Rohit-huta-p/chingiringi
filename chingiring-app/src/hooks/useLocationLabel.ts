import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

/**
 * Shared "City, Region" label from the device GPS fix (Mapbox reverse-geocode).
 * Mirrors the logic in OfflineStoresScreen so the Products header shows the same
 * "Shopping near …" location. Requests foreground location once; falls back to
 * `fallback` on denial/error and to "Near you" when no Mapbox token is set.
 */
export function useLocationLabel(fallback = 'Near you'): string {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [label, setLabel] = useState(fallback);

  // Ask for GPS once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        /* permission denied or unavailable — keep fallback */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Reverse-geocode the fix into a "City, Region" label.
  useEffect(() => {
    if (!coords) return;
    const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    if (!token) { setLabel('Near you'); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${coords.lng},${coords.lat}.json?types=place,region&limit=1&access_token=${token}`,
        );
        const json = await res.json();
        const name: string | undefined = json?.features?.[0]?.place_name;
        if (cancelled) return;
        setLabel(name ? name.split(',').slice(0, 2).map((p: string) => p.trim()).join(', ') : 'Near you');
      } catch {
        if (!cancelled) setLabel('Near you');
      }
    })();
    return () => { cancelled = true; };
  }, [coords]);

  return label;
}
