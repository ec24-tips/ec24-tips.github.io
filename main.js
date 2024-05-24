function e(strings, ...values) {
    let res = strings[0];
    for (let i = 1; i < strings.length; i++) {
	res += values[i-1].toString()
	    .replaceAll('&', '&amp;')
	    .replaceAll('<', '&lt;')
	    .replaceAll('>', '&gt;');
	res += strings[i];
    }
    return res;
}

/* This class enriches a Leaflet layer by making it interactive */
class Interactor {
    #layer;
    #title;
    #thumbnail;
    #card;

    constructor(layer, uid, props) {
	this.#layer = layer;
	this.uid = uid;
	this.props = props;
	this.tags = new Set(props.tags);
	this.tags.add(props.category);
	this.active = this.hidden = false;
    }

    center(map) {
	if ((this.#layer instanceof L.Marker)
	    || (this.#layer instanceof L.CircleMarker)) {
	    map.panTo(this.#layer.getLatLng());
	} else if (this.#layer instanceof L.Polyline) {
	    map.panTo(this.#layer.getCenter());
	    map.fitBounds(this.#layer.getBounds(), {
		maxZoom: map.getZoom(),
	    });
	}
    }

    get #node() {
	return (this.#layer instanceof L.Marker)
	    ? this.#layer._icon
	    : (this.#layer instanceof L.Polyline)
	    ? this.#layer._path
	    : undefined;
    }

    get geoURI() {
	return (this.#layer instanceof L.Marker)
	    || (this.#layer instanceof L.CircleMarker)
	    ? `geo:${this.#layer._latlng.lat},${this.#layer._latlng.lng}`
	    : undefined;
    }
    
    #length() {
	let len = 0;
	let prev = this.#layer.getLatLngs()[0];
	for (let fix of this.#layer.getLatLngs()) {
	    len += prev.distanceTo(fix);
	    prev = fix;
	}
	return len;
    }

    activate() {
	this.active = true;
	this.#node.classList.add('active');
    }

    deactivate() {
	this.active = false;
	this.#node.classList.remove('active');
    }

    hide() {
	this.hidden = true;
	this.#node.classList.add('hidden');
	this.#thumbnail.classList.add('hidden');
    }

    show() {
	this.hidden = false;
	this.#node.classList.remove('hidden');
	this.#thumbnail.classList.remove('hidden');
    }

    get title() {
	if (this.#title)
	    return this.#title;
	this.#title = document.createElement('h3');
	this.#title.className = `title cat-${this.props.category}`;

	this.#title.innerHTML = e`
<span class="material-symbols-outlined icon cat-${this.props.category}"></span><!--
--><span>${this.props.name}</span>`;
	return this.#title;
    }

    get thumbnail() {
	if (this.#thumbnail)
	    return this.#thumbnail;
	this.#thumbnail = document.createElement('a');
	this.#thumbnail.className = `thumbnail cat-${this.props.category}`;
	this.#thumbnail.href = '#' + this.uid;
	this.#thumbnail.appendChild(this.title.cloneNode(true));
	this.#thumbnail.innerHTML += `
<div class="tags">
  ${ [...this.tags.values()].map((t) => e`<span>#${t}</span></li>`).join('') }
</div>`;
	return this.#thumbnail;
    }

    get card() {
	if (this.#card)
	    return this.#card;
	this.#card = document.createElement('div');
	this.#card.className = `card cat-${this.props.category}`;

	this.#card.innerHTML += `<div class="description">${this.props.description}</div>`;
	
	if (this.props.recommenders)
	    this.#card.innerHTML += e`<div class="recommended-by">${this.props.recommenders.join(', ')}</div>`;

	this.#card.innerHTML += '<hr>';
	    
	if (this.props.links)
	    this.#card.innerHTML += `
<ul class="links">
  ${ this.props.links.map((l) => e`<li><a target="_blank" href="${l}"><span class="material-symbols-outlined">&#xe157;</span>${decodeURIComponent(l)}</a></li>`).join('') }
</ul>`;

	let geo;
	if (geo = this.geoURI) {
	    this.#card.innerHTML += `
<div class="geo-link">
  <a href="${geo}"><span class="material-symbols-outlined">&#xe0c8;</span>${geo}</a>
</div>`;
	}

	return this.#card;
    }
}

/* A small extension to Leaflet's marker with custom icon */
class Marker extends L.Marker {
    props;

    constructor(latlng, feature) {
	super(latlng, {
	    icon:  L.divIcon({
		className: `material-symbols-outlined icon cat-${feature.properties.category}`,
		iconSize: '28px',
		iconAnchor: [14, 14],
	    }),
	    alt: feature.properties.name,
	});
	this.feature = feature;
    }
}

class LayerCollection extends Map {
    #tags = new Map();
    #index = new Fuse([], {
	includeScore: true,
	threshold: 0.49,
	keys: ['value'],
    });
    
    #tagOrCreate(key) {
	let layers = this.#tags.get(key);
	if (!layers) {
	    layers = new Array();
	    this.#tags.set(key, layers);
	    this.#index.add({
		type: 'tag',
		value: '#' + key,
	    });
	}
	return layers;
    }

    tag(key) {
	return this.#tags.get(key);
    }

    tags() {
	return this.#tags.keys();
    }

    insert(layer) {
	this.set(layer.I.uid, layer);
	for (let m of layer.I.tags)
	    this.#tagOrCreate(m).push(layer);
	this.#index.add({
	    type: 'layer',
	    layer: layer,
	    value: layer.I.props.name,
	});
    }

    search(pattern) {
	return this.#index.search(pattern)
    }
}

class Geolocalization extends L.Control {
    static
    states = {
	'I': { name: 'inactive', desc: 'Show my location', },
	'S': { name: 'searching', desc: 'Waiting for location', },
	'A': { name: 'active', desc: 'Geolocating', },
	'T': { name: 'tracking', desc: 'Geolocating', },
	'F': { name: 'failed', desc: 'Cannot get location', },
    }

    #state = 'I';

    constructor(opts){
	super(opts);
    }

    get state() {
	return Geolocalization.states[this.#state];
    }

    advanceState() {
	if (this.#state === 'I' || this.#state === 'F')
	    this._map.locate({ 
		watch: true,
		enableHighAccuracy: true,
	    });
	if (this.#state === 'A')
	    this.panToLocation();
	this.#state = { 
	    'I': 'S',
	    'S': 'S',
	    'A': 'T',
	    'T': 'T',
	    'F': 'S',
	}[this.#state];
    }
    
    icon() {
	return `
<a class="material-symbols-outlined ${this.state.name}" role="button"
   title="${this.state.desc}" aria-label="${this.state.desc}"
   aria-disabled="false"></a>`;
    }

    onAdd(map){
	this.button = document.createElement('div');
	this.button.id = 'locate-button';
	this.button.className = 'leaflet-bar';
	this.button.innerHTML = this.icon();
	this.button.addEventListener('click', (e) => {
	    this.geoLocalizeChange(e);
	    e.stopPropagation();
	});
	this._map.createPane('position');
	this.position = L.circleMarker ([ 0, 0 ], {
	    radius: 10,
	    fill: 'true',
	    fillOpacity: 0.9,
	    className: 'location',
	    pane: 'position',
	});
	this._map.on('locationfound', this.onLocation, this);
	this._map.on('locationerror', this.onError, this);
	this._map.on('movestart', this.onMove, this);
	return this.button;
    }
    
    geoLocalizeChange(e) {
	this.advanceState();
	this.button.innerHTML = this.icon();
    }
    
    onLocation(e) {
	this.position.setLatLng(e.latlng);
	this.position.addTo(this._map);
	if (this.#state !== 'A' && this.#state !== 'T') {
	    this.#state = 'T';
	    this.button.innerHTML = this.icon();
	}
	if (this.#state === 'T')
	    this.panToLocation();
    }

    onError(e) {
	// In case of timeout, keep trying
	if (e.code !== 3) {
	    this.#state = 'F';
	    this._map.stopLocate();
	    this.position.remove();
	    this.button.innerHTML = this.icon();
	}
	console.log("Location error", e);
    }

    onMove(e) {
	// Only cancel tracking on user move
	if (this.#state === 'T') {
	    this.#state = 'A';
	    this.button.innerHTML = this.icon();
	}
    }

    panToLocation() {
	// Use noMoveStart to avoid triggering onMove
	this._map.panTo(this.position.getLatLng(), { noMoveStart: true })
    }
}

const app = new class extends L.Control {
    #layers = new LayerCollection();
    #localization = new Geolocalization({ position: "topleft" });
    #state = {
	pane_open: false,
	activeLayer: null,
	activeTags: [],
    };

    #setState(state) {
	if (state?.pane_open !== undefined)
	    this.#state.pane_open = state.pane_open;
	if (state?.activeTags !== undefined)
	    this.activeTags = state.activeTags;
	if (state?.activeLayer !== undefined)
	    this.activeLayer = this.#layers.get(state.activeLayer) ?? null;
    }

    #setStateFromHash(hash) {
	if (hash.startsWith('#t=')) {
	    this.#setState({
		activeLayer: null,
		activeTags: decodeURIComponent(hash).substr(3).split(','),
		pane_open: true,
	    });
	} else {
	    const uid = hash.substr(1);
	    this.#setState({ activeLayer: uid });
	    this.#state.pane_open = Boolean(this.#state.activeLayer);
	}
    }
    
    constructor(container, features) {
	super({ position: 'topright' });
	this.DOM = {};
	this.DOM.container = container;
	this.populateDOM();
	this.createMap();
	this.activateSearch();
	window.addEventListener('popstate', (e) => this.restoreState(e.state));
	this.populateMap(features).then(() => {
	    if (location.hash)
		this.#setStateFromHash(location.hash);
	    this.reflectState();
	    history.replaceState(this.#state, "");
	});
    }

    populateDOM() {
	this.DOM.container.innerHTML = `<div id="map"></div>
<div id="pane">
  <div id="pane-content">
    <div id="pane-header">
      <div id="back-button" class="show-on-result material-symbols-outlined">&#xe5c4;</div>
      <div id="pane-control">
        <div class="show-on-list">
          <input id="search" list="search-results" type="search" style="display:none" />
          <datalist id="search-results"></datalist>
          <div id="alltags"></div>
        </div>
        <div class="show-on-result">
          <div id="title"></div>
          <div id="tags"></div>
        </div>
      </div>
      <div id="share-button" class="material-symbols-outlined">&#xe80d;</div>
    </div>
    <div id="layers" class="show-on-list"></div>
    <div id="result" class="show-on-result"></div>
  </div>
</div>`;

	this.DOM.search = this.DOM.container.querySelector('#search');
	this.DOM.search_results = this.DOM.container.querySelector("#search-results");
	this.DOM.alltags = this.DOM.container.querySelector('#alltags');
	this.DOM.title = this.DOM.container.querySelector('#title');
	this.DOM.tags = this.DOM.container.querySelector('#tags');
	this.DOM.layers = this.DOM.container.querySelector('#layers');
	this.DOM.result = this.DOM.container.querySelector('#result');
	
	this.DOM.alltags.addEventListener('click', (e) => 
	    e.target.classList.contains('tag') && this.toggleTag(e.target));

	this.DOM.container.querySelector('#back-button')
	    .addEventListener('click', () => this.open(null));

	if (navigator.share) {
	    const share = this.DOM.container.querySelector('#share-button');
	    share.classList.add('supported');
	    share.addEventListener('click',  () => navigator.share({
		'title': this.activeLayer.I.props.name,
		'text': 'Hi! check out this place:',
		'url': new URL('#' + this.activeLayer.I.uid, location),
	    }));
	}
    }

    createMap() {
	this.map = L.map(this.DOM.container.querySelector('#map'))
	    .setView([47.3717315, 8.5420985], 15);
	
	this.addTo(this.map);

	L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	    maxZoom: 19,
	    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> | <img src="assets/github-mark.svg" width="10" height="10"> <a href="https://github.com/ec24-tips/ec24-tips.github.io/">Contribute</a>',
	}).addTo(this.map);
	L.control.scale().addTo(this.map);

	this.map.on('click', (e) => this.close());
	this.DOM.container.addEventListener('transitionend',
					(e) => this.map.invalidateSize());
	this.#localization.addTo(this.map);
    }

    onAdd(map) {
	this.burger = document.createElement('div');
	this.burger.id = 'burger';
	this.burger.className = 'leaflet-bar';
	this.burger.innerHTML = `
<a class="material-symbols-outlined"
   title="Open pane" role="button" aria-label="Open pane"
   aria-disabled="false">
   <span aria-hidden="true">&#xe5d2</span>
</a>`;
	this.burger.addEventListener('click', (e) => {
	    this.toggle();
	    e.stopPropagation();
	});
	return this.burger;
    }

    activateSearch() {
	this.DOM.search.addEventListener('input', (e) => {
	    this.DOM.search_results.innerHTML = '';
	    for (let res of this.#layers.search(this.DOM.search.value)) {
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
	    pointToLayer: (point, latlng) => this.addMarker(latlng, point),
	    onEachFeature: (feature, layer) => {
		if (feature.geometry.type != "Point") {
		    layer.options.className = `cat-${feature.properties.category}`;
		    this.awaken(layer);
		}
	    },
	}).addTo(this.map);
    }
    
    addMarker(latlng, point) {
	return this.awaken(new Marker(latlng, point));
    }

    awaken(layer) {
	layer.I = new Interactor(layer, layer.feature.id, layer.feature.properties);
	layer.options.bubblingMouseEvents = false;
	layer.on('click', (e) => this.open(layer));
	this.#layers.insert(layer);
	this.DOM.layers.appendChild(layer.I.thumbnail);
	return layer;
    }

    get activeLayer() {
	return this.#state.activeLayer && this.#layers.get(this.#state.activeLayer);
    }

    set activeLayer(layer) {
	this.activeLayer?.I.deactivate();
	if (layer) {
	    this.#state.activeLayer = layer.I.uid;
	    layer.I.activate();
	} else {
	    this.#state.activeLayer = null;
	}
    }

    tagFilterClear() {
	for (const [id, l] of this.#layers)
	    l.I.show();
	this.#state.activeTags = [];
    }

    tagFilterAdd(tag) {
	const layers = this.#layers.tag(tag);
	if (layers) {
	    if (this.#state.activeTags.length == 0)
		for (const [id, l] of this.#layers)
		    l.I.hide();
	    for (const l of layers)
		l.I.show();
	    this.#state.activeTags.push(tag);
	}
    }

    tagFilterRemove(tag) {
	this.activeTags = this.#state.activeTags.filter((t) => t != tag);
    }

    get activeTags() {
	return new Array(this.#state.activeTags);
    }

    set activeTags(tags) {
	this.tagFilterClear()
	for (const t of tags)
	    this.tagFilterAdd(t);
    }

    open(layer) {
	this.activeLayer = layer;
	this.#state.pane_open = true;
	this.reflectState();
	this.saveState();
    }

    toggleTag(tag) {
	if (!tag.classList.contains('inactive')
	    && this.#state.activeTags.length > 0)
	    this.tagFilterRemove(tag.dataset['tag']);
	else
	    this.tagFilterAdd(tag.dataset['tag']);
	this.reflectState();
	this.saveState();
    }

    close() {
	this.activeLayer = null;
	this.#state.pane_open = false;
	this.reflectState();
	this.saveState();
    }

    toggle() {
	this.#state.pane_open ? this.close() : this.open(null);
    }

    // Call after a state change to update UI
    reflectState() {
	const wasClosed = !this.DOM.container.classList.contains('open');
	if (this.DOM.container.classList.toggle('open', this.#state.pane_open)) {
	    if (this.activeLayer) {
		this.DOM.title.replaceChildren(this.activeLayer.I.title)
		this.DOM.tags.replaceChildren();
		for (const t of this.activeLayer.I.tags) {
		    this.DOM.tags.innerHTML += `<a href="#t=${t}">#${t}</a>`;
		}
		this.DOM.result.replaceChildren(this.activeLayer.I.card);
		const pan = () => this.activeLayer.I.center(this.map);
		wasClosed ? this.map.once('resize', pan) : pan();
		this.DOM.container.classList.remove('list-view');
	    } else {
		this.DOM.container.classList.add('list-view');
		this.DOM.alltags.replaceChildren();
		const nofilter = this.#state.activeTags.length == 0;
		for (const t of this.#layers.tags()) {
		    const cls = nofilter || this.#state.activeTags.includes(t) ? '' : 'inactive';
		    this.DOM.alltags.innerHTML += `
<span data-tag="${t}" class="tag ${cls}">#${t}</span>`;
		}
		console.log(nofilter);
		this.DOM.alltags.classList.toggle('all', nofilter);
	    }
	}
    }

    // Save state in history
    saveState() {
	if (JSON.stringify(this.#state) != JSON.stringify(history.state)) {
	    const hash = this.#state.pane_open
		  ? this.#state.activeLayer
		  || `t=${this.#state.activeTags.join()}`
		  : '';
	    history.pushState(this.#state, '', '#' + hash);
	}
    }

    // Restore to a previous/new state
    restoreState(state) {
	if (state === null) {
	    // when hash changes a null state is popped
	    this.#setStateFromHash(location.hash);
	    this.reflectState();
	} else if (JSON.stringify(this.#state) != JSON.stringify(state)) {
	    this.#setState(state);
	    this.reflectState();
	}
    }
}(document.querySelector('#main'), "features.json");
