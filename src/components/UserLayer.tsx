import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, 
  Shield, 
  Activity, 
  MapPin, 
  Phone, 
  Mail, 
  Lock, 
  User, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Navigation, 
  Globe, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  HelpCircle,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, auth } from '../firebase';
import { toast } from 'sonner';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  setDoc,
  where
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { cn } from '../lib/utils';
import { FloatingInput } from './ui/FloatingInput';
import { getDisasterAdvice } from '../services/aiService';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Resources from './Resources';

// Fix Leaflet icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function RecenterMap({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== 0 && lng !== 0) {
      map.setView([lat, lng], 15);
    }
  }, [lat, lng, map]);
  return null;
}

interface Story {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  createdAt: any;
}

const clickEffect = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.96 },
  transition: { type: "spring", stiffness: 500, damping: 20 }
};

export default function UserLayer({ profile, onLogout }: { profile: any, onLogout?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [formData, setFormData] = useState({
    name: profile?.displayName || '',
    email: profile?.email || '',
    phone: '',
    pincode: '',
    district: '',
    state: '',
    type: 'health',
    description: '',
    placeName: '',
    location: { lat: 0, lng: 0 }
  });
  const [submitted, setSubmitted] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showGetInvolved, setShowGetInvolved] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const [regStep, setRegStep] = useState<'form' | 'anim' | 'success'>('form');
  const [regData, setRegData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    category: 'user' as 'user' | 'volunteer' | 'coordinator'
  });
  const [animText, setAnimText] = useState('Initializing Registration...');
  const [locating, setLocating] = useState(false);
  const [locationVerified, setLocationVerified] = useState(false);
  const [regError, setRegError] = useState('');
  const [activeNeedId, setActiveNeedId] = useState<string | null>(null);
  const skipGeocode = useRef(false);

  // Live GPS Tracking for active need
  useEffect(() => {
    if (!activeNeedId || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          await updateDoc(doc(db, 'needs', activeNeedId), {
            location: { lat, lng }
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `needs/${activeNeedId}`);
        }
      },
      (error) => console.error("WatchPosition error:", error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [activeNeedId]);

  // Automatic geocoding based on address fields
  useEffect(() => {
    const geocodeAddress = async () => {
      if (skipGeocode.current) {
        skipGeocode.current = false;
        return;
      }
      const { pincode, district, state } = formData;
      if (!pincode && !district && !state) return;

      // Construct query string
      const queryParts = [];
      if (pincode) {
        queryParts.push(pincode);
      } else {
        if (district) queryParts.push(district);
        if (state) queryParts.push(state);
      }
      queryParts.push('India'); // Assuming India based on the context of the app

      const queryString = queryParts.join(', ');
      
      try {
        setLocating(true);
        setLocationVerified(false);
        
        // Simulate "Dynamic Authentication" delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryString)}&limit=1`);
        const data = await response.json();

        if (data && data.length > 0) {
          const { lat, lon, display_name } = data[0];
          setFormData(prev => ({
            ...prev,
            placeName: display_name || '',
            location: {
              lat: parseFloat(lat),
              lng: parseFloat(lon)
            }
          }));
          setLocationVerified(true);
        }
      } catch (error) {
        console.error("Geocoding error:", error);
        setLocationVerified(false);
      } finally {
        setLocating(false);
      }
    };

    const timeoutId = setTimeout(() => {
      if (formData.pincode.length >= 6 || (formData.district && formData.state)) {
        geocodeAddress();
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [formData.pincode, formData.district, formData.state]);

  const updateLocation = () => {
    if (navigator.geolocation) {
      setLocating(true);
      setLocationVerified(false);
      skipGeocode.current = true;
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
            const data = await response.json();
            
            const address = data.address || {};
            const pincode = address.postcode || '';
            
            // More robust district/city extraction
            const district = address.county || 
                            address.district || 
                            address.city || 
                            address.town || 
                            address.village || 
                            address.city_district || 
                            address.suburb || 
                            '';
            const state = address.state || '';

            setFormData(prev => ({
              ...prev,
              placeName: data.display_name || '',
              location: { lat, lng },
              pincode: pincode.split(';')[0] || prev.pincode, // Handle multiple postcodes
              district: district || prev.district,
              state: state || prev.state
            }));
          } catch (error) {
            console.error("Reverse geocoding error:", error);
            setFormData(prev => ({
              ...prev,
              location: { lat, lng }
            }));
          } finally {
            setLocating(false);
            setLocationVerified(true);
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocating(false);
          setLocationVerified(false);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    }
  };

  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    // Listen for stories
    const q = query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(3));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storyData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
      setStories(storyData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'stories'));

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate authentication/verification animation for speed
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const finalName = formData.name.trim() === '' ? 'USER' : formData.name;
      
      const docRef = await addDoc(collection(db, 'needs'), {
        userId: profile.uid,
        ...formData,
        name: finalName,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setActiveNeedId(docRef.id);
      setSubmitted(true);
      setShowSuccessAlert(true);
      setFormData({ 
        name: profile?.displayName || '',
        email: profile?.email || '',
        phone: '',
        pincode: '',
        district: '',
        state: '',
        type: 'health', 
        description: '', 
        location: formData.location 
      });
      setTimeout(() => {
        setSubmitted(false);
        setShowSuccessAlert(false);
      }, 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'needs');
    } finally {
      setLoading(false);
    }
  };

  const [userRequest, setUserRequest] = useState<any>(null);
  const [userRequests, setUserRequests] = useState<any[]>([]);
  const alertedRequests = useRef<Set<string>>(new Set());
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, 'needs'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      if (isInitialMount.current) {
        requests.forEach(req => {
          if (req.status === 'resolved') {
            alertedRequests.current.add(req.id);
          }
        });
        isInitialMount.current = false;
      } else {
        requests.forEach(req => {
          if (req.status === 'resolved' && !alertedRequests.current.has(req.id)) {
            // Play notification sound with a more stable source
            const audio = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3');
            audio.load();
            audio.play().catch(e => {
              console.warn("Audio playback failed (likely browser policy):", e);
              // Fallback: the toast notification is already visible
            });

            toast.success(`MISSION COMPLETE!`, {
              description: `Your ${req.type.toUpperCase()} request has been successfully resolved.`,
              duration: 5000,
            });
            alertedRequests.current.add(req.id);
          }
        });
      }
      
      setUserRequests(requests);
      if (requests.length > 0) {
        setUserRequest(requests[0]);
      } else {
        setUserRequest(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'needs'));
    return () => unsubscribe();
  }, [profile?.uid]);

  const handleAiAsk = async () => {
    if (!aiPrompt) return;
    setAiLoading(true);
    const advice = await getDisasterAdvice(aiPrompt);
    setAiResponse(advice);
    setAiLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegStep('anim');
    
    try {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, regData.email, regData.password);
        await updateProfile(userCredential.user, {
          displayName: `${regData.firstName} ${regData.lastName}`
        });
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          firstName: regData.firstName,
          lastName: regData.lastName,
          email: regData.email,
          role: regData.category,
          createdAt: serverTimestamp()
        });
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          // If the email is already registered, try to sign them in instead
          await signInWithEmailAndPassword(auth, regData.email, regData.password);
        } else {
          throw createErr;
        }
      }

      const steps = [
        'Verifying identity...',
        'Securing connection...',
        'Syncing with Global Response Force...',
        'Finalizing account...'
      ];

      for (let i = 0; i < steps.length; i++) {
        setAnimText(steps[i]);
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      setRegStep('success');
      setTimeout(() => {
        setShowGetInvolved(false);
        setRegStep('form');
      }, 3000);
    } catch (err: any) {
      if (err.code !== 'auth/invalid-credential' && err.code !== 'auth/wrong-password' && err.code !== 'auth/user-not-found' && err.code !== 'auth/email-already-in-use') {
        console.error("Registration error:", err);
      }
      if (err.code === 'auth/email-already-in-use') {
        setRegError('This email is already registered.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setRegError('Firebase Error: Email/Password login is not enabled in the Firebase Console. Please enable it under Authentication > Sign-in method.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setRegError('This email is already registered, but the password provided is incorrect.');
      } else {
        setRegError(err.message || 'Registration failed');
      }
      setRegStep('form');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      {/* AI Assistant Floating Panel */}
      <div className="fixed bottom-8 right-8 z-50">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.8, ease: "backOut" }}
          className="relative"
        >
          <div className="absolute -top-2 -right-2 w-4 h-4 bg-orange-500 rounded-full animate-ping" />
          <button 
            onClick={() => setAiResponse(aiResponse ? '' : ' ')}
            className="w-14 h-14 bg-orange-500 rounded-full flex items-center justify-center shadow-2xl shadow-orange-500/40 hover:scale-110 transition-transform"
          >
            <Sparkles className="text-white" size={24} />
          </button>
        </motion.div>

        <AnimatePresence>
          {aiResponse !== '' && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.6, ease: "circOut" }}
              className="absolute bottom-20 right-0 w-80 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-2 text-orange-500 font-bold text-xs uppercase tracking-widest">
                <Sparkles size={14} />
                AI Response Force
              </div>
              <div className="max-h-60 overflow-y-auto text-sm text-zinc-300 leading-relaxed font-medium">
                {aiLoading ? (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Loader2 className="animate-spin" size={14} />
                    Analyzing situation...
                  </div>
                ) : (
                  aiResponse.trim() || "How can I help you navigate this situation safely?"
                )}
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiAsk()}
                  placeholder="Ask AI for advice..."
                  className="w-full pl-4 pr-10 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                />
                <button 
                  onClick={handleAiAsk}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-orange-500 hover:text-orange-400"
                >
                  <Send size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Get Involved Modal */}
      <AnimatePresence>
        {showGetInvolved && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ duration: 0.7, ease: "circOut" }}
              className={cn(
                "w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden transition-all duration-700",
                regStep === 'anim' && "authenticating-glow"
              )}
            >
              {regStep === 'form' && (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-orange-500/20 mb-4">
                      <Heart className="text-white" size={32} />
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight">Join the Mission</h2>
                    <p className="text-zinc-500 text-sm">Provide your details to start making an impact.</p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-6">
                    <AnimatePresence>
                      {regError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.5 }}
                          className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 text-red-500 text-xs font-bold uppercase tracking-widest"
                        >
                          <AlertCircle size={16} />
                          {regError}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="grid grid-cols-2 gap-4">
                      <FloatingInput 
                        label="First Name" 
                        name="firstName" 
                        value={regData.firstName} 
                        onChange={(e) => setRegData({...regData, firstName: e.target.value})} 
                        required 
                        icon={User} 
                        placeholder="e.g. John"
                      />
                      <FloatingInput 
                        label="Last Name" 
                        name="lastName" 
                        value={regData.lastName} 
                        onChange={(e) => setRegData({...regData, lastName: e.target.value})} 
                        required 
                        icon={User} 
                        placeholder="e.g. Doe"
                      />
                    </div>

                    <FloatingInput 
                      label="Email Address" 
                      name="email" 
                      type="email"
                      value={regData.email} 
                      onChange={(e) => setRegData({...regData, email: e.target.value})} 
                      required 
                      icon={Mail} 
                      placeholder="john@example.com"
                    />

                    <FloatingInput 
                      label="Password" 
                      name="password" 
                      type="password"
                      value={regData.password} 
                      onChange={(e) => setRegData({...regData, password: e.target.value})} 
                      required 
                      icon={Lock} 
                      placeholder="••••••••"
                    />

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Category</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['user', 'voluntier', 'coordinator'].map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setRegData({...regData, category: (cat === 'voluntier' ? 'volunteer' : cat) as any})}
                            className={cn(
                              "py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                              (regData.category === 'volunteer' ? 'voluntier' : regData.category) === cat 
                                ? "bg-orange-500 border-orange-500 text-white" 
                                : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button 
                        type="button"
                        onClick={() => setShowGetInvolved(false)}
                        className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold rounded-2xl transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className="flex-[2] py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-500/20 transition-all"
                      >
                        Register Now
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {regStep === 'anim' && (
                <div className="py-20 flex flex-col items-center justify-center space-y-8 text-center">
                  <div className="relative">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      className="w-24 h-24 border-4 border-zinc-800 border-t-orange-500 rounded-full"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="text-orange-500 animate-pulse" size={32} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold tracking-tight">Authenticating...</h3>
                    <p className="text-zinc-500 font-mono text-xs uppercase tracking-[0.2em]">{animText}</p>
                  </div>
                </div>
              )}

              {regStep === 'success' && (
                <div className="py-20 flex flex-col items-center justify-center space-y-8 text-center">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.8, ease: "backOut" }}
                    className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/20"
                  >
                    <CheckCircle2 className="text-white" size={48} />
                  </motion.div>
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">registered successful</h3>
                    <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Welcome to the Response Force, {regData.firstName}!</p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showResources ? (
        <Resources onBack={() => setShowResources(false)} />
      ) : (
        <div className="max-w-7xl mx-auto">
          {/* Page Content */}
          <main className="space-y-20">
            {/* Report a Need Section */}
            <section id="report-need">
          <div className="flex items-center gap-4 mb-8">
            <button 
              onClick={() => onLogout ? onLogout() : signOut(auth)}
              className="px-6 py-2 rounded-full border border-zinc-700 bg-transparent text-zinc-400 hover:text-white hover:border-zinc-500 transition-all font-bold uppercase tracking-widest text-xs"
            >
              Volunteer
            </button>
            <button 
              onClick={() => onLogout ? onLogout() : signOut(auth)}
              className="px-6 py-2 rounded-full border border-zinc-700 bg-transparent text-zinc-400 hover:text-white hover:border-zinc-500 transition-all font-bold uppercase tracking-widest text-xs"
            >
              Coordinator
            </button>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm"
          >
          {showSuccessAlert ? (
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ duration: 0.8, ease: "circOut" }}
              className="bg-zinc-900 border-2 border-green-500 rounded-3xl p-12 text-center shadow-[0_0_50px_rgba(34,197,94,0.3)] relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent" />
              
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12, delay: 0.4 }}
                className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 relative z-10"
              >
                <CheckCircle2 size={48} className="text-white" />
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-green-500 rounded-full"
                />
              </motion.div>

              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="text-4xl font-black text-white mb-4 tracking-tighter"
              >
                REQUEST SUBMITTED!
              </motion.h2>
              
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className="text-zinc-400 font-medium max-w-xs mx-auto"
              >
                Your help request has been successfully broadcasted to all nearby responders.
              </motion.p>
            </motion.div>
          ) : (
          <form 
            onSubmit={handleSubmit} 
            className={cn(
              "transition-all duration-500",
              loading && "authenticating-glow p-4 rounded-2xl bg-zinc-900/80"
            )}
          >
            <div className="space-y-8">
              {/* Personal & Address Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="md:col-span-2 lg:col-span-3 mb-2">
                  <button
                    type="button"
                    onClick={updateLocation}
                    disabled={locating}
                    className={cn(
                      "w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-all",
                      locating 
                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" 
                        : "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                    )}
                  >
                    {locating ? (
                      <Loader2 size={24} className="animate-spin" />
                    ) : (
                      <>
                        <Navigation size={24} />
                        LIVE CAPTURED
                      </>
                    )}
                  </button>
                </div>
                <FloatingInput
                  label="FULL NAME (OPTIONAL)"
                  name="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  icon={User}
                  placeholder="Optional"
                />
                <div className="relative">
                  <FloatingInput
                    label="Pincode (OPTIONAL)"
                    name="pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    icon={MapPin}
                    placeholder="Pincode (Optional)"
                  />
                </div>
                <FloatingInput
                  label="District"
                  name="district"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  icon={Navigation}
                  placeholder="District"
                  required
                />
                <FloatingInput
                  label="State"
                  name="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  icon={Globe}
                  placeholder="State"
                  required
                />
              </div>

              {/* Type of Assistance & Description */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Type of Assistance</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['health', 'food', 'shelter', 'education'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({ ...formData, type })}
                        className={cn(
                          "py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border",
                          formData.type === type 
                            ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20" 
                            : "bg-zinc-800/50 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest ml-1">Describe the Situation</label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Please provide details about your situation..."
                    className="w-full h-full min-h-[120px] px-4 py-3 bg-zinc-800/50 border border-zinc-700 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all outline-none text-white resize-none font-medium"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8">
              <button
                type="submit"
                disabled={loading || submitted || locating || !locationVerified}
                className={cn(
                  "w-full py-4 font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2",
                  submitted 
                    ? "bg-green-500 text-white" 
                    : (locating || !locationVerified)
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                      : "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Authenticating Request...
                  </>
                ) : locating ? (
                  <>
                    <Shield className="animate-pulse" size={20} />
                    Authenticating Location...
                  </>
                ) : submitted ? (
                  <>
                    <CheckCircle2 size={20} />
                    Submitted
                  </>
                ) : !locationVerified ? (
                  <>
                    <AlertCircle size={20} />
                    Verify Address First
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Submit Request
                  </>
                )}
              </button>
            </div>
          </form>
          )}
        </motion.div>
      </section>

      {/* User Status Section */}
      {profile && userRequest && (
        <section id="user-status" className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-xl flex items-center justify-center">
              <Activity size={20} className="text-orange-500" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Request Status</h3>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
            <div className="flex flex-col md:flex-row items-center justify-between gap-12 max-w-4xl mx-auto py-8">
              {/* Step 1: Submitted */}
              <div className="flex flex-col items-center gap-4 text-center relative">
                <div className="w-16 h-16 bg-green-500/20 border-2 border-green-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                  <CheckCircle className="text-green-500" size={32} />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-bold text-white uppercase tracking-widest">Submitted</div>
                  <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Request Received</div>
                </div>
                <div className="hidden md:block absolute top-8 -right-16 w-12 h-[2px] bg-zinc-800" />
              </div>

              {/* Step 2: Accepted */}
              <div className="flex flex-col items-center gap-4 text-center relative">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                  userRequest.status === 'in-progress' || userRequest.status === 'resolved'
                    ? "bg-blue-500/20 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                    : "bg-zinc-800 border-zinc-700 opacity-50",
                  userRequest.status === 'in-progress' && "rgb-blinking"
                )}>
                  <Activity className={cn(
                    userRequest.status === 'in-progress' || userRequest.status === 'resolved' ? "text-blue-500" : "text-zinc-500"
                  )} size={32} />
                </div>
                <div className="space-y-1">
                  <div className={cn(
                    "text-sm font-bold uppercase tracking-widest",
                    userRequest.status === 'in-progress' || userRequest.status === 'resolved' ? "text-white" : "text-zinc-500"
                  )}>Accepted</div>
                  <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Volunteer Dispatched</div>
                </div>
                <div className="hidden md:block absolute top-8 -right-16 w-12 h-[2px] bg-zinc-800" />
              </div>

              {/* Step 3: Resolved */}
              <div className="flex flex-col items-center gap-4 text-center relative">
                <div className={cn(
                  "w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                  userRequest.status === 'resolved'
                    ? "bg-orange-500/20 border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                    : "bg-zinc-800 border-zinc-700 opacity-50",
                  userRequest.status === 'resolved' && "rgb-blinking"
                )}>
                  <Sparkles className={cn(
                    userRequest.status === 'resolved' ? "text-orange-500" : "text-zinc-500"
                  )} size={32} />
                </div>
                <div className="space-y-1">
                  <div className={cn(
                    "text-sm font-bold uppercase tracking-widest",
                    userRequest.status === 'resolved' ? "text-white" : "text-zinc-500"
                  )}>Resolved</div>
                  <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Mission Complete</div>
                </div>
              </div>
            </div>

            {/* Current Status Details */}
            <div className="mt-12 p-6 bg-zinc-800/30 border border-zinc-700/50 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="text-orange-500" size={24} />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mb-1">Current Operation</div>
                  <div className="text-lg font-bold text-white tracking-tight">{userRequest.description}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Status</div>
                  <div className="text-xs font-bold text-orange-500 uppercase tracking-widest">{userRequest.status}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center animate-pulse">
                  <ArrowRight className="text-white" size={20} />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Q&A Section */}
      <section className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h2>
          <p className="text-zinc-500 mt-2">Quick answers to common coordination queries</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <FAQItem 
            question="How fast is the response time?" 
            answer="Our system prioritizes urgent medical needs immediately. Most requests are assigned to a volunteer within 15-30 minutes." 
          />
          <FAQItem 
            question="Is my location data secure?" 
            answer="Yes, your exact location is only shared with verified coordinators and the assigned volunteer for your specific task." 
          />
          <FAQItem 
            question="Can I update my request?" 
            answer="You can update the description or status of your request at any time from your dashboard." 
          />
          <FAQItem 
            question="How do I become a volunteer?" 
            answer="Click the 'Get Involved' button to apply. Our team will verify your credentials and assign you to the operational layer." 
          />
        </div>
      </section>
    </main>
    </div>
    )}
    </div>
  );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-zinc-800/50 transition-colors"
      >
        <span className="font-semibold text-zinc-200">{question}</span>
        {isOpen ? <ChevronUp size={18} className="text-orange-500" /> : <ChevronDown size={18} className="text-zinc-500" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "circOut" }}
            className="px-6 pb-4 text-zinc-400 text-sm leading-relaxed"
          >
            {answer}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
