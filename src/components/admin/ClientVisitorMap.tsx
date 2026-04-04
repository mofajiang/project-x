'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })
const ZoomControl = dynamic(() => import('react-leaflet').then(m => m.ZoomControl), { ssr: false })

import L, { LatLngExpression } from 'leaflet'

// 自定义较小的标记图标
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [0, -32],
  shadowSize: [41, 41],
})

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

type Marker = {
  name: string
  lat: number
  lon: number
  count: number
  time: string
}

type Props = {
  markers: Marker[]
}

const MAP_SOURCES: Record<string, { url: string; attribution: string }> = {
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
  },
}

export function ClientVisitorMap({ markers }: Props) {
  const [mapSource] = useState('osm')
  const source = MAP_SOURCES[mapSource]

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px', position: 'relative', borderRadius: '24px', overflow: 'hidden' }}>
      <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom={true} style={{ width: '100%', height: '100%' }} zoomControl={false}>
        <ZoomControl position="topright" />
        <TileLayer url={source.url} attribution={source.attribution} maxZoom={18} />
        {markers.map((m, idx) => (
          <Marker key={idx} position={[m.lat, m.lon] as LatLngExpression} icon={customIcon}>
            <Popup>
              <div className="text-xs" style={{ minWidth: '150px' }}>
                <p className="font-bold">{m.name}</p>
                <p>{m.count} 次访问</p>
                <p className="text-[11px]">{m.time}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {/* Leaflet attribution spacer */}
      <div style={{ pointerEvents: 'none' }} />
    </div>
  )
}
