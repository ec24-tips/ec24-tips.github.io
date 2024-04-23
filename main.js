class Marker extends L.Marker {
    props;
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
	this.props = props;
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
	this.#thumbnail.innerHTML = `<h3>${this.props.name}</h3>`;
	return this.#thumbnail;
    }

    get card() {
	if (this.#card)
	    return this.#card;
	this.#card = document.createElement('div');
	this.#card.className = 'card';
	this.#card.innerHTML = `<h3>${this.props.name}</h3>${this.props.description}`;
	return this.#card;
    }
}

class MarkerCollection extends Array {
    #tags = new Map();
    #index = new Fuse([], {
	includeScore: true,
	threshold: 0.49,
	keys: ['value'],
    });
    
    tag(key) {
	let markers = this.#tags.get(key);
	if (!markers) {
	    markers = new Array();
	    this.#tags.set(key, markers);
	    this.#index.add({
		type: 'tag',
		value: '#' + key,
	    });
	}
	return markers;
    }

    insert(marker) {
	this.push(marker);
	for (let m of marker.tags)
	    this.tag(m).push(marker);
	this.#index.add({
	    type: 'marker',
	    marker: marker,
	    value: marker.props.name,
	});
    }

    search(pattern) {
	return this.#index.search(pattern)
    }
}

const app = new class {
    #activeMarker;
    #markers = new MarkerCollection();
    
    constructor(container, features) {
	this.container = container;
	this.container.innerHTML = `<div id="map"></div>
<div id="pane">
  <div id="list"></div>
  <div id="result"></div>
</div>`;

	this.map = L.map(this.container.querySelector('#map'))
	    .setView([47.3717315, 8.5420985], 15);
	
	this.list = this.container.querySelector('#list');
	this.result = this.container.querySelector('#result');
	this._open = false;

	L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	    maxZoom: 19,
	    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(this.map);
	L.control.scale().addTo(this.map);

	(async (url) => {
	    const res = await fetch(url);
	    const features = await res.json();
	    
	    L.geoJSON(features, {
		pointToLayer: (point, latlng) => this.addMarker(latlng, point.properties),
	    }).addTo(this.map);
	})(features);
	
	this.map.on('click', (e) => this.close());
	this.container.addEventListener('transitionend',
					(e) => this.map.invalidateSize());

	this.renderList();
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

    renderList() {
	this.list.innerHTML = `
<input id="search" list="search-results" type="search" />
<datalist id="search-results"></datalist>
<div id="active-tags"><div>
<div id="active-markers"><div>
`;
	this.search = this.list.querySelector('#search');
	this.search_results = this.list.querySelector("#search-results");
	this.search.addEventListener('input', (e) => {
	    this.search_results.innerHTML = '';
	    for (let res of this.#markers.search(this.search.value)) {
		this.search_results.innerHTML +=
		    `<option value="${res.item.value}" class="${res.item.type}"></option>`;
	    }
	});
	this.search.addEventListener('change', (e) => console.log(this.search.value));
    }

    renderPane(marker) {
	this.result.replaceChildren(marker.card);
    }
}(document.querySelector('#main'), "features.json");


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
