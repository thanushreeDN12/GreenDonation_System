import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getUser } from '../actions/programs';
import TreeImpactMap from './TreeImpactMap';
import YourImpactGallery from './YourImpactGallery';
import UserCarbonImpactChart from './UserCarbonImpactChart';

const UserProfile = () => {
  const user = JSON.parse(localStorage.getItem("profile"));
  const userId = user?.result?._id || user?.newUser?._id;
  const dispatch = useDispatch();

  // Get user data from Redux store
  const reduxUserData = useSelector((state) => state.users);

  const [userData, setUserData] = useState(null);
  const [userPhotos, setUserPhotos] = useState([]);
  const [totalCarbon, setTotalCarbon] = useState(0);

  // Fetch photos filtered by the user's email
  useEffect(() => {
    const fetchPhotos = async () => {
      if (userData?.email) {
        try {
          const response = await fetch(`/admin/getPhoto?userEmail=${encodeURIComponent(userData.email)}`);
          if (response.ok) {
            const data = await response.json();
            setUserPhotos(data.photos || []);
            setTotalCarbon(data.totalCarbon || 0);
          } else {
            console.error("Failed to fetch photos");
          }
        } catch (error) {
          console.error("Error fetching photos:", error);
        }
      }
    };

    fetchPhotos();
  }, [userData?.email]);

  // Dispatch action to fetch user details
  useEffect(() => {
    if (userId) {
      dispatch(getUser(userId));
    }
  }, [dispatch, userId]);

  // Update local state when Redux user data changes
  useEffect(() => {
    if (reduxUserData) {
      setUserData(reduxUserData);
    }
  }, [reduxUserData]);

  // Handle Cheer click
  const handleCheer = async (photoId) => {
    // Optimistic update
    setUserPhotos(prevPhotos => prevPhotos.map(p => 
      p._id === photoId ? { ...p, cheers: (p.cheers || 0) + 1, _justCheered: true } : p
    ));
    try {
      await fetch(`/admin/photo/${photoId}/cheer`, { method: 'POST' });
    } catch (err) {
      console.error("Cheer failed", err);
    }
  };

  return (
    <div style={styles.container}>

      {/* User Info Header */}
      <header style={styles.header}>
        <h1 style={styles.userName}>Welcome {userData?.username || "Loading..."}</h1>
        <p style={styles.userEmail}>Your Email: {userData?.email || ""}</p>
      </header>

      {/* Content */}
      <div className="userprofile-layout" style={styles.content}>

        {/* Left Panel - Total Carbon Sequestered */}
        <aside className="userprofile-sidebar" style={styles.leftPanel}>
          <h2>Total Carbon Sequestered</h2>
          <div style={styles.carbonValue}>
            {totalCarbon} kg CO<sub>2</sub>
          </div>
          {totalCarbon > 0 && (
            <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px', fontSize: '0.9rem' }}>
              <p style={{ margin: '0 0 5px' }}><strong>🌱 Tangible Impact:</strong></p>
              <p style={{ margin: '3px 0' }}>📱 Charged <strong>{Math.round(totalCarbon * 122).toLocaleString()}</strong> smartphones</p>
              <p style={{ margin: '3px 0' }}>🚗 Offset <strong>{(totalCarbon * 4).toFixed(1)}</strong> km of driving</p>
            </div>
          )}
        </aside>

        {/* Right Panel - Programs Donated */}
        <section style={styles.programsPanel}>
          <h2>Programs Donated To</h2>
          {(userData?.donatedPrograms?.length || 0) === 0 ? (
            <p>No donation programs found.</p>
          ) : (
            <ul style={styles.programList}>
              {userData.donatedPrograms.map((program) => (
                <li key={program._id} style={styles.programItem}>
                  {program.title}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      
      {/* Emotional Impact Badges */}
      {userPhotos.length > 0 && (
        <section style={{ marginTop: "20px", padding: "15px", backgroundColor: "#e2f0e6", borderRadius: "12px", border: "1px solid #c1dcc0" }}>
          <h2 style={{ margin: '0 0 10px', fontSize: '1.2rem', color: '#154734' }}>Milestone Badges 🎖️</h2>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div style={styles.badge}>🌱 Seedling Starter <span style={styles.badgeSub}>First Tree</span></div>
            {userPhotos.length >= 5 && <div style={styles.badge}>🌳 Grove Builder <span style={styles.badgeSub}>5+ Trees</span></div>}
            {userPhotos.length >= 10 && <div style={styles.badge}>🌲 Forest Maker <span style={styles.badgeSub}>10+ Trees</span></div>}
            {totalCarbon >= 100 && <div style={styles.badge}>🌍 Climate Champion <span style={styles.badgeSub}>100+ kg CO₂</span></div>}
          </div>
        </section>
      )}

      {/* Carbon Offset Visualization (Recharts) */}
      <UserCarbonImpactChart
        trees={userPhotos}
        userEmail={userData?.email}
        title="🌿 Your Carbon Offset Impact Over Time"
      />

      {/* Live Impact Map */}
      <section style={{ marginTop: "40px" }}>
        <h2 style={styles.userName}>Live Impact Map</h2>
        <TreeImpactMap />
      </section>

      {/* Your Impact Gallery */}
      <YourImpactGallery />

      {/* User Photos Section */}
      <section style={{ marginTop: "40px" }}>
        <h2 style={styles.userName}>User Photos</h2>
        {userPhotos.length === 0 ? (
          <p>No photos uploaded yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {userPhotos.map((photo) => (
              <div key={photo._id} style={{ textAlign: 'left', backgroundColor: '#f0f7f3', padding: '12px', borderRadius: '12px', border: '1px solid #c1dcc0', display: 'flex', flexDirection: 'column' }}>
                <img
                  src={photo.photoUrl ? photo.photoUrl : `/admin/getPhoto/${photo.imageId}`}
                  alt={photo.description || 'User photo'}
                  style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }}
                />
                {photo.treeSpecies && (
                  <p style={{ margin: '4px 0', fontSize: '0.85rem', color: '#154734', fontWeight: 'bold' }}>
                    🌿 {photo.treeSpecies}
                  </p>
                )}
                
                {photo.dedication && (
                  <p style={{ margin: '6px 0', fontSize: '0.85rem', fontStyle: 'italic', color: '#2e8b57', background: '#e2f0e6', padding: '6px', borderRadius: '4px' }}>
                    "Dedicated to: {photo.dedication}"
                  </p>
                )}
                
                <p style={{ marginTop: '6px', fontSize: '0.85rem', color: '#444' }}>
                  {photo.description || 'No description'}
                </p>

                {/* Cheer Button */}
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button 
                    onClick={() => handleCheer(photo._id)}
                    style={{ background: 'none', border: '1px solid #c1dcc0', borderRadius: '20px', padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', color: photo._justCheered ? '#28a745' : '#444', transition: 'all 0.2s', backgroundColor: photo._justCheered ? '#e2f0e6' : 'white' }}
                  >
                    💚 <span style={{ fontWeight: 'bold' }}>{photo.cheers || 0}</span>
                  </button>
                  <span style={{ fontSize: '0.75rem', color: '#888' }}>
                    {new Date(photo.uploadDate).toLocaleDateString()}
                  </span>
                </div>

                {/* Part D: Check-ins */}
                {photo.checkIns && photo.checkIns.length > 0 && (
                  <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e2f0e6', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 5px', fontSize: '0.85rem', color: '#2e4d25' }}>Growth Check-ins:</h4>
                    <div style={{ display: 'flex', overflowX: 'auto', gap: '8px' }}>
                      {photo.checkIns.map((ci, idx) => (
                        <img key={idx} src={ci.photoUrl && ci.photoUrl.startsWith('http') ? ci.photoUrl : `/admin/getPhoto/${ci.photoUrl}`} alt="Check-in" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '4px', border: ci.verified ? '2px solid #4CAF50' : '2px solid #ccc' }} title={ci.note} />
                      ))}
                    </div>
                  </div>
                )}
                
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const file = e.target.photo.files[0];
                    if (!file) return;
                    const formData = new FormData();
                    formData.append('photoId', photo._id);
                    formData.append('photo', file);
                    formData.append('note', e.target.note.value);
                    
                    try {
                      const res = await fetch('/admin/checkin', { method: 'POST', body: formData });
                      if(res.ok) {
                        alert("Check-in added!");
                        window.location.reload(); // naive reload to fetch updated checkins
                      } else {
                        const err = await res.json();
                        alert(err.message || 'Check-in failed');
                      }
                    } catch(err) {
                       alert('Check-in failed');
                    }
                  }} 
                  style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}
                >
                  <input type="text" name="note" placeholder="Check-in note..." style={{ fontSize: '0.8rem', padding: '4px' }} required />
                  <input type="file" name="photo" accept="image/*" style={{ fontSize: '0.8rem' }} required />
                  <button type="submit" style={{ fontSize: '0.8rem', padding: '4px', backgroundColor: '#4a6c4a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add Check-in</button>
                </form>

              </div>
            ))}
          </div>
        )}
      </section>

      


    </div>
  );
};

const styles = {
  container: {
    maxWidth: 900,
    margin: "2rem auto",
    padding: "0 1.25rem",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  header: {
    borderBottom: "2px solid #ccc",
    paddingBottom: "1rem",
    marginBottom: "2rem",
  },
  userName: {
    fontSize: "2rem",
    margin: 0,
    color: "#154734",
  },
  userEmail: {
    fontSize: "1.1rem",
    margin: 0,
    color: "#4a6c4a",
  },
  content: {
    display: "flex",
    gap: "2rem",
  },
  leftPanel: {
    flex: "0 0 250px",
    border: "1px solid #c1dcc0",
    borderRadius: 12,
    padding: "1.5rem",
    backgroundColor: "#e7f1e7",
    textAlign: "center",
    color: "#2e4d25",
  },
  carbonValue: {
    marginTop: "1rem",
    fontSize: "2.2rem",
    fontWeight: "bold",
  },
  programsPanel: {
    flex: 1,
    border: "1px solid #c1dcc0",
    borderRadius: 12,
    padding: "1.5rem",
    backgroundColor: "#f7fbf8",
    color: "#386641",
  },
  programList: {
    listStyle: "none",
    paddingLeft: 0,
    marginTop: "1rem",
  },
  programItem: {
    padding: "0.5rem 0",
    borderBottom: "1px solid #d3e4d3",
  },
  badge: {
    background: '#fff',
    border: '1px solid #c1dcc0',
    padding: '8px 12px',
    borderRadius: '20px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    color: '#2e4d25',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
  },
  badgeSub: {
    fontSize: '0.7rem',
    background: '#e2f0e6',
    padding: '2px 6px',
    borderRadius: '10px',
    fontWeight: 'normal',
    color: '#154734'
  }
};

export default UserProfile;
