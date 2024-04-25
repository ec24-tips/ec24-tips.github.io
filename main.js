class Marker extends L.Marker {
    props;
    #thumbnail;
    #card;
    
    static
    catIcons = {
	'food': L.divIcon({
	    html: 'M',
	    className: 'cat-food',
	}),
    }
    
    constructor(latlng, props) {
	super(latlng, {
	    icon: Marker.catIcons[props.category] || L.Icon.Default,
	    alt: props.name,
	});
	this.latlng = latlng;
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
	this.#thumbnail.className = `thumbnail cat-${this.props.category}`;
	this.#thumbnail.innerHTML = `
<h3>${this.props.name}</h3>
<ul class="tags">
  ${ [...this.tags.values()].map((t) => `<li><button>#${t}</button></li>`).join('') }
</ul>`;
	return this.#thumbnail;
    }

    get card() {
	if (this.#card)
	    return this.#card;
	this.#card = document.createElement('div');
	this.#card.className = `card cat-${this.props.category}`;
	this.#card.innerHTML = `
<h3>${this.props.name}</h3>
<ul class="tags">
  ${ [...this.tags.values()].map((t) => `<li><button>#${t}</button></li>`).join('') }
</ul>
<p>${this.props.description}</p>
<p class="recommended-by">Recommended by: ${this.props.recommenders.join()}</p>
`;
	const geo = `geo:${this.latlng.lat},${this.latlng.lng}`;
	this.#card.innerHTML += `<p><a href="${geo}">${geo}</a></p>`;
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

    tags() {
	return this.#tags.keys();
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
    #markers = new MarkerCollection();
    #state;
    
    constructor(container, features) {
	this.#state = {
	    pane_open: false,
	    activeMarker: null,
	    activeTags: [],
	};
	this.DOM = {};
	this.DOM.container = container;
	this.populateDOM();
	this.createMap();
	this.activateSearch();
	this.populateMap(features);
    }

    populateDOM() {
	this.DOM.container.innerHTML = `<div id="map"></div>
<div id="pane">
  <div id="list">
    <input id="search" list="search-results" type="search" />
    <datalist id="search-results"></datalist>
    <div id="active-tags"></div>
    <div id="markers"></div>
  </div>
  <div id="result"></div>
</div>`;

	this.DOM.list = this.DOM.container.querySelector('#list');
	this.DOM.result = this.DOM.container.querySelector('#result');
	this.DOM.search = this.DOM.list.querySelector('#search');
	this.DOM.search_results = this.DOM.list.querySelector("#search-results");
	this.DOM.active_tags = this.DOM.list.querySelector('#active-tags');
	this.DOM.markers = this.DOM.list.querySelector('#markers');
    }

    createMap() {
	this.map = L.map(this.DOM.container.querySelector('#map'))
	    .setView([47.3717315, 8.5420985], 15);
	
	L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	    maxZoom: 19,
	    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
	}).addTo(this.map);
	L.control.scale().addTo(this.map);

	this.map.on('click', (e) => this.close());
	this.DOM.container.addEventListener('transitionend',
					(e) => this.map.invalidateSize());
    }

    activateSearch() {
	this.DOM.search.addEventListener('input', (e) => {
	    this.DOM.search_results.innerHTML = '';
	    for (let res of this.#markers.search(this.DOM.search.value)) {
		this.DOM.search_results.innerHTML +=
		    `<option value="${res.item.value}" class="${res.item.type}"></option>`;
	    }
	});
	this.DOM.search.addEventListener('change', (e) => console.log(this.DOM.search.value));
    }
    
    async populateMap(url) {
	const res = await fetch(url);
	const features = await res.json();
	
	L.geoJSON(features, {
	    pointToLayer: (point, latlng) => this.addMarker(latlng, point.properties),
	}).addTo(this.map);
    }
    
    addMarker(latlng, props) {
	const m = new Marker(latlng, props);
	m.on('click', (e) => this.open(m));
	this.#markers.insert(m);
	this.DOM.markers.appendChild(m.thumbnail);
	return m;
    }

    open(marker) {
	if (marker) {
	    this.DOM.container.classList.add('marker-view');
	    marker.select()
	    this.DOM.result.replaceChildren(marker.card);
	    if (!this.#state.pane_open)
		this.map.once('resize', () => this.map.panTo(marker.getLatLng()));
	    else
		this.map.panTo(marker.getLatLng())
	    this.#state.activeMarker = marker;	
	} else {
	    this.#state.activeMarker?.unselect();
	    this.#state.activeMarker = null;
	}
	
	this.DOM.container.classList.add('open');
	this.#state.pane_open = true;
	history.pushState(this.#state, "", "");
    }

    close() {
	this.DOM.container.classList.remove('open');
	this.#state.pane_open = false;
	
	this.DOM.container.classList.remove('marker-view');
	this.#state.activeMarker?.unselect();
	this.#state.activeMarker = null;
	history.pushState(this.#state, "", "");
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
