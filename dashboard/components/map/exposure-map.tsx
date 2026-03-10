"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Marker {
  id: number;
  city: string;
  stateOrCountry: string;
  lat: number;
  lon: number;
  destinationType: string;
  totalPremium: number;
  bookingCount: number;
  policyCount: number;
  tripCostExposure: number;
  claimCount: number;
}

interface Route {
  origin: string;
  dest: string;
  count: number;
  destLat?: number;
  destLon?: number;
}

interface Props {
  markers: Marker[];
  routes: Route[];
  showRoutes: boolean;
}

const TYPE_COLORS: Record<string, string> = {
  us_atlantic: "#3b82f6",
  gulf_coast: "#14b8a6",
  caribbean: "#f97316",
};

// Airport coordinates for origin airports (major US hubs)
const AIRPORT_COORDS: Record<string, [number, number]> = {
  JFK: [40.6413, -73.7781],
  EWR: [40.6895, -74.1745],
  LGA: [40.7769, -73.8740],
  BOS: [42.3656, -71.0096],
  PHL: [39.8744, -75.2424],
  IAD: [38.9531, -77.4565],
  DCA: [38.8512, -77.0402],
  ATL: [33.6407, -84.4277],
  CLT: [35.2144, -80.9473],
  ORD: [41.9742, -87.9073],
  DTW: [42.2124, -83.3534],
  MSP: [44.8848, -93.2223],
  DFW: [32.8998, -97.0403],
  IAH: [29.9902, -95.3368],
  MIA: [25.7959, -80.2870],
  FLL: [26.0742, -80.1506],
  TPA: [27.9755, -82.5332],
  MCO: [28.4312, -81.3081],
  DEN: [39.8561, -104.6737],
  LAX: [33.9416, -118.4085],
  SFO: [37.6213, -122.3790],
  SEA: [47.4502, -122.3088],
};

export function ExposureMap({ markers, routes, showRoutes }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clean up previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const map = L.map(mapRef.current, {
      center: [25, -75],
      zoom: 4,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    // Find max premium for sizing
    const maxPremium = Math.max(...markers.map(m => m.totalPremium), 1);

    // Add destination bubbles
    for (const m of markers) {
      const radius = Math.max(6, Math.sqrt(m.totalPremium / maxPremium) * 35);
      const color = TYPE_COLORS[m.destinationType] || "#6b7280";

      const circle = L.circleMarker([m.lat, m.lon], {
        radius,
        fillColor: color,
        color: color,
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.4,
      }).addTo(map);

      circle.bindTooltip(
        `<div style="min-width:180px">
          <strong>${m.city}, ${m.stateOrCountry}</strong><br/>
          <span style="color:${color}">${m.destinationType.replace(/_/g, " ")}</span><br/>
          <hr style="margin:4px 0;border-color:#e5e7eb"/>
          Policies: <strong>${m.policyCount.toLocaleString()}</strong><br/>
          Trip Cost Exposure: <strong>$${(m.tripCostExposure / 1000).toFixed(0)}K</strong><br/>
          Pure Premium: <strong>$${(m.totalPremium / 1000).toFixed(0)}K</strong><br/>
          Claims: <strong>${m.claimCount}</strong>
        </div>`,
        { sticky: true, className: "leaflet-tooltip-custom" }
      );
    }

    // Add flight routes
    if (showRoutes && routes.length > 0) {
      const maxCount = Math.max(...routes.map(r => r.count));

      for (const r of routes) {
        const originCoords = AIRPORT_COORDS[r.origin];
        if (!originCoords || !r.destLat || !r.destLon) continue;

        const weight = Math.max(1, (r.count / maxCount) * 5);

        // Create curved line using intermediate point
        const midLat = (originCoords[0] + r.destLat) / 2;
        const midLon = (originCoords[1] + r.destLon) / 2;
        const offset = Math.abs(originCoords[0] - r.destLat) * 0.3;

        const curve = L.polyline(
          [
            [originCoords[0], originCoords[1]],
            [midLat + offset, midLon - offset * 0.5],
            [r.destLat, r.destLon],
          ],
          {
            color: "#6366f1",
            weight,
            opacity: 0.3,
            smoothFactor: 3,
          }
        ).addTo(map);

        curve.bindTooltip(`${r.origin} → ${r.dest}: ${r.count} policies`);
      }
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [markers, routes, showRoutes]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-lg border"
      style={{ height: "500px" }}
    />
  );
}
