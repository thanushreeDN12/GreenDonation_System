import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leafet default icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const TreeImpactMap = () => {
  const [trees, setTrees] = useState([]);

  useEffect(() => {
    const fetchTrees = async () => {
      try {
        const response = await fetch('/admin/map');
        if (response.ok) {
          const data = await response.json();
          setTrees(data);
        }
      } catch (error) {
        console.error("Error fetching map data:", error);
      }
    };
    fetchTrees();
  }, []);

  return (
    <div style={{ height: '400px', width: '100%', marginTop: '2rem', borderRadius: '12px', overflow: 'hidden' }}>
      <MapContainer center={[21.5937, 78.9629]} zoom={5} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MarkerClusterGroup>
          {trees.map((tree) => (
            <Marker key={tree._id} position={[tree.lat, tree.lng]}>
              <Popup>
                <strong>{tree.species || "Unknown Species"}</strong>
                <br />
                Planted by: {tree.uploadedBy || "Anonymous"}
                {tree.dedication && (
                  <div style={{ marginTop: '5px', fontStyle: 'italic', fontSize: '0.9em', color: '#2e8b57' }}>
                    "{tree.dedication}"
                  </div>
                )}
                {tree.cheers > 0 && (
                  <div style={{ marginTop: '3px', fontSize: '0.9em' }}>
                    💚 {tree.cheers} Cheers
                  </div>
                )}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
};

export default TreeImpactMap;
