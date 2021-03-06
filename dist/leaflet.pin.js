(function () {
    L.Handler.MarkerPin = L.Handler.extend({
        options: {
            distance: 20,
            vertices: true
        },

        initialize: function (map, marker, options) {
            L.Handler.prototype.initialize.call(this, map);
            L.Util.setOptions(this, options || {});
            L.Handler.MarkerPin.include(L.Evented.prototype);
        },

        enable: function (marker) {
            if (marker && this._map.options.pin) {
                this._observeMarker(marker);
                this._currentMarker = marker;
            }
        },

        disable: function () {
            if (this._map.options.pin) {
                this._unobserveMarker();
            }
        },

        _observeMarker: function (marker) {
            marker.on('move', this._updateLatLng, this);
        },

        _unobserveMarker: function () {
            this._currentMarker.off('move', this._updateLatLng, this);
        },

        _updateLatLng: function (e) {
            var marker = e.target;

            marker.setOpacity(1);
            if (!marker._shadow) {
                L.DomUtil.addClass(marker._icon, 'leaflet-marker-icon leaflet-div-icon leaflet-editing-icon leaflet-pin-marker');
            }
            var latlng = marker.getLatLng();

            // Search closest point to pin and if isn't null replace original latlng
            this._closest = this._findClosestMarker(this._map, this._map._guideList, latlng, this.options.distance, this.options.vertices);
            this._closestCircle = this._map.options.pinCircle ? this._findClosestCircle(this._map, this._map._circleGuideList, e.latlng) : null;


            if (this._closestCircle != null) {
                marker._latlng = this._closestCircle;
                marker.update();

            } else if (this._closest != null) {
                marker._latlng = this._closest.latlng;
                marker.update();
            }
        },

        _findClosestMarker: function (map, guideList, latlng, distance, vertices) {
            return L.GeometryUtil.closestLayerSnap(map, guideList, latlng, distance, vertices);
        },

        _findClosestCircle: function (map, guideList, latlng) {
            var closest = L.GeometryUtil.closestLayerSnap(map, guideList, latlng);

            if (closest !== null) {
                var x = closest.layer.getLatLng().lng - latlng.lng,
                    y = closest.layer.getLatLng().lat - latlng.lat,
                    tg = Math.abs(y) / Math.abs(x),
                    alpha = Math.atan(tg),
                    radius = closest.layer.editing._shape._radius;

                var distanceStart = this._map.project(closest.latlng);
                var distanceFinish = this._map.project(latlng);
                var x2 = Math.abs(distanceFinish.x - distanceStart.x);
                var y2 = Math.abs(distanceFinish.y - distanceStart.y);
                var distance = Math.sqrt(Math.pow(x2, 2) + Math.pow(y2, 2));

                if (radius + this.options.distance > distance && radius - this.options.distance < distance) {
                    var a = radius * Math.cos(alpha),
                        b = radius * Math.sin(alpha),
                        point = this._map.project(closest.layer.getLatLng());

                    if (x >= 0 && y >= 0) {
                        return this._map.unproject([point.x - a, point.y + b]);
                    } else if (x >= 0 && y < 0) {
                        return this._map.unproject([point.x - a, point.y - b]);
                    } else if (x < 0 && y < 0) {
                        return this._map.unproject([point.x + a, point.y - b]);
                    } else if (x < 0 && y >= 0) {
                        return this._map.unproject([point.x + a, point.y + b]);
                    }
                } else if (this.options.distance > distance) {
                    return closest.layer.getLatLng();
                } else {
                    return null;
                }
            }
            return null;
        }

    });

    // Additional map methods

    L.Map.Pin = {

        _pin_initialize: function () {

            this._guideList = [];
            this._circleGuideList = [];
            for (var i = 0; i < this.options.guideLayers.length; i++) {
                this.addGuideLayer(this.options.guideLayers[i]);
            }

            if (this.options.pinControl) {
                this.addControl(new L.Control.Pin());
            }
        },

        togglePin: function () {
            this.options.pin = !this.options.pin;
        },

        removeGuideLayer: function (layer) {
            for (var i = 0; i < this._guideList.length; i++) {
                if (this._guideList[i]._leaflet_id == layer._leaflet_id) {
                    this._guideList.splice(i, 1);
                }
            }
        },

        _parse: function (layer) {
            var that = this;
            if (layer instanceof L.FeatureGroup) {
                layer.on('layeradd', function (e) {
                    that._parse(e.layer);
                });
                layer.on('layerremove', function (e) {
                    that.removeGuideLayer(e.layer);
                });
                for (var feature in layer._layers) {
                    if (layer._layers.hasOwnProperty(feature)) {
                        this._parse(layer._layers[feature]);
                    }
                }
            } else {
                if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
                    var polygon = new L.polygon(L.LatLngUtil.cloneLatLngs(layer.getLatLngs()));
                    polygon._leaflet_id = layer._leaflet_id;
                    this._guideList.push(polygon);
                } else if (layer instanceof L.Polyline) {
                    var polyline = new L.polyline(L.LatLngUtil.cloneLatLngs(layer.getLatLngs()));
                    polyline._leaflet_id = layer._leaflet_id;
                    this._guideList.push(polyline);
                } else if (layer instanceof L.Circle) {
                    var circle = new L.circle(L.LatLngUtil.cloneLatLng(layer.getLatLng(), JSON.parse(JSON.stringify(layer.getRadius()))));
                    circle._mRadius = JSON.parse(JSON.stringify(layer.getRadius()));
                    circle._leaflet_id = layer._leaflet_id;
                    circle.editing = layer.editing;
                    this._circleGuideList.push(circle);
                } else {
                    var marker = new L.marker(L.LatLngUtil.cloneLatLng(layer.getLatLng()));
                    marker._leaflet_id = layer._leaflet_id;
                    this._guideList.push(marker);
                }
            }
        },

        updateGuideLayer: function (id, latlng) {
            for (var i = 0; i < this._guideList.length; i++) {
                if (this._guideList[i]._leaflet_id == id) {
                    if (latlng.length) {
                        this._guideList[i].setLatLngs(L.LatLngUtil.cloneLatLngs(latlng));
                    } else {
                        this._guideList[i].setLatLng(L.LatLngUtil.cloneLatLng(latlng));
                    }
                }
            }
        },

        addGuideLayer: function (layer) {
            this._parse(layer);
        }
    };

    L.Map.include(L.Map.Pin);
    L.Map.addInitHook('_pin_initialize');

    // Add pin options to map object
    L.Map.mergeOptions({
        pin: false,
        pinCircle: false,
        pinControl: false,
        guideLayers: []
    });

    // Auto enable pin handler for drawing if pin option is enabled
    L.Draw.Feature.Pin = {

        /*
            This a workaround because `L.Draw.Feature.addInitHook('_pin_initialize')` below does not work 
            The '_pin_initialize' is never called as initHook. 
            Check out https://github.com/Leaflet/Leaflet.draw/issues/857 - "L.Draw.Feature.addInitHook(...) stopped working in 0.4.13"

            So we have to override the constructor (initialize method) and call this._pin_initialize() directly from constructor
        */

        baseInitialize: L.Draw.Feature.prototype.initialize,
        initialize: function (map, options) {
            this.baseInitialize.apply(this, arguments);
            this._pin_initialize();
        },

        _pin_initialize: function () {
            this.on('enabled', this._pin_on_enabled, this);
            this.on('disabled', this._pin_on_disabled, this);
        },

        _pin_on_enabled: function () {
            if (this.type == 'circle' || this.type == 'rectangle') {
                this._mouseMarker = L.marker(this._map.getCenter(), {
                    icon: L.divIcon({
                        className: 'leaflet-mouse-marker',
                        iconAnchor: [20, 20],
                        iconSize: [40, 40]
                    }),
                    opacity: 0,
                    zIndexOffset: 1002
                }).addTo(this._map);

                this._map.on('mousemove', this._pin_on_mouse_move, this);
                this._map.on('mousedown', this._pin_on_mouse_down, this);
            }

            var marker = this._mouseMarker;
            if (!this._pinning) {
                this._pinning = new L.Handler.MarkerPin(this._map);
            }

            if (this.options.vertices) {
                this._pinning.options.vertices = this.options.vertices;
            }
            if (this.options.distance) {
                this._pinning.options.distance = this.options.distance;
            }
            this._pinning.enable(marker);

            marker.on('click', this._pin_on_click, this);
            marker.on('mousedown', this._pin_on_click, this);
        },

        _pin_on_mouse_down: function () {
            if (this._pinning._closestCircle) {
                this._startLatLng = this._pinning._closestCircle;
            } else if (this._pinning._closest) {
                this._startLatLng = this._pinning._closest.latlng;
            }
        },

        _pin_on_mouse_move: function (e) {
            var latlng = e.latlng,
                pinLatLng = this._pinning._closest,
                pinCircleLatLng = this._pinning._closestCircle;

            if (pinCircleLatLng) {
                pinLatLng = pinLatLng || {};
                pinLatLng.latlng = pinCircleLatLng;
            }
            if (this._shape) {
                if (this._shape instanceof L.Circle) {
                    this._shape.setRadius(this._startLatLng.distanceTo(pinLatLng ? pinLatLng.latlng : latlng));
                } else if (this._shape instanceof L.Rectangle) {
                    this._shape.setBounds(new L.LatLngBounds(this._startLatLng, pinLatLng ? pinLatLng.latlng : latlng));
                }
            }

            this._mouseMarker.setLatLng(latlng);
        },

        _pin_on_click: function (e) {
            if (this._markers) {
                var markerAmount = this._markers.length,
                    marker = this._markers[markerAmount - 1];
                if (e) {
                    var latlng = e.target._latlng || e.latlng;
                    if (!latlng) {
                        return;
                    }

                    marker._latlng = L.latLng(latlng);
                    marker.update();
                    if (this._poly) {
                        var polyPointsAmount = this._poly._latlngs.length;
                        this._poly._latlngs[polyPointsAmount - 1] = L.latLng(latlng);
                        this._poly.redraw();
                    }
                }
            }
        },

        _pin_on_disabled: function () {
            if (this.type == 'circle' || this.type == 'rectangle') {
                this._map.off('mousemove', this._pin_on_mouse_move, this);
                this._map.off('mousedown', this._pin_on_mouse_down, this);
                this._map.removeLayer(this._mouseMarker);
            }
            delete this._pinning;
        }
    // });
    }

    
    
    L.Draw.Feature.include(L.Draw.Feature.Pin);

    /* 
        This a workaround because `L.Draw.Feature.addInitHook('_pin_initialize')` below does not work 
        The '_pin_initialize' is never called as initHook. 
        Check out https://github.com/Leaflet/Leaflet.draw/issues/857 - "L.Draw.Feature.addInitHook(...) stopped working in 0.4.13"
    */
    //L.Draw.Feature.addInitHook('_pin_initialize');

    // Auto enable pin handler for editing features if pin option is enabled
    L.Edit.Marker.Pin = {
        _pin_initialize: function () {
            this._marker.on('dragstart', this._pin_on_dragstart, this);
            this._marker.on('dragend', this._pin_on_dragend, this);
        },

        _pin_on_dragstart: function (e) {
            if (!this._marker._pinning) {
                this._marker._pinning = new L.Handler.MarkerPin(this._marker._map);
            }
            //this._marker._map.deleteGuideLayers(this._marker);
            this._marker._pinning.enable(this._marker);

        },

        _pin_on_dragend: function (e) {
            this._marker._pinning.disable(this._marker);
            this._marker._map.updateGuideLayer(this._marker._leaflet_id, this._marker.getLatLng());
            delete this._marker._pinning;
        }
    };

    L.Edit.Marker.include(L.Edit.Marker.Pin);
    L.Edit.Marker.addInitHook('_pin_initialize');

    L.Edit.Poly.Pin = {
        _pin_initialize: function () {
            this._poly.on('edit', this._poly_edit, this);
        },

        _poly_edit: function () {
            this._poly._map.updateGuideLayer(this._poly._leaflet_id, this._poly.getLatLngs());
        }
    };

    L.Edit.Poly.include(L.Edit.Poly.Pin);
    L.Edit.Poly.addInitHook('_pin_initialize');

    L.Edit.SimpleShape.Pin = {
        _pin_initialize: function () {
            this._shape.on('edit', this._shape_edit_start, this);
        },

        _shape_edit_start: function () {
            this._map.updateGuideLayer(this._shape._leaflet_id, this._shape.getLatLngs());
        }
    };

    L.Edit.SimpleShape.include(L.Edit.SimpleShape.Pin);
    L.Edit.SimpleShape.addInitHook('_pin_initialize');


    // Custom control to toggle pin
    L.Control.Pin = L.Control.extend({
        options: {
            position: 'topleft'
        },

        onAdd: function (map) {
            this._container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-pin');
            this._container.id = 'leaflet-pin-button';
            this._createButton();
            this._updateButton();
            return this._container;
        },

        _createButton: function () {
            var button = L.DomUtil.create('a', '', this._container);
            L.DomEvent.on(button, 'click', this._togglePin, this);
        },

        _togglePin: function () {
            this._map.togglePin();
            this._updateButton();
        },

        _updateButton: function () {
            var className = 'leaflet-control-pin-enabled';
            if (this._map.options.pin) {
                L.DomUtil.addClass(this._container, className);
            } else {
                L.DomUtil.removeClass(this._container, className);
            }
        }
    });
})();
