mapboxgl.accessToken = mapToken;

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: listing.geometry.coordinates, // dynamic now!
    zoom: 8
});

const marker = new mapboxgl.Marker({color: 'red'})
    .setLngLat(listing.geometry.coordinates)
    .setPopup(new mapboxgl.Popup({offset:25})
    .setHTML(`<h4>${listing.title}</h4><p>Exact location will be provided after booking!</p>`)) 
    .addTo(map);

