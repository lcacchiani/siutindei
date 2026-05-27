declare namespace google.maps {
  class LatLng {
    constructor(lat: number, lng: number);
  }

  class LatLngBounds {
    extend(point: LatLng): void;
  }

  interface MapOptions {
    center?: LatLng;
    zoom?: number;
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    fullscreenControl?: boolean;
  }

  class Map {
    constructor(element: HTMLElement, options?: MapOptions);
    fitBounds(bounds: LatLngBounds, padding?: number): void;
    panTo(latLng: LatLng): void;
    setZoom(zoom: number): void;
  }

  interface MarkerOptions {
    map?: Map;
    position?: LatLng;
    title?: string;
  }

  class Marker {
    constructor(options?: MarkerOptions);
    setMap(map: Map | null): void;
    addListener(eventName: string, handler: () => void): void;
  }
}

interface Window {
  google?: {
    maps: typeof google.maps;
  };
}
