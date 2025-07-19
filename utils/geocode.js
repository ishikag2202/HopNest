const mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
require('dotenv').config();

const mapBoxToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapBoxToken });

/**
 * Fetches [longitude, latitude] for a given location and country using Mapbox Geocoding.
 * @param {string} location - City or place name.
 * @param {string} country - Country name.
 * @returns {Promise<number[]>} [longitude, latitude]
 */
async function geocodeLocation(location, country) {
    try {
        const query = `${location}, ${country}`;
        const response = await geocodingClient.forwardGeocode({
            query: query,
            limit: 1
        }).send();

        const match = response.body.features[0];
        if (!match) {
            console.error(`No geocoding result for: ${query}. Using fallback coordinates.`);
            return [0, 0]; // fallback to avoid seed script failure
        }

        return match.geometry.coordinates; // [lng, lat]
    } catch (error) {
        console.error(`Error geocoding "${location}, ${country}":`, error);
        return [0, 0]; // fallback on error
    }
}

module.exports = geocodeLocation;
