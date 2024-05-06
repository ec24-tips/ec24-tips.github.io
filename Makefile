features.json: features/*geojson
	python make.py

run: features.json
	xdg-open http://localhost:8000/
	python -m http.server
