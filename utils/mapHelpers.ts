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

interface GenerateLocationPickerHTMLOptions {
  centerLat: number;
  centerLng: number;
}

export const generateLocationPickerHTML = ({
  centerLat,
  centerLng,
}: GenerateLocationPickerHTMLOptions): string => {
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
        .custom-popup { font-size: 14px; }
        .info-box {
          background: rgba(255,255,255,0.95);
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          border: 2px solid #2d5a3d;
        }
        .leaflet-container {
          cursor: crosshair !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          tap: true,
          touchZoom: true,
          doubleClickZoom: false
        }).setView([${centerLat}, ${centerLng}], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        window.currentMarker = null;
        window.currentLocationMarker = null;

        var selectedIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        map.on('click', function(e) {
          if (window.currentMarker) {
            map.removeLayer(window.currentMarker);
          }
          
          window.currentMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: selectedIcon })
            .addTo(map)
            .bindPopup('Tap here to save this location')
            .openPopup();
          
          window.currentMarker._icon.style.animation = 'bounce 0.5s';
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'locationSelected',
            latitude: e.latlng.lat,
            longitude: e.latlng.lng
          }));
        });

        var info = L.control({ position: 'topright' });
        info.onAdd = function (map) {
          this._div = L.DomUtil.create('div', 'info-box');
          this._div.innerHTML = '📍 Tap anywhere on the map to select a location';
          return this._div;
        };
        info.addTo(map);

        var style = document.createElement('style');
        style.innerHTML = '@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }';
        document.head.appendChild(style);

        setTimeout(function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'mapReady'
          }));
        }, 500);
      </script>
    </body>
    </html>
  `;
};

interface GenerateRouteEditorHTMLOptions {
  route: any[];
  distance: number;
  distanceUnit: "km" | "mi";
}

export const generateRouteEditorHTML = ({
  route,
  distance,
  distanceUnit,
}: GenerateRouteEditorHTMLOptions): string => {
  const routeCoords = route
    .map((point: any) => `[${point.latitude}, ${point.longitude}]`)
    .join(",");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
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
          padding: 10px 15px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 1000;
          font-size: 14px;
        }
        .control-panel {
          position: absolute;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 8px;
          border-radius: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          z-index: 1000;
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          max-width: 90%;
          justify-content: center;
        }
        .control-button {
          display: inline-block;
          padding: 10px 15px;
          background: #2d5a3d;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 13px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          transition: all 0.3s;
        }
        .control-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }
        .zoom-controls {
          position: absolute;
          top: 70px;
          left: 10px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 1000;
          overflow: hidden;
        }
        .zoom-button {
          display: block;
          width: 40px;
          height: 40px;
          border: none;
          background: white;
          cursor: pointer;
          font-size: 20px;
          line-height: 40px;
          text-align: center;
          transition: background 0.3s;
        }
        .zoom-button:hover { background: #f0f0f0; }
        .zoom-button:not(:last-child) { border-bottom: 1px solid #ddd; }
        .location-button {
          position: absolute;
          top: 70px;
          right: 10px;
          width: 40px;
          height: 40px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 1000;
          border: none;
          cursor: pointer;
          font-size: 20px;
          transition: all 0.3s;
        }
        .location-button:hover { transform: scale(1.1); }
        .drawing-mode { background: #cc5500 !important; }
        .danger-button { background: #dc3545 !important; }
        .instructions {
          position: absolute;
          top: 10px;
          left: 10px;
          background: rgba(255,255,255,0.95);
          padding: 10px 15px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 1000;
          font-size: 14px;
          color: #2d5a3d;
          display: none;
          max-width: 250px;
        }
        .instructions.active { display: block; }
        .redraw-mode { color: #dc3545; }
        .confirm-dialog {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: white;
          padding: 20px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          z-index: 2000;
          text-align: center;
          display: none;
        }
        .confirm-dialog.active { display: block; }
        .confirm-dialog h3 { margin-top: 0; color: #dc3545; }
        .confirm-dialog p { margin: 15px 0; color: #333; }
        .confirm-buttons { display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
        .confirm-button {
          padding: 10px 20px;
          border-radius: 6px;
          border: none;
          font-weight: bold;
          cursor: pointer;
          transition: opacity 0.3s;
        }
        .confirm-button:hover { opacity: 0.8; }
        .confirm-yes { background: #dc3545; color: white; }
        .confirm-no { background: #6c757d; color: white; }
        .redraw-notice {
          position: absolute;
          top: 60px;
          left: 50%;
          transform: translateX(-50%);
          background: #dc3545;
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0,0,0,0.3);
          z-index: 1001;
          font-weight: bold;
          display: none;
        }
        .redraw-notice.active { display: block; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <div class="info-panel">
        <strong>Distance:</strong> <span id="distance">0</span> ${distanceUnit}
      </div>
      <div class="zoom-controls">
        <button class="zoom-button" onclick="map.zoomIn()">+</button>
        <button class="zoom-button" onclick="map.zoomOut()">−</button>
      </div>
      <button class="location-button" onclick="fitToRoute()">📍</button>
      <div id="instructions" class="instructions">
        <span id="instructionText">📍 Click on the map to add points to your route</span>
      </div>
      <div class="control-panel">
        <span id="continueBtn" class="control-button" onclick="continueRoute()">Extend Route</span>
        <span id="redrawBtn" class="control-button danger-button" onclick="toggleRedraw()">Redraw All</span>
        <span id="undoBtn" class="control-button" onclick="undoLastPoint()">Undo</span>
        <span id="clearBtn" class="control-button" onclick="clearChanges()">Reset</span>
      </div>
      <div id="redrawNotice" class="redraw-notice">
        ⚠️ Drawing new route - Click "Save New Route" when done!
      </div>
      <div id="confirmDialog" class="confirm-dialog">
        <h3>Redraw Entire Route?</h3>
        <p>This will delete the existing route and let you draw a completely new one. This action cannot be undone.</p>
        <div class="confirm-buttons">
          <button class="confirm-button confirm-yes" onclick="confirmRedraw()">Yes, Redraw</button>
          <button class="confirm-button confirm-no" onclick="cancelRedraw()">Cancel</button>
        </div>
      </div>
      
      <script>
        var map = L.map('map', {
          zoomControl: true,
          touchZoom: true,
          doubleClickZoom: true,
          scrollWheelZoom: true,
          boxZoom: true,
          keyboard: true,
          tap: true,
          tapTolerance: 15,
          bounceAtZoomLimits: false
        });
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
          minZoom: 3
        }).addTo(map);
        
        map.zoomControl.setPosition('topleft');

        var existingRoute = [${routeCoords}];
        var originalRoute = [...existingRoute];
        var extensionPoints = [];
        var newRoutePoints = [];
        var existingLine = null;
        var extensionLine = null;
        var newRouteLine = null;
        var totalDistance = ${distance};
        var isDrawing = false;
        var isRedrawing = false;
        var extensionMarkers = [];
        var newRouteMarkers = [];
        var startMarker = null;
        var endMarker = null;

        function drawExistingRoute() {
          if (existingRoute.length > 0) {
            if (existingLine) map.removeLayer(existingLine);
            
            existingLine = L.polyline(existingRoute, {
              color: '#2d5a3d',
              weight: 4,
              opacity: 0.8
            }).addTo(map);

            if (startMarker) map.removeLayer(startMarker);
            startMarker = L.marker(existingRoute[0], {
              icon: L.divIcon({
                html: '<div style="background: #2d5a3d; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [24, 24],
                className: 'custom-div-icon'
              })
            }).addTo(map).bindPopup('Start');

            if (endMarker) map.removeLayer(endMarker);
            endMarker = L.marker(existingRoute[existingRoute.length - 1], {
              icon: L.divIcon({
                html: '<div style="background: #cc5500; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                iconSize: [24, 24],
                className: 'custom-div-icon'
              })
            }).addTo(map).bindPopup('End');

            map.fitBounds(existingLine.getBounds().pad(0.1));
          } else {
            map.setView([47.6062, -122.3321], 13);
          }
        }
        
        drawExistingRoute();

        function continueRoute() {
          if (isRedrawing) {
            alert('Please finish or cancel the route redraw first');
            return;
          }
          
          var btn = document.getElementById('continueBtn');
          var instructions = document.getElementById('instructions');
          
          if (isDrawing) {
            isDrawing = false;
            btn.innerText = 'Extend Route';
            btn.classList.remove('drawing-mode');
            instructions.classList.remove('active');
            map.getContainer().style.cursor = '';
            
            if (extensionPoints.length > 0) {
              existingRoute = existingRoute.concat(extensionPoints);
              extensionPoints = [];
              
              extensionMarkers.forEach(function(marker) { map.removeLayer(marker); });
              extensionMarkers = [];
              
              if (extensionLine) {
                map.removeLayer(extensionLine);
                extensionLine = null;
              }
              
              drawExistingRoute();
              updateRoute();
            }
          } else {
            isDrawing = true;
            btn.innerText = 'Done Extending';
            btn.classList.add('drawing-mode');
            instructions.classList.add('active');
            document.getElementById('instructionText').innerText = '📍 Click to add points. Click "Done Extending" when finished.';
            map.getContainer().style.cursor = 'crosshair';
          }
        }
        
        function startRedraw() {
          if (isDrawing) continueRoute();
          document.getElementById('confirmDialog').classList.add('active');
        }
        
        function confirmRedraw() {
          document.getElementById('confirmDialog').classList.remove('active');
          
          if (existingLine) { map.removeLayer(existingLine); existingLine = null; }
          if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
          if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
          
          clearExtensionPoints();
          
          isRedrawing = true;
          isDrawing = false;
          newRoutePoints = [];
          
          var btn = document.getElementById('redrawBtn');
          btn.innerText = 'Save New Route';
          btn.classList.add('drawing-mode');
          
          var instructions = document.getElementById('instructions');
          instructions.classList.add('active');
          document.getElementById('instructionText').innerHTML = '<span class="redraw-mode">🔴 REDRAW MODE: Click to draw your new route. Click "Save New Route" when done.</span>';
          
          document.getElementById('redrawNotice').classList.add('active');
          map.getContainer().style.cursor = 'crosshair';
        }
        
        function toggleRedraw() {
          if (isRedrawing) stopRedrawing();
          else startRedraw();
        }
        
        function cancelRedraw() {
          document.getElementById('confirmDialog').classList.remove('active');
        }
        
        function stopRedrawing() {
          if (newRoutePoints.length === 0) {
            isRedrawing = false;
            var btn = document.getElementById('redrawBtn');
            btn.innerText = 'Redraw All';
            btn.classList.remove('drawing-mode');
            document.getElementById('instructions').classList.remove('active');
            document.getElementById('redrawNotice').classList.remove('active');
            map.getContainer().style.cursor = '';
            return;
          }
          
          var btn = document.getElementById('redrawBtn');
          btn.innerText = 'Processing...';
          btn.disabled = true;
          
          var pointsToSave = [];
          for (var i = 0; i < newRoutePoints.length; i++) {
            pointsToSave.push([newRoutePoints[i][0], newRoutePoints[i][1]]);
          }
          
          existingRoute = pointsToSave;
          extensionPoints = [];
          originalRoute = [...pointsToSave];
          
          var newDistance = calculateDistance(existingRoute);
          var displayDistance = newDistance;
          var unit = '${distanceUnit}';
          if (unit === 'km') {
            displayDistance = (newDistance / 1000).toFixed(2);
          } else {
            displayDistance = (newDistance / 1609.34).toFixed(2);
          }
          document.getElementById('distance').innerText = displayDistance;
          
          window.savedRedrawRoute = {
            route: existingRoute.map(function(point, index) {
              return { latitude: point[0], longitude: point[1], timestamp: Date.now() + index };
            }),
            distance: newDistance
          };
          
          window.routeWasRedrawn = true;
          
          newRouteMarkers.forEach(function(marker) { map.removeLayer(marker); });
          newRouteMarkers = [];
          newRoutePoints = [];
          
          if (newRouteLine) { map.removeLayer(newRouteLine); newRouteLine = null; }
          
          drawExistingRoute();
          
          isRedrawing = false;
          btn.innerText = 'Redraw All';
          btn.classList.remove('drawing-mode');
          btn.disabled = false;
          
          document.getElementById('instructions').classList.remove('active');
          document.getElementById('redrawNotice').classList.remove('active');
          map.getContainer().style.cursor = '';
          
          var successDiv = document.createElement('div');
          successDiv.style.cssText = 'position:absolute;top:100px;left:50%;transform:translateX(-50%);background:#28a745;color:white;padding:15px 25px;border-radius:8px;z-index:9999;font-weight:bold;text-align:center;box-shadow:0 4px 8px rgba(0,0,0,0.3);';
          successDiv.innerHTML = '✓ Route Updated!<br><small style="font-weight:normal;">Click "Done" to apply changes</small>';
          document.body.appendChild(successDiv);
        }

        function undoLastPoint() {
          if (isRedrawing) {
            if (newRoutePoints.length > 0) {
              newRoutePoints.pop();
              if (newRouteMarkers.length > 0) {
                var lastMarker = newRouteMarkers.pop();
                if (lastMarker) map.removeLayer(lastMarker);
              }
              if (newRouteLine) { map.removeLayer(newRouteLine); newRouteLine = null; }
              if (newRoutePoints.length > 0) {
                newRouteLine = L.polyline(newRoutePoints, { color: '#dc3545', weight: 4, opacity: 0.8, dashArray: '10, 5' }).addTo(map);
              }
              updateRouteForRedraw();
            }
          } else if (isDrawing) {
            if (extensionPoints.length > 0) {
              extensionPoints.pop();
              if (extensionMarkers.length > 0) {
                var lastMarker = extensionMarkers.pop();
                if (lastMarker) map.removeLayer(lastMarker);
              }
              if (extensionLine) { map.removeLayer(extensionLine); extensionLine = null; }
              if (extensionPoints.length > 0) {
                var lineToDraw = [existingRoute[existingRoute.length - 1]].concat(extensionPoints);
                extensionLine = L.polyline(lineToDraw, { color: '#cc5500', weight: 4, opacity: 0.8, dashArray: '10, 5' }).addTo(map);
              }
              updateRoute();
            }
          } else {
            if (existingRoute.length > 1) {
              existingRoute.pop();
              drawExistingRoute();
              updateRoute();
            }
          }
        }
        
        function clearExtensionPoints() {
          extensionPoints = [];
          extensionMarkers.forEach(function(marker) { map.removeLayer(marker); });
          extensionMarkers = [];
          if (extensionLine) { map.removeLayer(extensionLine); extensionLine = null; }
        }

        function clearChanges() {
          if (isRedrawing) {
            isRedrawing = false;
            var btn = document.getElementById('redrawBtn');
            btn.innerText = 'Redraw All';
            btn.classList.remove('drawing-mode');
            document.getElementById('instructions').classList.remove('active');
            document.getElementById('redrawNotice').classList.remove('active');
            map.getContainer().style.cursor = '';
            newRoutePoints = [];
            newRouteMarkers.forEach(function(marker) { if (marker) map.removeLayer(marker); });
            newRouteMarkers = [];
            if (newRouteLine) { map.removeLayer(newRouteLine); newRouteLine = null; }
            existingRoute = JSON.parse(JSON.stringify(originalRoute));
            drawExistingRoute();
            updateRoute();
          } else if (isDrawing) {
            extensionPoints = [];
            extensionMarkers.forEach(function(marker) { if (marker) map.removeLayer(marker); });
            extensionMarkers = [];
            if (extensionLine) { map.removeLayer(extensionLine); extensionLine = null; }
            updateRoute();
          } else {
            existingRoute = JSON.parse(JSON.stringify(originalRoute));
            extensionPoints = [];
            extensionMarkers.forEach(function(marker) { if (marker) map.removeLayer(marker); });
            extensionMarkers = [];
            if (extensionLine) { map.removeLayer(extensionLine); extensionLine = null; }
            drawExistingRoute();
            updateRoute();
          }
        }

        map.on('click', function(e) {
          if (!isDrawing && !isRedrawing) return;
          
          var newPoint = [e.latlng.lat, e.latlng.lng];
          
          if (isRedrawing) {
            newRoutePoints.push(newPoint);
            var marker = L.circleMarker(newPoint, {
              radius: 5, fillColor: '#dc3545', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.8
            }).addTo(map);
            newRouteMarkers.push(marker);
            if (newRouteLine) map.removeLayer(newRouteLine);
            newRouteLine = L.polyline(newRoutePoints, { color: '#dc3545', weight: 4, opacity: 0.8, dashArray: '10, 5' }).addTo(map);
            updateRouteForRedraw();
          } else if (isDrawing) {
            extensionPoints.push(newPoint);
            var marker = L.circleMarker(newPoint, {
              radius: 5, fillColor: '#cc5500', color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.8
            }).addTo(map);
            extensionMarkers.push(marker);
            if (extensionLine) map.removeLayer(extensionLine);
            var lineToDraw = extensionPoints;
            if (existingRoute.length > 0) {
              lineToDraw = [existingRoute[existingRoute.length - 1]].concat(extensionPoints);
            }
            extensionLine = L.polyline(lineToDraw, { color: '#cc5500', weight: 4, opacity: 0.8, dashArray: '10, 5' }).addTo(map);
            updateRoute();
          }
        });

        function calculateDistance(points) {
          var distance = 0;
          for (var i = 1; i < points.length; i++) {
            var lat1 = points[i-1][0] * Math.PI / 180;
            var lat2 = points[i][0] * Math.PI / 180;
            var deltaLat = (points[i][0] - points[i-1][0]) * Math.PI / 180;
            var deltaLon = (points[i][1] - points[i-1][1]) * Math.PI / 180;
            var a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
                    Math.cos(lat1) * Math.cos(lat2) *
                    Math.sin(deltaLon/2) * Math.sin(deltaLon/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance += 6371000 * c;
          }
          return distance;
        }
        
        function updateRouteForRedraw() {
          var newDistance = calculateDistance(newRoutePoints);
          var displayDistance = newDistance;
          var unit = '${distanceUnit}';
          if (unit === 'km') displayDistance = (newDistance / 1000).toFixed(2);
          else displayDistance = (newDistance / 1609.34).toFixed(2);
          document.getElementById('distance').innerText = displayDistance;
        }

        function updateRoute() {
          var allPoints = existingRoute.concat(extensionPoints);
          var newDistance = calculateDistance(allPoints);
          var displayDistance = newDistance;
          var unit = '${distanceUnit}';
          if (unit === 'km') displayDistance = (newDistance / 1000).toFixed(2);
          else displayDistance = (newDistance / 1609.34).toFixed(2);
          document.getElementById('distance').innerText = displayDistance;

          var routeData = allPoints.map(function(point) {
            return { latitude: point[0], longitude: point[1], timestamp: Date.now() };
          });

          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'routeUpdated',
            route: routeData,
            distance: newDistance
          }));
        }
        
        function fitToRoute() {
          var bounds = null;
          if (existingRoute.length > 0 || extensionPoints.length > 0 || newRoutePoints.length > 0) {
            var allPoints = [];
            if (isRedrawing && newRoutePoints.length > 0) allPoints = newRoutePoints;
            else allPoints = existingRoute.concat(extensionPoints);
            if (allPoints.length > 0) {
              bounds = L.latLngBounds(allPoints);
              map.fitBounds(bounds.pad(0.1));
            }
          } else {
            map.setView([47.6062, -122.3321], 13);
          }
        }
        
        var touchStartTime;
        var touchStartPoint;
        
        map.on('touchstart', function(e) {
          touchStartTime = new Date().getTime();
          touchStartPoint = e.latlng;
        });
        
        map.on('touchend', function(e) {
          var touchEndTime = new Date().getTime();
          var touchDuration = touchEndTime - touchStartTime;
          if (touchDuration < 200 && touchStartPoint) {
            var distance = map.distance(touchStartPoint, e.latlng);
            if (distance < 50) {
              map.fire('click', { latlng: e.latlng, containerPoint: e.containerPoint, originalEvent: e.originalEvent });
            }
          }
        });
        
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Enter' && isRedrawing) stopRedrawing();
          if (e.key === 'Escape') {
            if (isRedrawing || isDrawing) clearChanges();
          }
        });
      </script>
    </body>
    </html>
  `;
};