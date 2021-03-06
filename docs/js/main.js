var map = L.map('map', {
  pin: true,
  pinCircle: true,
  pinControl: true,
  guideLayers: []
});

var osmUrl='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
var osm = new L.TileLayer(osmUrl, {minZoom: 8, maxZoom: 16, attribution: osmAttrib});

map.setView(new L.LatLng(51.7500000, 19.4666700),12);
map.addLayer(osm);

var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// var testmarker = new L.Draw.Marker(map);

var drawControl = new L.Control.Draw({
  draw: {
    polyline: {
      distance: 20
    },
    polygon: {
      distance: 25
    },
    rectangle: {},
    marker: {
      distance: 25
    },
    circle: false, // doesn't work
    circlemarker: {}
  },
  edit: {
    featureGroup: drawnItems
  }
});

L.geoJson(loadJson(), {
  onEachFeature: function (feature, layer) {
    if(feature.geometry.type == "LineString") {
      layer.setStyle({
        color: 'purple',
        weight: 5
      });
    }
    drawnItems.addLayer(layer);
  }
});

map.addGuideLayer(drawnItems);
map.removeGuideLayer(drawnItems);


map.addControl(drawControl);

map.on('draw:created', function (e) {
  var layer = e.layer;
  drawnItems.addLayer(layer);
  //console.log(JSON.stringify(drawnItems.toGeoJSON()));
});


map.on('mousemove', function (e) {
  //console.log(e.latlng);
});
