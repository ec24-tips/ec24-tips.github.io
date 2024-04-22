const map = L.map('map').setView([47.3717315, 8.5420985], 15);
const main = document.querySelector('#main');

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
L.control.scale().addTo(map);

class Marker extends L.Marker {
    #props;
    #thumbnail;
    #card;
    
    static
    catIcons = {
	'food': L.divIcon({
	    html: 'M',
	    className: 'food',
	}),
    }
    
    constructor(latlng, props) {
	super(latlng, {
	    icon: Marker.catIcons[props.category] || L.Icon.Default,
	    alt: props.name,
	});
	this.#props = props;
	this.tags = new Set(props.tags);
	this.tags.add(props.category);
	this.selected = this.hidden = false;
    }
    
    select() {
	this.selected = true;
	this._icon.classList.add('selected');
    }

    unselect() {
	this.selected = false;
	this._icon.classList.remove('selected');
    }

    hide() {
	this.hidden = true;
	this._icon.classList.add('hidden');
	this.#thumbnail.classList.add('hidden');
    }

    show() {
	this.hidden = false;
	this._icon.classList.remove('hidden');
	this.#thumbnail.classList.remove('hidden');
    }

    get thumbnail() {
	if (this.#thumbnail)
	    return this.#thumbnail;
	this.#thumbnail = document.createElement('div');
	this.#thumbnail.className = 'thumbnail';
	this.#thumbnail.innerHTML = `<h3>${this.#props.name}</h3>`;
	return this.#thumbnail;
    }

    get card() {
	if (this.#card)
	    return this.#card;
	this.#card = document.createElement('div');
	this.#card.className = 'card';
	this.#card.innerHTML = `<h3>${this.#props.name}</h3>${this.#props.description}`;
	return this.#card;
    }
}

class MarkerCollection extends Array {
    #tags = new Map();
    
    tag(key) {
	let markers = this.#tags.get(key);
	if (!markers) {
	    markers = new Array();
	    this.#tags.set(key, markers);
	}
	return markers;
    }

    insert(marker) {
	this.push(marker);
	for (let m of marker.tags)
	    this.tag(m).push(marker);
    }
}

map._drawer = new class {
    #activeMarker;
    #markers = new MarkerCollection();
    
    constructor(container, map) {
	this.container = container;
	this.map = map;
	this.pane = this.container.querySelector('#pane');
	this._open = false;
	
	map.on('click', (e) => this.close());
	this.container.addEventListener('transitionend',
					(e) => this.map.invalidateSize());
    }
    
    addMarker(latlng, props) {
	const m = new Marker(latlng, props);
	m.on('click', (e) => this.open(m));
	this.#markers.insert(m);
	return m;
    }

    open(marker) {
	if (marker) {
	    if (this.#activeMarker)
		this.#activeMarker.unselect()
	    marker.select()
	    this.renderPane(marker);
	    if (!this._open)
		this.map.once('resize', () => this.map.panTo(marker.getLatLng()));
	    else
		this.map.panTo(marker.getLatLng())
	    this.#activeMarker = marker;	
	}
	
	this.container.classList.add('open');
	this._open = true;
    }

    close() {
	this.container.classList.remove('open');
	this._open = false;
	
	if (this.#activeMarker)
	    this.#activeMarker.unselect();
	this.#activeMarker = null;
    }

    hideAll() {
	this.#markers.forEach((m) => m.hide());
    }

    showAll() {
	this.#markers.forEach((m) => m.show());
    }
    
    hide(tag) {
	this.#markers.tag(tag).forEach((m) => m.hide());
    }
    
    show(tag) {
	this.#markers.tag(tag).forEach((m) => m.show());	
    }

    renderPane(marker) {
	this.pane.replaceChildren(marker.card);
    }

    render() {
	
    }
}(main, map);

(async function() {
    const res = await fetch("features.json");
    const features = await res.json();

    L.geoJSON(features, {
	pointToLayer: (point, latlng) => map._drawer.addMarker(latlng, point.properties),
    }).addTo(map);
})();


/* Geolocation */
/*
let mypos;
const posicon = L.icon({
    iconUrl: 'loc.webp',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});
let locateBtn = L.easyButton({
    states: [{
	stateName: 'inactive',
	icon: '<span>⨂</span>',
	onClick: (btn, map) => {
	    map.locate({
		watch: true,
		enableHighAccuracy: true,
	    });
	    btn.state('searching');
	},
    }, {
	stateName: 'searching',
	icon: '<span>C</span>',
    }, {
	stateName: 'active',
	icon: '<span>⨁</span>',
	onClick: (btn, map) => {
	    map.stopLocate();
	    if (mypos)
		mypos.remove();
	    btn.state('inactive');
	},
    }]
}).addTo(map);

map.on('locationfound', (e) => {
    if (mypos)
	mypos.remove();
    mypos = L.marker(e.latlng, { icon: posicon }).addTo(map);
    locateBtn.state('active');
});
map.on('locationerror', (e) => {
    if (mypos)
	mypos.remove();
    locateBtn.state('inactive');
    console.log('Location error:', e);
});
*/
