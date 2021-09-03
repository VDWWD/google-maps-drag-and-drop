//
//
// VDWWD Google Maps Drag & Drop
//
// https://www.vanderwaal.eu
// https://jqueryui.com
// https://developers.google.com/maps/documentation
//
//

var map;
var overlay;
var poiIconWidth = 32;
var poiIconHeight = 42;
var zIndex = 100;
var poiMarkerArry = [];
var binDimensions;
var binXoffset = 10;
var binYoffset = 25;
var zoomLevel = 7;

var $map_results;
var $map_dragdrop;
var $map_iconcounter;

//the icons
var poiData = [{
    id: 10,
    name: 'Icon #1',
    icon: '/files/icon_1.png'
}, {
    id: 20,
    name: 'Icon #2',
    icon: '/files/icon_2.png'
}, {
    id: 300,
    name: 'Icon #3',
    icon: '/files/icon_3.png'
}, {
    id: 400,
    name: 'Icon #4',
    icon: '/files/icon_4.png'
}, {
    id: 5000,
    name: 'Icon #5',
    icon: '/files/icon_5.png'
}];


//timeout because jquery script is loaded later that this js file on this page
setTimeout(function () {
    $map_results = $('#map_results');
    $map_dragdrop = $('#map_dragdrop');
    binDimensions = $('#map_recyclebin').height();
    $map_iconcounter = $('#map_iconcounter');

    $('#map_reset_button').bind('click', function () {
        resetPoiMap();
    });

    $('#map_load_button').bind('click', function () {
        loadJsonData();
    });

    initializePoiMap(52.52000, 5.28662);
}, 50);


//create the map
function initializePoiMap(lat, lng) {
    //coord for the center of the map
    var startpos = new google.maps.LatLng(lat, lng);

    //map options
    var options = {
        zoom: zoomLevel,
        center: startpos,
        zoomControl: true,
        mapTypeControl: false,
        scaleControl: false,
        streetViewControl: false,
        rotateControl: false,
        fullscreenControl: false,
        mapTypeId: google.maps.MapTypeId.TERRAIN
    };

    //start the map
    map = new google.maps.Map(document.getElementById('map_dragdrop'), options);

    //add an overlay
    overlay = new google.maps.OverlayView();
    overlay.draw = function () { };
    overlay.setMap(map);

    generatePoiMarkerlist();
    loadJsonData();

    //for netherlands only
    buildProvinces();
    buildIslands();
}


//add the icons that can be dragged to the html page and attach the drag function
function generatePoiMarkerlist() {
    //add the icons
    for (var i = 0; i < poiData.length; i++) {
        var content = '<div>' + poiData[i].name + '<br><img data-id="' + poiData[i].id + '" data-index="' + i + '" class="map_icon" src = "' + poiData[i].icon + '" /></div > ';
        $('#map_icon_container').append(content);
    }

    var $icons = $('.map_icon');

    //attach the drag event
    $icons.draggable({
        stop: function (e) {
            dragIn(e, this, $(this).data('index'));
        }
    });

    //attach the double click event
    $icons.dblclick(function () {
        addIconToMap([map.getCenter().lat(), map.getCenter().lng()], this, $(this).data('index'));
    });

    //make the double click working on touch devices
    var tap = 0;
    $icons.on('touchend', function () {
        var now = new Date().getTime();
        var ms = now - tap;

        if (ms > 0 && ms < 500) {
            addIconToMap([map.getCenter().lat(), map.getCenter().lng()], this, $(this).data('index'));
        }

        tap = new Date().getTime();
    });
}


//generate a marker on the map
function generatePoiMarker(poi) {
    var marker = new google.maps.Marker({
        position: new google.maps.LatLng(poi.mapPosition[0], poi.mapPosition[1]),
        map: map,
        draggable: true,
        icon: {
            url: poi.icon,
            size: google.maps.Size(poiIconWidth, poiIconHeight),
            target: google.maps.Point(poiIconWidth / 2, poiIconHeight / 2),
            origin: google.maps.Point(poiIconWidth / 2, poiIconHeight / 2)
        },
        title: poi.name,
        type: poi.id,
        zIndex: zIndex
    });

    marker.idnr = poiMarkerArry.length;
    poiMarkerArry.push(marker);
    zIndex++;
    updatePoiCoords();

    //add the mouse over event to put an icon always on top on hover
    google.maps.event.addListener(marker, 'mouseover', function () {
        this.setZIndex(zIndex);
        zIndex++;
    });

    //drag end event to update the marker data
    google.maps.event.addListener(marker, 'dragstart', function () {

        //set the map drag to false, otherwise the maps starts scrolling when you get to the edges
        map.setOptions({ draggable: false });
    });

    //drag end event to update the marker data
    google.maps.event.addListener(marker, 'dragend', function (e) {
        //enable map scrolling again
        map.setOptions({ draggable: true });

        var pixelPosition = getPixelPosition(this);

        //check if the icon is inside the recycle bin
        if (pixelPosition.x < binDimensions + binXoffset && pixelPosition.x > binXoffset && pixelPosition.y > ($map_dragdrop.height() - binDimensions) - binYoffset && pixelPosition.y < $map_dragdrop.height() - binYoffset) {
            dragOut(e, this);
        } else {
            poiMarkerArry[this.idnr].position = e.latLng;
            updatePoiCoords();
        }
    });
}


//update the coord after dragging an icon
function updatePoiCoords() {
    var poiArr = [];
    for (var i = 0; i < poiMarkerArry.length; i++) {
        if (poiMarkerArry[i] !== null) {
            var poiMarker = {
                lat: poiMarkerArry[i].position.lat(),
                lng: poiMarkerArry[i].position.lng(),
                type: poiMarkerArry[i].type
            };

            poiArr.push(poiMarker);
        }
    }

    //make a json
    var json = JSON.stringify(poiArr);

    //not really needed, just used to neatly display the output inside the textarea
    json = json.replace('[', '[\n    ').replace(/},{/g, '},\n    {').replace(']', '\n]');

    //put it in an input
    $map_results.val(json);

    //show counter
    $map_iconcounter.html(poiArr.length);
}


//translate the map coordinates into pixels
function getPixelPosition(marker) {
    var scale = Math.pow(2, map.getZoom());
    var nw = new google.maps.LatLng(
        map.getBounds().getNorthEast().lat(),
        map.getBounds().getSouthWest().lng()
    );

    var worldCoordinateNW = map.getProjection().fromLatLngToPoint(nw);
    var worldCoordinate = map.getProjection().fromLatLngToPoint(marker.getPosition());
    var pixelOffset = new google.maps.Point(
        Math.floor((worldCoordinate.x - worldCoordinateNW.x) * scale),
        Math.floor((worldCoordinate.y - worldCoordinateNW.y) * scale)
    );

    return {
        x: pixelOffset.x,
        y: pixelOffset.y,
        right: $map_dragdrop.width() - pixelOffset.x,
        bottom: $map_dragdrop.height() - pixelOffset.y
    };
}


//an icon is dragged
function dragIn(e, icon, index) {
    var x = e.pageX - $map_dragdrop.offset().left;
    var y = e.pageY - $map_dragdrop.offset().top + 25;

    //check if the drag is on the map
    if (x > 0 && x < $map_dragdrop.width() && y > 0) {
        var point = new google.maps.Point(x, y);
        var position = overlay.getProjection().fromContainerPixelToLatLng(point);

        addIconToMap([position.lat(), position.lng()], icon, index);
    }
}


//place the icon on the map
function addIconToMap(position, icon, index) {
    var poi = {
        mapPosition: position,
        icon: poiData[index].icon,
        name: poiData[index].name,
        id: poiData[index].id
    };

    generatePoiMarker(poi);

    $(icon).attr('style', 'position: relative; left: 0px; top: 0px');
}


//an icon is stopped dragging
function dragOut(e, marker) {
    poiMarkerArry[marker.idnr] = null;
    marker.setMap(null);
    updatePoiCoords();
}


//load the json data from the textbox
function loadJsonData() {
    //if there are existings icons, add them to the map
    if ($map_results.val() === '')
        return;

    //here the data comes from a textarea. but could be from any other source
    var data = $.parseJSON($map_results.val());

    //reset map also
    resetPoiMap();

    //loop all poi's
    for (var i = 0; i < data.length; i++) {

        //find the right marker based on id
        for (var j = 0; j < poiData.length; j++) {

            //if the item matches the id of the poi icon
            if (poiData[j].id === data[i].type) {

                var poi = {
                    mapPosition: [data[i].lat, data[i].lng],
                    icon: poiData[j].icon,
                    name: poiData[j].name,
                    id: poiData[j].id
                };

                generatePoiMarker(poi);
            }
        }
    }
}


//reset the map data
function resetPoiMap() {
    for (var i = 0; i < poiMarkerArry.length; i++) {
        poiMarkerArry[i].setMap(null);
    }

    $map_iconcounter.html('0');
    $map_results.val('');
    poiMarkerArry = [];

    //if you use the dutch province polygons
    for (var i = 0; i < polygonArr.length; i++) {
        polygonArr[i].setMap(null);
    }

    polygonArr = [];
}


//below code specifically for The Netherlands

var polygonArr = [];

//build the dutch province polygons
function buildProvinces() {
    for (var i = 0; i < provincesNL.length; i++) {
        var polygon = new google.maps.Polygon({
            paths: provincesNL[i],
            strokeColor: "#000000",
            strokeOpacity: 1.0,
            strokeWeight: 2,
            fillColor: provinceColors[i],
            fillOpacity: 0.2,
            clickable: true
        });

        polygonArr.push(polygon);

        polygon.setMap(map);
        attachToPolygon(polygon, provinceCenters[i]);
    }
}


//build the dutch island polygons
function buildIslands() {
    for (var i = 0; i < islandsNL.length; i++) {
        var polygon = new google.maps.Polygon({
            paths: islandsNL[i],
            strokeColor: "#000000",
            strokeOpacity: 1.0,
            strokeWeight: 2,
            fillColor: islandColors[i],
            fillOpacity: 0.2,
            clickable: true
        });

        polygonArr.push(polygon);

        polygon.setMap(map);
        attachToPolygon(polygon, islandCenters[i]);
    }
}


//add a function to the polygon that centers on the province centre on clicking
function attachToPolygon(poly, centerPoint) {

    //zoom and center to province
    google.maps.event.addListener(poly, 'click', function () {
        map.panTo(centerPoint);
        map.setZoom(9);
    });

    //zoom out the province to original zoom level
    google.maps.event.addListener(poly, 'rightclick', function () {
        map.setZoom(zoomLevel);
        map.panTo(dutchCenterPoint);
    });
}