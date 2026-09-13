import React, { useState, useEffect } from "react";
import Navbar from "./Navbar";
import { useDispatch, useSelector } from "react-redux";
import { fetchprograms, addprogram } from "../actions/programs.js";
import { uploadPhoto } from '../actions/uploadPhoto.js';
import TreeLocationPicker from './TreeLocationPicker';

const AdminProfile = () => {
  const [activeForm, setActiveForm] = useState(null); // 'program' | 'photos'
  const [program, setProgram] = useState({ title: "", description: "" });
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [description, setDescription] = useState('');
  const [treeSpecies, setTreeSpecies] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locationSource, setLocationSource] = useState('manual-pin');
  const [dedication, setDedication] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [existingPhotos, setExistingPhotos] = useState([]);
  const [refreshPhotos, setRefreshPhotos] = useState(0);

  // Use composite index-based keys (programIndex-userIndex) for checkbox state
  const [checkedDonors, setCheckedDonors] = useState(() => {
    const saved = localStorage.getItem('checkedDonors');
    return saved ? JSON.parse(saved) : {};
  });

  const [dbSpecies, setDbSpecies] = useState([]);
  const [dbCities, setDbCities] = useState([]);

  const dispatch = useDispatch();
  const programs = useSelector((state) => state.programs);

  // Fetch all existing photos, species, and cities from MongoDB
  useEffect(() => {
    const fetchSafeJson = async (url) => {
      try {
        const res = await fetch(url);
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          return await res.json();
        }
      } catch (err) {
        console.warn(`Fetch notice for ${url}:`, err.message);
      }
      return null;
    };

    fetchSafeJson('/api/photos/public').then(data => {
      if (Array.isArray(data)) setExistingPhotos(data);
    });

    fetchSafeJson('/api/species').then(data => {
      if (Array.isArray(data)) setDbSpecies(data);
    });

    fetchSafeJson('/api/cities').then(data => {
      if (Array.isArray(data)) setDbCities(data);
    });
  }, [refreshPhotos]);

  // Persist checkedDonors whenever changed
  useEffect(() => {
    localStorage.setItem('checkedDonors', JSON.stringify(checkedDonors));
  }, [checkedDonors]);

  // Fetch programs on mount
  useEffect(() => {
    const fetchAllPrograms = async () => {
      try {
        setLoading(true);
        await dispatch(fetchprograms());
      } catch (err) {
        console.error("Error loading programs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllPrograms();
  }, [dispatch]);

  // Program form handlers
  const handleProgramChange = (e) => {
    const { name, value } = e.target;
    setProgram({ ...program, [name]: value });
  };

  const handleProgramSubmit = (e) => {
    e.preventDefault();
    if (!program.title || !program.description) return alert("Fill all fields.");
    dispatch(addprogram(program));
    setProgram({ title: "", description: "" });
    alert("Program added!");
  };

  // Photo form handlers
  const [isVerifying, setIsVerifying] = useState(false); // Part B state
  const [verificationError, setVerificationError] = useState(""); // Part B state
  const [uploadSuccess, setUploadSuccess] = useState(false); // Part B state

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    setImage(file);
    if (file) setImagePreview(URL.createObjectURL(file));
    setVerificationError("");
    setUploadSuccess(false);
  };

  const handleSelectDonorForPhoto = (donorEmail, programId, donorUsername, programTitle) => {
    setUserEmail(donorEmail);
    setSelectedProgram(programId || "");
    setDedication(`Planted in recognition of @${donorUsername}'s tree sponsorship in ${programTitle}`);
    if (!treeSpecies) setTreeSpecies("Native Forest Sapling");
    if (!latitude) setLatitude("20.5937");
    if (!longitude) setLongitude("78.9629");
    setActiveForm("photos");
    window.scrollTo({ top: 200, behavior: "smooth" });
  };

  const handlePhotoSubmit = (e) => {
    e.preventDefault();
    if (!image && !photoUrlInput) return alert("Please select an image file or provide a photo URL.");
    if (!userEmail) return alert("Enter user email.");
    
    const formData = new FormData();
    formData.append('userEmail', userEmail);
    formData.append('description', description);
    formData.append('treeSpecies', treeSpecies || 'Native Tree');
    formData.append('latitude', latitude || '20.5937');
    formData.append('longitude', longitude || '78.9629');
    formData.append('locationSource', locationSource);
    if(selectedProgram) formData.append('programId', selectedProgram);
    if(dedication) formData.append('dedication', dedication);
    if (image) formData.append('photo', image);
    if (photoUrlInput) formData.append('photoUrl', photoUrlInput);
    
    dispatch(uploadPhoto(formData, setIsVerifying, setVerificationError, (success) => {
      if(success) {
        setImage(null);
        setImagePreview("");
        setPhotoUrlInput("");
        setUserEmail("");
        setDescription('');
        setTreeSpecies('');
        setLatitude('');
        setLongitude('');
        setLocationSource('manual-pin');
        setDedication('');
        setSelectedProgram('');
        setUploadSuccess(true);
        setRefreshPhotos(prev => prev + 1);
        setTimeout(() => setUploadSuccess(false), 4000);
      }
    }));
  };

  // Checkbox toggle handler using composite key "programIndex-userIndex"
  const handleDonorCheckboxChange = (key) => {
    setCheckedDonors(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('checkedDonors', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div>
      {/* <Navbar /> */}
      <div className="admin-container" style={styles.container}>
        <h2 style={styles.title}>Admin Dashboard</h2>

        {/* Toggle buttons */}
        <div className="admin-btn-group" style={styles.buttonGroup}>
          <button style={styles.toggleBtn} onClick={() => setActiveForm("program")}>Add Program</button>
          <button style={styles.toggleBtn} onClick={() => setActiveForm("photos")}>Add Photos</button>
        </div>

        {/* Add Program Form */}
        {activeForm === "program" && (
          <form onSubmit={handleProgramSubmit} style={styles.form}>
            <label style={styles.label}>Title</label>
            <input type="text" name="title" value={program.title} onChange={handleProgramChange} style={styles.input} required />
            <label style={styles.label}>Description</label>
            <textarea name="description" value={program.description} onChange={handleProgramChange} style={styles.textarea} required />
            <button type="submit" style={styles.submitBtn}>Upload Program</button>
          </form>
        )}

        {/* Add Photo Form */}
        {activeForm === "photos" && (
          <form id="admin-photo-form" onSubmit={handlePhotoSubmit} style={styles.form}>
            <div style={{ backgroundColor: "#e8f5e9", padding: "10px 14px", borderRadius: "8px", border: "1px solid #c8e6c9" }}>
              <span style={{ fontSize: "0.88rem", color: "#2e7d32", fontWeight: "600" }}>
                🌿 Uploading field photo for a user's tree donation. Once uploaded, it will appear on the user's dashboard and the front page gallery!
              </span>
            </div>

            <label style={styles.label}>User Email</label>
            <input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} style={styles.input} required placeholder="Enter donor email (e.g. donor@gmail.com)" />
            
            <label style={styles.label}>Tree Species (From MongoDB Catalog)</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
              <select 
                value={treeSpecies} 
                onChange={(e) => setTreeSpecies(e.target.value)} 
                style={{ ...styles.input, flex: "1 1 200px" }}
              >
                <option value="">-- Choose from MongoDB Species --</option>
                {dbSpecies.map(s => (
                  <option key={s._id || s.commonName} value={s.commonName}>
                    🌿 {s.commonName} ({s.scientificName || s.nativeRegion}) - ~{s.carbonRateKgPerYear || 20}kg CO2/yr
                  </option>
                ))}
              </select>
              <input 
                type="text" 
                value={treeSpecies} 
                onChange={(e) => setTreeSpecies(e.target.value)} 
                style={{ ...styles.input, flex: "1 1 200px" }} 
                placeholder="Or custom species name" 
              />
            </div>

            <label style={styles.label}>Quick City Location Preset (From MongoDB)</label>
            <select 
              onChange={(e) => {
                if (!e.target.value) return;
                const selectedCity = dbCities.find(c => c.name === e.target.value);
                if (selectedCity) {
                  setLatitude(String(selectedCity.lat));
                  setLongitude(String(selectedCity.lng));
                  setLocationSource('manual-pin');
                }
              }}
              style={{ ...styles.input, marginBottom: "10px" }}
            >
              <option value="">-- Choose City Coordinates from MongoDB (Optional) --</option>
              {dbCities.map(c => (
                <option key={c._id || c.name} value={c.name}>
                  📍 {c.name}, {c.state} ({c.lat}, {c.lng})
                </option>
              ))}
            </select>

            <label style={styles.label}>Link to Program</label>
            <select value={selectedProgram} onChange={(e) => setSelectedProgram(e.target.value)} style={styles.input}>
              <option value="">Select a Program (Optional)</option>
              {programs.map(p => (
                <option key={p._id} value={p._id}>{p.title} {p.location ? `(${p.location})` : ''}</option>
              ))}
            </select>

            <label style={styles.label}>Dedication / Note</label>
            <input type="text" value={dedication} onChange={(e) => setDedication(e.target.value)} style={styles.input} placeholder="e.g. In appreciation of donor's generous sponsorship" />

            <label style={styles.label}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ ...styles.input, height: '80px' }} placeholder="Field notes on sapling health, soil conditions, and coordinates..." />

            <TreeLocationPicker 
              file={image} 
              onLocationSelect={(loc) => {
                setLatitude(loc.lat);
                setLongitude(loc.lng);
                setLocationSource(loc.locationSource);
              }} 
            />

            <label style={styles.label}>Photo Source (File Upload OR Image URL)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input 
                type="url" 
                value={photoUrlInput} 
                onChange={(e) => {
                  setPhotoUrlInput(e.target.value);
                  if (e.target.value) setImagePreview(e.target.value);
                }} 
                style={styles.input} 
                placeholder="Paste web photo URL (e.g. https://images.unsplash.com/...)" 
              />
              <span style={{ fontSize: "0.8rem", color: "#666", textAlign: "center" }}>— OR SELECT LOCAL FILE —</span>
              <input type="file" accept="image/*" onChange={handleImageChange} style={styles.input} />
            </div>

            {imagePreview && (
              <div style={{ textAlign: "center", marginTop: "10px" }}>
                <img src={imagePreview} alt="Preview" style={styles.preview} />
              </div>
            )}
            {verificationError && <p style={{ color: "red", fontWeight: "bold" }}>{verificationError}</p>}
            {uploadSuccess && <p style={{ color: "green", fontWeight: "bold" }}>✅ Photo successfully uploaded, verified, and linked to donor!</p>}
            <button type="submit" disabled={isVerifying} style={{...styles.submitBtn, opacity: isVerifying ? 0.7 : 1}}>
              {isVerifying ? "Verifying with AI..." : "Upload Tree Photo"}
            </button>
          </form>
        )}

        {/* Programs & Donors List */}
        <section style={{ marginTop: "40px" }}>
          <h3 style={{ color: "#1b4332", fontSize: "1.3rem", marginBottom: "1rem" }}>All 20 Programs & Active Donors</h3>
          {loading ? (
            <p>Loading programs...</p>
          ) : !Array.isArray(programs) || programs.length === 0 ? (
            <p>No programs found.</p>
          ) : (
            <div>
              {programs.map((program, programIndex) =>
                program ? (
                  <div style={styles.programCard} key={program._id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
                      <div>
                        <h4 style={{ margin: "0 0 4px", fontSize: "1.1rem", color: "#154734" }}>{program.title || "No Title"}</h4>
                        {program.location && (
                          <span style={{ fontSize: "0.82rem", color: "#40916c", fontWeight: "600" }}>📍 {program.location}</span>
                        )}
                      </div>
                      <span style={{ fontSize: "0.85rem", fontWeight: "700", backgroundColor: "#e8f5e9", color: "#2e7d32", padding: "4px 10px", borderRadius: "12px" }}>
                        ₹{program.donationCost || 500} / tree
                      </span>
                    </div>

                    <strong>Donors ({program.donatedUsers?.length || 0}):</strong>
                    {program.donatedUsers && program.donatedUsers.length > 0 ? (
                      <ul style={{ listStyle: "none", padding: 0, marginTop: "8px" }}>
                        {program.donatedUsers.map((user, userIndex) => {
                          const compositeKey = `${programIndex}-${userIndex}`;
                          return (
                            <li 
                              key={compositeKey}
                              style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "space-between", 
                                gap: "8px", 
                                margin: "6px 0", 
                                padding: "8px 12px", 
                                backgroundColor: "#ffffff", 
                                borderRadius: "8px", 
                                border: "1px solid #e1eee4",
                                flexWrap: "wrap"
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <input
                                  type="checkbox"
                                  checked={!!checkedDonors[compositeKey]}
                                  onChange={() => handleDonorCheckboxChange(compositeKey)}
                                />
                                <span><strong>@{user.username}</strong> ({user.email})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSelectDonorForPhoto(user.email, program._id, user.username, program.title)}
                                style={{
                                  padding: "5px 12px",
                                  backgroundColor: "#2d6a4f",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "6px",
                                  fontSize: "0.8rem",
                                  fontWeight: "600",
                                  cursor: "pointer"
                                }}
                              >
                                📸 Add Tree Photo for @{user.username}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p style={{ fontSize: "0.88rem", color: "#888", marginTop: "6px" }}>No donors yet.</p>
                    )}
                  </div>
                ) : null
              )}
            </div>
          )}
        </section>

        {/* Existing Tree Photos in System */}
        <section style={{ marginTop: "40px" }}>
          <h3 style={{ color: "#1b4332", fontSize: "1.3rem", marginBottom: "1rem" }}>
            Verified Community Tree Photos ({existingPhotos.length})
          </h3>
          <p style={{ color: "#555", fontSize: "0.9rem", marginBottom: "1rem" }}>
            These photos are currently visible to the respective donors in their dashboards and to all visitors on the front page.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
            {existingPhotos.map(p => (
              <div key={p._id} style={{ backgroundColor: "#ffffff", borderRadius: "8px", overflow: "hidden", border: "1px solid #e0ebe3", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}>
                <img src={p.photoUrl} alt={p.treeSpecies} style={{ width: "100%", height: "130px", objectFit: "cover" }} />
                <div style={{ padding: "8px 10px" }}>
                  <strong style={{ fontSize: "0.85rem", color: "#154734", display: "block" }}>🌿 {p.treeSpecies}</strong>
                  <span style={{ fontSize: "0.75rem", color: "#40916c", display: "block" }}>👤 @{p.donorUsername}</span>
                  <span style={{ fontSize: "0.72rem", color: "#777", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.program?.title || p.donorEmail}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "700px",
    margin: "60px auto",
    padding: "30px",
    backgroundColor: "#f9fafc",
    borderRadius: "10px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    fontFamily: "'Inter', sans-serif",
  },
  title: {
    textAlign: "center",
    fontSize: "28px",
    fontWeight: "600",
    color: "#333",
    marginBottom: "30px",
  },
  buttonGroup: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    marginBottom: "30px",
  },
  toggleBtn: {
    padding: "10px 20px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#28a745",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
    backgroundColor: "#fff",
    padding: "25px",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  },
  label: {
    fontWeight: "500",
    fontSize: "15px",
    color: "#444",
  },
  input: {
    padding: "10px 12px",
    fontSize: "15px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    outline: "none",
    transition: "border-color 0.2s ease",
  },
  textarea: {
    minHeight: "120px",
    resize: "vertical",
    padding: "10px 12px",
    fontSize: "15px",
    borderRadius: "6px",
    border: "1px solid #ccc",
    outline: "none",
    transition: "border-color 0.2s ease",
  },
  submitBtn: {
    marginTop: "10px",
    padding: "12px",
    fontSize: "16px",
    backgroundColor: "#28a745",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
  },
  preview: {
    marginTop: "10px",
    width: "100%",
    height: "auto",
    borderRadius: "6px",
    border: "1px solid #ddd",
  },
  programCard: {
    marginBottom: "30px",
    padding: "20px",
    backgroundColor: "#fff",
    borderRadius: "8px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },

};

export default AdminProfile;
