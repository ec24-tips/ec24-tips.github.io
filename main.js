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
	this.uid = this.props.uid;
	this.tags = new Set(props.tags);
	this.tags.add(props.category);
	this.active = this.hidden = false;
    }
    
    activate() {
	this.active = true;
	this._icon.classList.add('active');
    }

    deactivate() {
	this.active = false;
	this._icon.classList.remove('active');
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

class MarkerCollection extends Map {
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
	this.set(marker.uid, marker);
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
    #state = {
	pane_open: false,
	activeMarker: null,
	activeTags: [],
    };

    #setState(state) {
	if (state?.pane_open !== undefined)
	    this.#state.pane_open = state.pane_open;
	if (state?.activeTags !== undefined)
	    this.#state.activeTags = state.activeTags;
	if (state?.activeMarker !== undefined)
	    this.activeMarker = this.#markers.get(state.activeMarker) ?? null;
    }

    #setStateFromUID(uid) {
	this.#setState({ activeMarker: uid });
	this.#state.pane_open = Boolean(this.#state.activeMarker);
    }
    
    constructor(container, features) {
	this.DOM = {};
	this.DOM.container = container;
	this.populateDOM();
	this.createMap();
	this.activateSearch();
	window.addEventListener('popstate', (e) => this.restoreState(e.state));
	this.populateMap(features).then(() => {
	    if (location.hash)
		this.#setStateFromUID(location.hash.substr(1));
	    this.reflectState();
	    history.replaceState(this.#state, "");
	});
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

    get activeMarker() {
	return this.#state.activeMarker && this.#markers.get(this.#state.activeMarker);
    }

    set activeMarker(marker) {
	this.activeMarker?.deactivate();
	if (marker) {
	    this.#state.activeMarker = marker.uid;
	    marker.activate();
	} else {
	    this.#state.activeMarker = null;
	}
    }

    open(marker) {
	this.activeMarker = marker;
	this.#state.pane_open = true;
	this.reflectState();
	this.saveState();
    }

    close() {
	this.activeMarker = null;
	this.#state.pane_open = false;
	this.reflectState();
	this.saveState();
    }

    // Call after a state change to update UI
    reflectState() {
	const wasClosed = !this.DOM.container.classList.contains('open');
	if (this.DOM.container.classList.toggle('open', this.#state.pane_open)) {
	    if (this.activeMarker) {
		this.DOM.result.replaceChildren(this.activeMarker.card);
		const pan = () => this.map.panTo(this.activeMarker.getLatLng())
		wasClosed ? this.map.once('resize', pan) : pan();
		this.DOM.container.classList.add('marker-view');
	    } else {
		this.DOM.container.classList.remove('marker-view');
	    }
	}
    }

    // Save state in history
    saveState() {
	if (JSON.stringify(this.#state) != JSON.stringify(history.state)) {
	    history.pushState(this.#state, '', '#' + (this.#state.activeMarker || ''));
	}
    }

    // Restore to a previous state
    restoreState(state) {
	if (state === null) {
	    // when hash changes a null state is popped
	    this.#setStateFromUID(location.hash.substr(1));
	    this.reflectState();
	} else if (JSON.stringify(this.#state) != JSON.stringify(state)) {
	    this.#setState(state);
	    this.reflectState();
	}
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
