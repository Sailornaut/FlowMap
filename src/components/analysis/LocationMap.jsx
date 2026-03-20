import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function FlyToLocation({ lat, lng }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], 15, { duration: 1.5 });
    }
  }, [lat, lng, map]);
  return null;
}

function MapClickHandler({ onClick }) {
  const map = useMap();
  useEffect(() => {
    const handler = (e) => onClick(e.latlng);
    map.on("click", handler);
    return () => map.off("click", handler);
  }, [map, onClick]);
  return null;
}

function TouchScrollFix() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    // Allow page to scroll when touch starts outside an active drag
    const onTouchStart = () => { container.style.touchAction = "none"; };
    const onTouchEnd   = () => { container.style.touchAction = "auto"; };
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend",   onTouchEnd,   { passive: true });
    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend",   onTouchEnd);
    };
  }, [map]);
  return null;
}

export default function LocationMap({ center, marker, onMapClick, trafficScore }) {
  const getCircleColor = (score) => {
    if (!score) return "#6366f1";
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#f97316";
    if (score >= 40) return "#eab308";
    return "#ef4444";
  };

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-border">
      <MapContainer
        center={center || [40.7128, -74.006]}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        {marker && (
          <>
            <FlyToLocation lat={marker.lat} lng={marker.lng} />
            <Marker position={[marker.lat, marker.lng]}>
              <Popup>{marker.name || "Selected Location"}</Popup>
            </Marker>
            <Circle
              center={[marker.lat, marker.lng]}
              radius={300}
              pathOptions={{
                color: getCircleColor(trafficScore),
                fillColor: getCircleColor(trafficScore),
                fillOpacity: 0.12,
                weight: 2,
              }}
            />
          </>
        )}
        <MapClickHandler onClick={onMapClick} />
        <TouchScrollFix />
      </MapContainer>
    </div>
  );
}