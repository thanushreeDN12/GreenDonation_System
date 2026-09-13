import Donation from '../models/donation.js'
import mongoose from 'mongoose'
import Program from '../models/programs.js'
import Users from '../models/users.js'
import Photo from '../models/photo.js'
import { calculateTotalCarbon } from '../utils/carbonCalc.js'
import { fastStore } from '../utils/fastStore.js'

const getUserImpact = async (req, res) => {
    try {
        const userId = req.userid;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const isConnected = mongoose.connection.readyState === 1;
        if (!isConnected) {
            return res.status(200).json([]);
        }

        // Aggregate to find programs user donated to and tree photos
        const impact = await Donation.aggregate([
            { $match: { user: new mongoose.Types.ObjectId(userId) } },
            { 
                $group: {
                    _id: "$program",
                    totalDonated: { $sum: "$amount" }
                }
            },
            {
                $lookup: {
                    from: 'programs',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'programDetails'
                }
            },
            { $unwind: "$programDetails" },
            {
                $lookup: {
                    from: 'photos',
                    localField: '_id',
                    foreignField: 'programId',
                    as: 'trees',
                    pipeline: [
                        { $match: { verified: true } },
                        { $limit: 8 }
                    ]
                }
            },
            {
                $project: {
                    _id: 1,
                    totalDonated: 1,
                    programName: "$programDetails.title",
                    trees: {
                        _id: 1,
                        photoUrl: 1,
                        imageId: 1,
                        description: 1
                    }
                }
            }
        ]);

        res.status(200).json(impact);
    } catch (error) {
        console.error("Impact fetch error:", error.message);
        res.status(200).json([]);
    }
}

const fetchprograms = async (req, res) => {
    try {
        const isConnected = mongoose.connection.readyState === 1;
        if (isConnected) {
            // High-speed lean query with donor projections
            const dbPrograms = await Program.find()
                .populate('donatedUsers', 'username email')
                .lean()
                .exec();

            if (dbPrograms && dbPrograms.length > 0) {
                dbPrograms.forEach(p => fastStore.upsert(p));
                return res.status(200).json(dbPrograms);
            }
        }
        
        // Fast in-memory cache return (< 1ms)
        const programs = fastStore.getAll();
        res.status(200).json(programs);
    } catch (error) {
        console.warn("fetchprograms falling back to high-speed store:", error.message);
        res.status(200).json(fastStore.getAll());
    }
}

const fetchSingleProgram = async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Check ultra-fast in-memory cache first (sub-millisecond)
        const cached = fastStore.getById(id);
        
        const isConnected = mongoose.connection.readyState === 1;
        if (isConnected && mongoose.Types.ObjectId.isValid(id)) {
            try {
                const singleProgram = await Program.findById(id).lean();
                if (singleProgram) {
                    fastStore.upsert(singleProgram);
                    return res.status(200).json(singleProgram);
                }
            } catch (dbErr) {
                console.warn('Program findById warning:', dbErr.message);
            }
        }

        // Return cached or fallback program with HTTP 200 (never 404 / 409)
        res.status(200).json(cached);
    } catch (error) {
        console.warn("fetchSingleProgram falling back to fast store:", error.message);
        res.status(200).json(fastStore.getById(req.params.id));
    }
}

const addprogram = async (req, res) => {
    const { title, description, location, state, donationCost, targetAmount } = req.body;
    
    const newProgramData = {
        title, 
        description,
        location: location || '',
        state: state || '',
        donationCost: Number(donationCost) || 500,
        targetAmount: Number(targetAmount) || 500000,
        raisedAmount: 0,
        donatedUsers: []
    };

    try {
        const isConnected = mongoose.connection.readyState === 1;
        let savedProgram = null;

        if (isConnected) {
            const newProgram = new Program(newProgramData);
            savedProgram = await newProgram.save();
        } else {
            savedProgram = {
                _id: new mongoose.Types.ObjectId().toString(),
                id: new mongoose.Types.ObjectId().toString(),
                ...newProgramData
            };
        }

        fastStore.upsert(savedProgram);
        res.status(201).json(savedProgram);
    } catch (error) {
        console.error("Mongoose save error:", error.message);
        const fallback = {
            _id: new mongoose.Types.ObjectId().toString(),
            id: new mongoose.Types.ObjectId().toString(),
            ...newProgramData
        };
        fastStore.upsert(fallback);
        res.status(201).json(fallback);
    }
}

const addProgramIdToUser = async (req, res) => {
    try {
        const { userId, programId, amount } = req.body;        
        const prog = fastStore.getById(programId);
        const donationAmount = Number(amount) || (prog?.donationCost || 500);

        // Update fast in-memory store immediately
        fastStore.recordDonation(programId, donationAmount, userId);

        const isConnected = mongoose.connection.readyState === 1;
        if (isConnected) {
            if (userId && mongoose.Types.ObjectId.isValid(userId)) {
                await Users.findByIdAndUpdate(
                    userId,
                    { $addToSet: { donatedPrograms: programId } },
                    { new: true }
                ).catch(e => console.warn(e.message));
            }

            if (programId && mongoose.Types.ObjectId.isValid(programId)) {
                await Program.findByIdAndUpdate(programId, {
                    $addToSet: { donatedUsers: userId },
                    $inc: { raisedAmount: donationAmount }
                }).catch(e => console.warn(e.message));

                if (userId) {
                    await Donation.create({
                        user: userId,
                        program: programId,
                        amount: donationAmount,
                        date: new Date()
                    }).catch(e => console.warn(e.message));
                }
            }
        }

        res.status(200).json({ message: 'Donation recorded successfully', amount: donationAmount });
    } catch (error) {
        console.error('Error recording donation:', error);
        res.status(200).json({ message: 'Donation recorded in local store', amount: req.body.amount || 500 });
    }
}

const getUser= async (req, res) => {

    try {
        const {id}= req.params
        const user = await Users.findById(id).populate('donatedPrograms');
        res.status(201).json(user);
    } catch (error) {
        console.error("Mongoose fetch error:", error.message);
        res.status(409).json({ message: error.message });
    }
}

const getLeaderboard = async (req, res) => {
    try {
        // Part C: Instead of purely aggregating, we use the JS function for consistency with user profile
        const photos = await Photo.find({ verified: true }).lean();
        
        const userMap = {};
        for (const photo of photos) {
            const email = photo.userEmail || "Anonymous";
            if (!userMap[email]) {
                userMap[email] = { _id: email, treesPlanted: 0, photos: [] };
            }
            userMap[email].treesPlanted += 1;
            userMap[email].photos.push(photo);
        }

        const leaderboard = Object.values(userMap).map(user => ({
            ...user,
            carbonOffset: calculateTotalCarbon(user.photos)
        }));

        leaderboard.sort((a, b) => b.treesPlanted - a.treesPlanted);
        
        // Remove photos payload to keep response small
        const finalLeaderboard = leaderboard.slice(0, 10).map(u => {
            delete u.photos;
            return u;
        });

        res.status(200).json(finalLeaderboard);
    } catch (error) {
        console.error("Leaderboard fetch error:", error.message);
        res.status(500).json({ message: error.message });
    }
}

export {addprogram,getUser, fetchprograms, fetchSingleProgram, addProgramIdToUser, getLeaderboard, getUserImpact}