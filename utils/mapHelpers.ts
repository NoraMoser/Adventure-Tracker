// utils/mapHelpers.ts

interface GenerateRouteDrawerHTMLOptions {
  centerLat: number;
  centerLng: number;
  distanceUnit: "km" | "mi";
  existingRoute?: any[];
}

export const generateRouteDrawerHTML = ({
  centerLat,
  centerLng,
  distanceUnit,
  existingRoute = [],
}: GenerateRouteDrawerHTMLOptions): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .info-panel {
          position: absolute;
          top: 10px;
          right: 10px;
          background: white;
          padding: 10px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 1000;
          font-size: 14px;
        }
        .info-title {
          font-weight: bold;
          margin-bottom: 5px;
          color: #1e3a5f;
        }
        .info-distance {
          color: #2d5a3d;
          font-size: 16px;
          font-weight: bold;
        }
        .instructions {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255,255,255,0.95);
          padding: 10px 20px;
          border-radius: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          z-index: 1000;
          font-size: 14px;
          color: #1e3a5f;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="info-panel">
        <div class="info-title">Route Distance</div>
        <div class="info-distance" id="distance">0.00 ${distanceUnit}</div>
      </div>
      <div class="instructions" id="instructions">
        Click points on the map to draw your route
      </div>
      <script>
        var map = L.map('map', {
          tap: true,
          zoomControl: true,
          doubleClickZoom: false
        }).setView([${centerLat}, ${centerLng}], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        var routePoints = [];
        var routeLine = null;
        var markers = [];
        var totalDistance = 0;

        function calculateDistance(lat1, lon1, lat2, lon2) {
          var R = 6371000;
          var φ1 = lat1 * Math.PI / 180;
          var φ2 = lat2 * Math.PI / 180;
          var Δφ = (lat2 - lat1) * Math.PI / 180;
          var Δλ = (lon2 - lon1) * Math.PI / 180;
          var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
          var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        }

        function addRoutePoint(lat, lng) {
          routePoints.push([lat, lng]);

          var color = routePoints.length === 1 ? '#2d5a3d' : '#cc5500';
          var markerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: '<div style="background-color: ' + color + '; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          });

          var marker = L.marker([lat, lng], { 
            icon: markerIcon,
            interactive: false
          }).addTo(map);
          markers.push(marker);

          if (routePoints.length >= 2) {
            if (routeLine) {
              map.removeLayer(routeLine);
              routeLine = null;
            }

            routeLine = L.polyline(routePoints, {
              color: '#2d5a3d',
              weight: 4,
              opacity: 0.8
            }).addTo(map);
          }

          updateDistance();

          if (routePoints.length === 1) {
            document.getElementById('instructions').innerText = 'Continue clicking to draw your route';
          } else {
            document.getElementById('instructions').innerText = 'Keep adding points or tap Done to finish';
          }
        }

        function updateDistance() {
          totalDistance = 0;
          
          if (routePoints.length >= 2) {
            for (var i = 1; i < routePoints.length; i++) {
              totalDistance += calculateDistance(
                routePoints[i-1][0], routePoints[i-1][1],
                routePoints[i][0], routePoints[i][1]
              );
            }
          }

          var displayDistance = totalDistance;
          var unit = '${distanceUnit}';
          if (unit === 'km') {
            displayDistance = (totalDistance / 1000).toFixed(2);
          } else {
            displayDistance = (totalDistance / 1609.34).toFixed(2);
          }
          document.getElementById('distance').innerText = displayDistance + ' ' + unit;

          if (routePoints.length > 0) {
            var routeData = routePoints.map(function(point) {
              return {
                latitude: point[0],
                longitude: point[1],
                timestamp: Date.now()
              };
            });

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'routeUpdated',
              route: routeData,
              distance: totalDistance
            }));
          }
        }

        map.on('click', function(e) {
          e.originalEvent.preventDefault();
          e.originalEvent.stopPropagation();
          addRoutePoint(e.latlng.lat, e.latlng.lng);
        });

        var clearControl = L.Control.extend({
          options: { position: 'topleft' },
          onAdd: function(map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            var button = L.DomUtil.create('a', '', container);
            button.innerHTML = '🗑️ Clear';
            button.href = '#';
            button.style.width = '80px';
            button.style.textAlign = 'center';
            button.style.fontSize = '14px';
            button.style.padding = '5px';
            
            L.DomEvent.on(button, 'click', function(e) {
              L.DomEvent.preventDefault(e);
              L.DomEvent.stopPropagation(e);
              
              routePoints = [];
              markers.forEach(function(marker) {
                map.removeLayer(marker);
              });
              markers = [];
              if (routeLine) {
                map.removeLayer(routeLine);
                routeLine = null;
              }
              totalDistance = 0;
              document.getElementById('distance').innerText = '0.00 ${distanceUnit}';
              document.getElementById('instructions').innerText = 'Click points on the map to draw your route';
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'routeUpdated',
                route: [],
                distance: 0
              }));
              
              return false;
            });
            
            return container;
          }
        });
        
        map.addControl(new clearControl());

        var undoControl = L.Control.extend({
          options: { position: 'topleft' },
          onAdd: function(map) {
            var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            var button = L.DomUtil.create('a', '', container);
            button.innerHTML = '↩️ Undo';
            button.href = '#';
            button.style.width = '80px';
            button.style.textAlign = 'center';
            button.style.fontSize = '14px';
            button.style.padding = '5px';
            
            L.DomEvent.on(button, 'click', function(e) {
              L.DomEvent.preventDefault(e);
              L.DomEvent.stopPropagation(e);
              
              if (routePoints.length > 0) {
                routePoints.pop();
                
                if (markers.length > 0) {
                  var lastMarker = markers.pop();
                  map.removeLayer(lastMarker);
                }
                
                if (routeLine) {
                  map.removeLayer(routeLine);
                  routeLine = null;
                }
                
                if (routePoints.length >= 2) {
                  routeLine = L.polyline(routePoints, {
                    color: '#2d5a3d',
                    weight: 4,
                    opacity: 0.8
                  }).addTo(map);
                }
                
                updateDistance();
                
                if (routePoints.length === 0) {
                  document.getElementById('instructions').innerText = 'Click points on the map to draw your route';
                }
              }
              
              return false;
            });
            
            return container;
          }
        });
        
        map.addControl(new undoControl());

        var existingRoute = ${JSON.stringify(existingRoute)};
        if (existingRoute && existingRoute.length > 0) {
          existingRoute.forEach(function(point, index) {
            routePoints.push([point.latitude, point.longitude]);
            
            var markerIcon = L.divIcon({
              className: 'custom-div-icon',
              html: '<div style="background-color: ' + (index === 0 ? '#2d5a3d' : '#cc5500') + '; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            });
            
            var marker = L.marker([point.latitude, point.longitude], { icon: markerIcon }).addTo(map);
            markers.push(marker);
          });
          
          if (routePoints.length >= 2) {
            routeLine = L.polyline(routePoints, {
              color: '#2d5a3d',
              weight: 4,
              opacity: 0.8
            }).addTo(map);
          }
          
          updateDistance();
          
          if (routePoints.length > 0) {
            var group = new L.featureGroup(markers);
            map.fitBounds(group.getBounds().pad(0.1));
          }
        }
      </script>
    </body>
    </html>
  `;
};