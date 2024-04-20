const map = L.map('map').setView([47.3717315, 8.5420985], 15);
const main = document.querySelector('#main');
const pane = document.querySelector('#pane');

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);
L.control.scale().addTo(map);

const catIcons = {
    'food': L.divIcon({
	html: 'M',
	className: 'food',
    }),
};

(async function() {
    const res = await fetch("features.json");
    const features = await res.json();

    L.geoJSON(features, {
	pointToLayer: (point, latlng) => {
	    const p = point.properties;
	    const m = L.marker(latlng, {
		icon: catIcons[p.category] || L.Icon.Default,
		alt: p.name,
	    });
	    m.on('click', (e) => {
		main.classList.add('open');
		pane.innerHTML = `<h3>${p.name}</h3>${p.description}`;
		map.once('resize', () => map.panTo(m.getLatLng()));
	    });
	    return m;
	}
    }).addTo(map);
})();

map.on('click', (e) => {
    main.classList.remove('open');
});
main.addEventListener('transitionend', (e) => {
    map.invalidateSize();    
});

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
