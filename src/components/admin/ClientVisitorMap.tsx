'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })
const ZoomControl = dynamic(() => import('react-leaflet').then(m => m.ZoomControl), { ssr: false })

import L, { LatLngExpression } from 'leaflet'

// 使用Leaflet官方默认指针，仅移除阴影
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  shadowSize: [0, 0],
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
  carto_positron: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  carto_voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/full_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  arcgis_street: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  arcgis_satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  tianditu: {
    url: 'https://t{s}.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&LAYER=vec&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    attribution: '&copy; <a href="https://www.tianditu.gov.cn/">天地图</a>',
  },
  tiandituImage: {
    url: 'https://t{s}.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&LAYER=img&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    attribution: '&copy; <a href="https://www.tianditu.gov.cn/">天地图</a>',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>',
  },
}

const MAP_LABELS: Record<string, string> = {
  carto_positron: 'CARTO亮色',
  carto_voyager: 'CARTO详细',
  arcgis_street: 'ArcGIS街道',
  arcgis_satellite: 'ArcGIS影像',
  tianditu: '天地图',
  tiandituImage: '天地图影像',
  osm: 'OSM',
}

export function ClientVisitorMap({ markers }: Props) {
  const [mapSource, setMapSource] = useState('carto_positron')
  const source = MAP_SOURCES[mapSource]

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px', position: 'relative', borderRadius: '24px', overflow: 'hidden' }}>
      {/* 地图源切换按钮 */}
      <div style={{ position: 'absolute', top: '10px', left: '50px', zIndex: 1000, display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '320px' }}>
        {Object.entries(MAP_SOURCES).map(([key]) => (
          <button
            key={key}
            onClick={() => setMapSource(key)}
            style={{
              padding: '6px 10px',
              borderRadius: '4px',
              border: mapSource === key ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: mapSource === key ? 'rgba(29,155,240,0.2)' : 'rgba(0,0,0,0.5)',
              color: mapSource === key ? 'var(--accent)' : 'var(--text-primary)',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {MAP_LABELS[key]}
          </button>
        ))}
      </div>
      
      <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom={true} style={{ width: '100%', height: '100%' }} zoomControl={false}>
        <ZoomControl position="topright" />
        <TileLayer url={source.url} attribution={source.attribution} maxZoom={18} />
        {markers.map((m, idx) => (
          <Marker key={idx} position={[m.lat, m.lon] as LatLngExpression}>
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
