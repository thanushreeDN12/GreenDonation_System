import mongoose from 'mongoose';
import Photo from '../models/photo.js';
import { GoogleGenAI } from '@google/genai';
import { calculateTotalCarbon } from '../utils/carbonCalc.js';

export const getMapData = async (req, res) => {
  try {
    const photos = await Photo.find({ verified: true }).select('location treeSpecies userEmail').lean();
    
    const mapData = photos.map(p => ({
      _id: p._id,
      lat: p.location?.coordinates[1],
      lng: p.location?.coordinates[0],
      species: p.treeSpecies,
      uploadedBy: p.userEmail
    })).filter(p => p.lat && p.lng);

    res.json(mapData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const uploadPhoto = async (req, res) => {
  try {
    const { userEmail, description, treeSpecies, latitude, longitude, dedication, locationSource, programId, photoUrl } = req.body;
    const cleanEmail = userEmail ? userEmail.trim().toLowerCase() : '';

    if (!req.file && !photoUrl) {
      return res.status(400).json({ message: 'Either an image file or a valid photo URL must be provided' });
    }

    let verified = true;

    // If file uploaded, run AI check & save to GridFS
    if (req.file) {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && apiKey !== 'PLACEHOLDER') {
          const ai = new GoogleGenAI({ apiKey });
          const prompt = "Does this image contain a tree, sapling, or plant? Reply ONLY with YES or NO.";
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              prompt,
              { inlineData: { data: req.file.buffer.toString("base64"), mimeType: req.file.mimetype } }
            ]
          });
          const rawText = typeof response.text === 'function' ? response.text() : (response.text || '');
          const text = rawText.trim().toUpperCase();
          if (text.includes("NO") && !text.includes("YES")) {
             return res.status(400).json({ message: "This doesn't look like a tree photo — please retake" });
          } else {
             verified = true;
          }
        }
      } catch (aiError) {
        console.warn("AI verification failed or quota exceeded, proceeding with upload:", aiError.message);
        verified = true;
      }

      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'photos' });
      const uploadStream = bucket.openUploadStream(req.file.originalname, { contentType: req.file.mimetype });

      uploadStream.end(req.file.buffer);

      uploadStream.on('error', (err) => {
        console.error('GridFS upload error:', err);
        return res.status(500).json({ message: 'Upload failed' });
      });

      uploadStream.on('finish', async () => {
        const files = await bucket.find({ filename: req.file.originalname }).sort({ uploadDate: -1 }).toArray();
        if (!files || files.length === 0) {
          return res.status(500).json({ message: 'Uploaded file not found' });
        }

        const file = files[0];

        const newPhoto = new Photo({
          userEmail: cleanEmail,
          description: description || '',
          treeSpecies: treeSpecies || 'Native Tree',
          location: {
            type: "Point",
            locationSource: locationSource || 'manual-pin',
            coordinates: [parseFloat(longitude) || 78.9629, parseFloat(latitude) || 20.5937]
          },
          imageId: file._id,
          programId: programId || null,
          verified: true,
          dedication: dedication || ''
        });

        const savedPhoto = await newPhoto.save();
        return res.status(201).json(savedPhoto);
      });
      return;
    }

    // Otherwise, direct photoUrl provided
    const newPhoto = new Photo({
      userEmail: cleanEmail,
      description: description || '',
      treeSpecies: treeSpecies || 'Native Tree',
      photoUrl: photoUrl.trim(),
      location: {
        type: "Point",
        locationSource: locationSource || 'manual-pin',
        coordinates: [parseFloat(longitude) || 78.9629, parseFloat(latitude) || 20.5937]
      },
      programId: programId || null,
      verified: true,
      dedication: dedication || ''
    });

    const savedPhoto = await newPhoto.save();
    return res.status(201).json(savedPhoto);
  } catch (error) {
    console.error('Upload handler error:', error);
    return res.status(500).json({ message: error.message });
  }
};






export const checkInPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { photoId, note } = req.body;

    const photo = await Photo.findById(photoId);
    if (!photo) return res.status(404).json({ message: 'Tree photo not found' });

    let verified = true;
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey && apiKey !== 'PLACEHOLDER') {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = "Does this image contain a tree, sapling, or plant? Reply ONLY with YES or NO.";
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            prompt,
            { inlineData: { data: req.file.buffer.toString("base64"), mimeType: req.file.mimetype } }
          ]
        });
        const rawText = typeof response.text === 'function' ? response.text() : (response.text || '');
        const text = rawText.trim().toUpperCase();
        if (text.includes("NO") && !text.includes("YES")) {
           return res.status(400).json({ message: "This doesn't look like a tree — please retake" });
        } else {
           verified = true;
        }
      }
    } catch (aiError) {
      console.warn("AI verification failed or quota exceeded:", aiError.message);
      verified = true;
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'photos' });
    const uploadStream = bucket.openUploadStream(req.file.originalname, { contentType: req.file.mimetype });
    uploadStream.end(req.file.buffer);

    uploadStream.on('error', (err) => res.status(500).json({ message: 'Upload failed' }));

    uploadStream.on('finish', async () => {
      const files = await bucket.find({ filename: req.file.originalname }).sort({ uploadDate: -1 }).toArray();
      const file = files[0];
      
      photo.checkIns.push({
        photoUrl: file._id.toString(),
        note: note || "",
        verified
      });
      await photo.save();
      res.status(201).json(photo);
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPhoto= async (req, res)=> {
     try {
       const { userEmail } = req.query;
       let query = {};
       if (userEmail && userEmail.trim()) {
         const escaped = userEmail.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
         query.userEmail = { $regex: new RegExp(`^${escaped}$`, 'i') };
       } else {
         query.verified = true;
       }

       const photos = await Photo.find(query)
         .populate('programId', 'title location state donationCost')
         .select('-__v')
         .sort({ uploadDate: -1 })
         .lean();
       
       // Calculate total carbon for these photos
       const totalCarbon = calculateTotalCarbon(photos);

       res.json({ photos, totalCarbon });
    } catch (error) {
        console.error("Mongoose fetch error:", error.message);
        res.status(409).json({ message: error.message });
    }
}


export const servePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const fileId = new mongoose.Types.ObjectId(id);

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'photos',
    });

    // Find the file to get contentType
    const files = await bucket.find({ _id: fileId }).toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'File not found' });
    }

    const file = files[0];

    res.set('Content-Type', file.contentType);

    // Open download stream and pipe to response
    const downloadStream = bucket.openDownloadStream(fileId);
    downloadStream.pipe(res);

    downloadStream.on('error', (err) => {
      console.error('Error streaming file:', err);
      res.status(500).json({ message: 'Error streaming file' });
    });
  } catch (error) {
    console.error('Invalid file id:', error);
    res.status(400).json({ message: 'Invalid file id' });
  }
};

// export default {uploadPhoto, getPhoto}
export const cheerPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const photo = await Photo.findByIdAndUpdate(
      id,
      { $inc: { cheers: 1 } },
      { new: true }
    );
    if (!photo) return res.status(404).json({ message: 'Tree photo not found' });
    res.json(photo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
