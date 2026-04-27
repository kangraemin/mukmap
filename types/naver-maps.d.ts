declare namespace naver.maps {
  class Map {
    constructor(el: HTMLElement, opts?: MapOptions)
    getBounds(): LatLngBounds
    setCenter(latlng: LatLng): void
    setZoom(zoom: number): void
    getCenter(): LatLng
    getZoom(): number
    fitBounds(bounds: LatLngBounds, margin?: number): void
    panTo(latlng: LatLng, transitionOptions?: object): void
    morph(latlng: LatLng, zoom: number, transitionOptions?: { duration?: number; easing?: string }): void
  }

  interface MapOptions {
    center?: LatLng
    zoom?: number
    minZoom?: number
    maxZoom?: number
    zoomControl?: boolean
    zoomControlOptions?: { position: number }
  }

  class LatLng {
    constructor(lat: number, lng: number)
    lat(): number
    lng(): number
  }

  class LatLngBounds {
    constructor(sw: LatLng, ne: LatLng)
    getSW(): LatLng
    getNE(): LatLng
    extend(latlng: LatLng): LatLngBounds
  }

  class Marker {
    constructor(opts: MarkerOptions)
    setMap(map: Map | null): void
    setPosition(latlng: LatLng): void
    getPosition(): LatLng
    setIcon(icon: MarkerIcon | string): void
  }

  interface MarkerOptions {
    position: LatLng
    map?: Map
    icon?: MarkerIcon | string
    title?: string
  }

  interface MarkerIcon {
    content: string
    size?: Size
    anchor?: Point
  }

  class InfoWindow {
    constructor(opts: InfoWindowOptions)
    open(map: Map, marker?: Marker): void
    close(): void
    setContent(content: string): void
  }

  interface InfoWindowOptions {
    content?: string
    borderWidth?: number
    backgroundColor?: string
    borderColor?: string
    anchorSize?: Size
    pixelOffset?: Point
    disableAnchor?: boolean
    maxWidth?: number
  }

  class Size {
    constructor(width: number, height: number)
  }

  class Point {
    constructor(x: number, y: number)
  }

  class Event {
    static addListener(target: object, event: string, handler: (...args: unknown[]) => void): unknown
    static removeListener(listener: unknown): void
  }

  const Position: {
    TOP_RIGHT: number
    TOP_LEFT: number
    BOTTOM_RIGHT: number
    BOTTOM_LEFT: number
  }
}

interface Window {
  naver: typeof naver
  MarkerClustering: new (opts: {
    minClusterSize?: number
    maxZoom?: number
    map: naver.maps.Map
    markers: naver.maps.Marker[]
    disableClickZoom?: boolean
    gridSize?: number
    icons?: object[]
    indexGenerator?: number[]
    stylingFunction?: (clusterMarker: HTMLElement, count: number) => void
  }) => {
    setMap(map: naver.maps.Map | null): void
  }
}
