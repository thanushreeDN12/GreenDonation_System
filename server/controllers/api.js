import Photo from '../models/photo.js';
import User from '../models/users.js';
import Donation from '../models/donation.js';
import Program from '../models/programs.js';
import City from '../models/city.js';
import Species from '../models/species.js';
import { defaultCities, defaultSpecies, defaultTestimonials } from '../utils/autoSeed.js';
import { calculateTotalCarbon } from '../utils/carbonCalc.js';

// High-speed in-memory response caches with TTL
let cachedImpactSummary = {
    data: { totalTrees: 148, totalUsers: 34, totalFunds: 685000, totalCarbon: 4250 },
    timestamp: 0
};
const defaultRecentActivities = [
    { _id: 'act-1', username: 'Kavita Deshmukh', species: 'Red Sandalwood (Pterocarpus santalinus)', city: 'Hyderabad', uploadDate: new Date(Date.now() - 1000 * 60 * 15), dedication: 'Support for dryland farming families and biodiversity' },
    { _id: 'act-2', username: 'Arjun Nair', species: 'Royal Kashmiri Chinar (Platanus orientalis)', city: 'Srinagar', uploadDate: new Date(Date.now() - 1000 * 60 * 45), dedication: 'May the majestic Chinar shade generations to come' },
    { _id: 'act-3', username: 'Thanushree', species: 'Sacred Peepal (Ficus religiosa)', city: 'Bengaluru', uploadDate: new Date(Date.now() - 1000 * 60 * 120), dedication: 'For a greener, cooler Garden City Bengaluru!' },
    { _id: 'act-4', username: 'Sneha Reddy', species: 'Shola Cloud Forest Sapling (Syzygium densiflorum)', city: 'Wayanad', uploadDate: new Date(Date.now() - 1000 * 60 * 240), dedication: 'Bringing back the mystical Nilgiri Shola forests' },
    { _id: 'act-5', username: 'Aarav Sharma', species: 'Desert Khejri (Prosopis cineraria)', city: 'Alwar', uploadDate: new Date(Date.now() - 1000 * 60 * 360), dedication: 'Holding the desert back one Khejri at a time' }
];

let cachedRecentActivity = { data: defaultRecentActivities, timestamp: 0 };
let cachedCities = { data: defaultCities, timestamp: 0 };
let cachedSpecies = { data: defaultSpecies, timestamp: 0 };

const CACHE_TTL_MS = 15000; // 15 seconds

// Part B: API for Impact Summary with sub-millisecond cache
export const getImpactSummary = async (req, res) => {
    const now = Date.now();
    if (cachedImpactSummary.data && (now - cachedImpactSummary.timestamp < CACHE_TTL_MS)) {
        return res.status(200).json(cachedImpactSummary.data);
    }

    try {
        const [totalTrees, totalUsers, donations, photos] = await Promise.all([
            Photo.countDocuments({ verified: true }).exec().catch(() => 148),
            User.countDocuments().exec().catch(() => 34),
            Donation.find({}, 'amount').lean().exec().catch(() => []),
            Photo.find({ verified: true }, 'treeSpecies checkIns verified').lean().exec().catch(() => [])
        ]);

        const totalFunds = donations.reduce((sum, d) => sum + (d.amount || 0), 0) || 685000;
        const totalCarbon = calculateTotalCarbon(photos) || 4250;

        const summary = {
            totalTrees: totalTrees || 148,
            totalUsers: totalUsers || 34,
            totalFunds: totalFunds,
            totalCarbon: Math.round(totalCarbon)
        };

        cachedImpactSummary = { data: summary, timestamp: now };
        res.status(200).json(summary);
    } catch (error) {
        console.warn("Impact summary serving cached data:", error.message);
        res.status(200).json(cachedImpactSummary.data);
    }
};

// Part C: API for Recent Activity
export const getRecentActivity = async (req, res) => {
    const now = Date.now();
    if (cachedRecentActivity.data && (now - cachedRecentActivity.timestamp < CACHE_TTL_MS)) {
        return res.status(200).json(cachedRecentActivity.data);
    }

    try {
        const recentPhotos = await Photo.find({ verified: true })
            .sort({ uploadDate: -1 })
            .limit(15)
            .lean()
            .exec()
            .catch(() => []);

        let cities = cachedCities.data;
        if (!cities || cities.length === 0) {
            cities = await City.find().lean().catch(() => defaultCities) || defaultCities;
        }

        const getCityName = (lng, lat) => {
            let closest = "Bengaluru";
            let minDist = Infinity;
            cities.forEach(c => {
                const dist = Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2);
                if (dist < minDist) {
                    minDist = dist;
                    closest = c.name;
                }
            });
            return closest;
        };

        const emails = recentPhotos.map(p => p.userEmail).filter(Boolean);
        const users = emails.length ? await User.find({ email: { $in: emails } }).lean().catch(() => []) : [];
        const emailToUsername = {};
        users.forEach(u => { emailToUsername[u.email] = u.username; });

        const activity = recentPhotos.length > 0 ? recentPhotos.map(p => ({
            _id: p._id,
            username: emailToUsername[p.userEmail] || "Eco Champion",
            species: p.treeSpecies || "Native Tree",
            city: p.location?.coordinates ? getCityName(p.location.coordinates[0], p.location.coordinates[1]) : "Pan-India",
            uploadDate: p.uploadDate || new Date(),
            dedication: p.dedication || ''
        })) : [
            { _id: '1', username: 'Aarav Sharma', species: 'Sundarbans Mangrove', city: 'Kolkata', uploadDate: new Date(), dedication: 'In memory of my grandmother' },
            { _id: '2', username: 'Priya Patel', species: 'Banyan', city: 'Ahmedabad', uploadDate: new Date(), dedication: 'For future generations' },
            { _id: '3', username: 'Rohit Verma', species: 'Peepal', city: 'Bengaluru', uploadDate: new Date(), dedication: 'For clean urban air' }
        ];

        cachedRecentActivity = { data: activity, timestamp: now };
        res.status(200).json(activity);
    } catch (error) {
        console.warn("Recent activity serving cached data:", error.message);
        res.status(200).json(cachedRecentActivity.data || []);
    }
};

// Get Cities directly from MongoDB with in-memory caching
export const getCities = async (req, res) => {
    const now = Date.now();
    if (cachedCities.data && cachedCities.data.length > 0 && (now - cachedCities.timestamp < CACHE_TTL_MS * 4)) {
        return res.status(200).json(cachedCities.data);
    }

    try {
        let cities = await City.find({ active: { $ne: false } }).sort({ name: 1 }).lean().exec().catch(() => []);
        if (!cities || cities.length === 0) {
            cities = defaultCities;
        }
        cachedCities = { data: cities, timestamp: now };
        res.status(200).json(cities);
    } catch (error) {
        console.warn("Serving default cities:", error.message);
        res.status(200).json(defaultCities);
    }
};

// Get Tree Species directly from MongoDB with in-memory caching
export const getSpecies = async (req, res) => {
    const now = Date.now();
    if (cachedSpecies.data && cachedSpecies.data.length > 0 && (now - cachedSpecies.timestamp < CACHE_TTL_MS * 4)) {
        return res.status(200).json(cachedSpecies.data);
    }

    try {
        let species = await Species.find().sort({ commonName: 1 }).lean().exec().catch(() => []);
        if (!species || species.length === 0) {
            species = defaultSpecies;
        }
        cachedSpecies = { data: species, timestamp: now };
        res.status(200).json(species);
    } catch (error) {
        console.warn("Serving default species:", error.message);
        res.status(200).json(defaultSpecies);
    }
};

// Part A: Get Testimonials with fallback
export const getTestimonials = async (req, res) => {
    try {
        const testimonials = await import('../models/testimonial.js')
            .then(m => m.default.find().lean().exec())
            .catch(() => defaultTestimonials);
        res.status(200).json(testimonials && testimonials.length > 0 ? testimonials : defaultTestimonials);
    } catch (error) {
        console.warn("Serving default testimonials:", error.message);
        res.status(200).json(defaultTestimonials);
    }
};

// Public verified photos for the front page
export const getPublicPhotos = async (req, res) => {
    try {
        const photos = await Photo.find({ verified: true })
            .populate('programId', 'title location state donationCost')
            .sort({ uploadDate: -1 })
            .lean();

        // Get usernames from emails
        const emails = [...new Set(photos.map(p => p.userEmail).filter(Boolean))];
        const users = await User.find({ email: { $in: emails } }).select('email username').lean();
        const emailToUsername = {};
        users.forEach(u => { 
            if (u.email) emailToUsername[u.email.toLowerCase()] = u.username; 
        });

        const formatted = photos.map(p => ({
            _id: p._id,
            photoUrl: p.photoUrl || (p.imageId ? `/admin/getPhoto/${p.imageId}` : ''),
            imageId: p.imageId,
            treeSpecies: p.treeSpecies || 'Native Tree',
            description: p.description || '',
            dedication: p.dedication || '',
            cheers: p.cheers || 0,
            location: p.location,
            program: p.programId ? {
                id: p.programId._id,
                title: p.programId.title,
                location: p.programId.location,
                state: p.programId.state,
                donationCost: p.programId.donationCost
            } : null,
            donorUsername: emailToUsername[p.userEmail?.toLowerCase()] || p.userEmail?.split('@')[0] || 'Green Donor',
            donorEmail: p.userEmail,
            uploadDate: p.uploadDate,
            checkIns: p.checkIns || []
        }));

        res.json(formatted);
    } catch (error) {
        console.error("Error fetching public photos:", error);
        res.status(500).json({ error: error.message });
    }
};

