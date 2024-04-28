# Eurocrypt 2024 Local Tips

An interactive map with local tips for the crowd at [Eurocrypt 2024](https://eurocrypt.iacr.org/2024/) in Zürich: restaurants, sightseeing, conference sites... Browse the map at <https://ec24-tips.github.io/>.

Web-based, mobile-first, built upon [Leaflet.js](https://leafletjs.com/) and [Fuse.js](https://www.fusejs.io/). Maps tiles by [OpenStreetMap](https://www.openstreetmap.org/). Made with ❤️ by your local cryptographers.

## Contributing

Please consider adding your local tips to the map, it's easy!

If you just want to add one marker, open an issue using the [New location template](https://github.com/ec24-tips/ec24-tips.github.io/issues/new?assignees=&labels=&projects=&template=new-location.md&title=%5BNEW+LOCATION%5D).

The best way to add multiple markers and other features is by making a pull-request. Geograhic data must be formatted in GeoJSON format and saved to a file in the [`features`](features) folder with a `.geojson` extension. The simplest way to create such a file is by using <https://geojson.io/>. The metadata for each feature is stored in the `properties` object, here are the supported properties:

| property | required | type | notes
|-|:-:|-|-|
| `name` | * | string | The name of the place. Use an official name if it has one.
| `category` | * | string | Must be one of the supported categories, see below.
| `tags` | * | list of strings | Possibly empty.
| `description` | * | html string | What is this place? Why do you like it? ... Please no injection attacks!
| `recommenders` | | list of strings | A list of people (names, nicknames, etc.) who endorse this tip. Empty = Anonymous.
| `links` | | list of URLs | A list of URLs related to the place.

On <https://geojson.io/> you can edit the properties either by clicking on the marker or by editing the JSON directly.

### Categories and tags

The category of a feature determines the icon that is shown on the map. The list of supported categories is

| category | notes
|-|-|
|`restaurant`|A place that primarily functions as a restaurant
|`bar`|A place that primarily functions as a var
|`sightseeing`|A monument, park, etc.
|`hike`|A hike or a start/middle/end point for a hike
|`viewpoint`|A scenic viewpoint
|`conference`|buildings where the conference takes place

Any other category receives a default "question mark" icon. 

On top of the category, you can use tags. This is a list of keywords that further describe the place. E.g., a restaurant may have the tags `vegan` and `indian` to indicate that it serve an Indian-inspired vegan-friendly cuisine. The category is automatically added to the list of tags, so there's no need to repeat it. There is no closed list of tags, feel free to use as many as necessary, but try to be consistent with those that others have used.

Some places may belong to more than one category. E.g., a bar may also serve food and qualify as a restaurant, or a viewpoint may be part of a hike. Use the category that best describes the main function of the place, and use the tags to describe the rest.


## Other ways to contribute

If you're knowledgeable about web programming, please consider joining the team and helping improve the application.

Even if you're not an expert, you can help by testing the app on as many devices and browsers you can and reporting any issues you find.
