import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, MapPin, Clock, CheckCircle2, AlertCircle, AlertTriangle, Users, Activity, Phone, Navigation, Filter, Search, Sparkles, Copy, X, ChevronDown, Shield, Globe, Mail, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { AnimatedFilter } from './ui/AnimatedFilter';
import VolunteerList from './VolunteerList';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// Blinking Icon for Live Tracking
const blinkingIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `<div class="blinking-dot"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

interface Need {
  id: string;
  userId: string;
  name: string;
  phone: string;
  district: string;
  pincode: string;
  state: string;
  type: 'health' | 'education' | 'food' | 'shelter' | 'other';
  description: string;
  location: { lat: number, lng: number };
  status: 'pending' | 'in-progress' | 'resolved';
  createdAt: any;
}

export default function OperationalLayer({ profile }: { profile: any }) {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'resolved'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [selectedNeed, setSelectedNeed] = useState<Need | null>(null);
  const [dispatchNeed, setDispatchNeed] = useState<Need | null>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      });
    }

    const q = query(
      collection(db, 'needs'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const needData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Need));
      setNeeds(needData);
      setLoading(false);
      
      // Auto-open first pending need on initial load
      if (!hasAutoOpened) {
        const firstPending = needData.find(n => n.status === 'pending');
        if (firstPending) {
          setDispatchNeed(firstPending);
          setHasAutoOpened(true);
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'needs'));

    return () => unsubscribe();
  }, []);

  const updateStatus = async (need: Need, newStatus: 'in-progress' | 'resolved') => {
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: serverTimestamp()
      };
      
      if (newStatus === 'in-progress' && profile) {
        updateData.volunteerId = profile.uid;
        updateData.volunteerName = `${profile.firstName} ${profile.lastName}`;
        
        // Create volunteer record
        await addDoc(collection(db, 'volunteerRecords'), {
          volunteerId: profile.uid,
          volunteerName: `${profile.firstName} ${profile.lastName}`,
          needId: need.id,
          userName: need.name || 'Anonymous',
          userQuery: need.description || '',
          acceptedAt: serverTimestamp()
        });
      }
      
      await updateDoc(doc(db, 'needs', need.id), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `needs/${need.id}`);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d.toFixed(1);
  };

  const filteredNeeds = needs.filter(need => {
    const matchesFilter = filter === 'all' || need.status === filter;
    const matchesSearch = need.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         need.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: needs.length,
    pending: needs.filter(n => n.status === 'pending').length,
    inProgress: needs.filter(n => n.status === 'in-progress').length,
    // Counting both in-progress and resolved as "Actioned/Resolved" per user request
    resolved: needs.filter(n => n.status === 'in-progress' || n.status === 'resolved').length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-20">
      <header className="mb-12 space-y-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white uppercase italic">Operational Layer</h1>
            <p className="text-zinc-500 font-mono text-xs uppercase tracking-[0.2em]">Volunteer Response Force // Active Deployment</p>
          </div>
        </div>
      </header>

      <main className="space-y-8">
        {/* Live Operations Heat Map */}
        <div className="relative h-[500px] w-full bg-zinc-950 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl z-0">
          <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
            <div className="px-4 py-2 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-xl shadow-xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live Dispatch Feed</span>
              </div>
            </div>
          </div>

          <MapContainer 
            center={[20.5937, 78.9629]} 
            zoom={5} 
            scrollWheelZoom={true}
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {needs.filter(n => n.status === 'pending').map((need) => (
              <Marker 
                key={need.id} 
                position={[need.location.lat, need.location.lng]}
                icon={blinkingIcon}
                eventHandlers={{
                  click: () => setDispatchNeed(need),
                }}
              />
            ))}

            {dispatchNeed && (
              <Popup 
                position={[dispatchNeed.location.lat, dispatchNeed.location.lng]}
                onClose={() => setDispatchNeed(null)}
                className="custom-dispatch-popup"
                maxWidth={320}
              >
                <div className="p-3 space-y-3 bg-zinc-900 text-white rounded-xl min-w-[280px]">
                  <div className="flex items-start justify-between border-b border-zinc-800 pb-2">
                    <div className="space-y-0.5">
                      <p className="font-black text-orange-500 text-sm uppercase tracking-tighter italic">{dispatchNeed.name || 'Anonymous'}</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{dispatchNeed.type}</span>
                        <span className="text-zinc-700">•</span>
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{dispatchNeed.district}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-zinc-500 font-mono uppercase">Reported</p>
                      <p className="text-[10px] text-white font-mono">
                        {dispatchNeed.createdAt ? format(dispatchNeed.createdAt.toDate(), 'HH:mm:ss') : 'LIVE'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800">
                    <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                      <MessageSquare size={10} className="text-orange-500" />
                      Query
                    </div>
                    <p className="text-[11px] text-zinc-200 italic leading-relaxed">
                      "{dispatchNeed.description}"
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Live GPS</span>
                    <span className="ml-auto font-mono text-[9px] text-zinc-500">
                      {dispatchNeed.location.lat.toFixed(4)}, {dispatchNeed.location.lng.toFixed(4)}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button 
                      onClick={() => {
                        updateStatus(dispatchNeed, 'in-progress');
                        setDispatchNeed(null);
                      }}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-blue-600/20 text-[10px] flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 size={14} />
                      Accept
                    </button>
                    <button 
                      onClick={() => setDispatchNeed(null)}
                      className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-black uppercase tracking-widest rounded-lg transition-all border border-zinc-700 text-[10px] flex items-center justify-center gap-1.5"
                    >
                      <X size={14} />
                      Decline
                    </button>
                  </div>
                </div>
              </Popup>
            )}
          </MapContainer>

          {/* Dispatch Stats Overlay */}
          <div className="absolute bottom-6 right-6 z-10">
            <div className="px-4 py-3 bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl shadow-2xl space-y-2">
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-orange-500" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Active Operations</span>
              </div>
              <div className="flex gap-4">
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold">Pending</p>
                  <p className="text-lg font-black text-white font-mono leading-none">{stats.pending}</p>
                </div>
                <div className="w-px h-8 bg-zinc-800" />
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold">In-Progress</p>
                  <p className="text-lg font-black text-blue-500 font-mono leading-none">{stats.inProgress}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard 
            label="Total Requests" 
            value={stats.total} 
            icon={<Activity className="text-zinc-400" size={20} />} 
            color="zinc" 
          />
          <StatCard 
            label="Pending Cases" 
            value={stats.pending} 
            icon={<AlertCircle className="text-orange-500" size={20} />} 
            color="orange" 
          />
          <StatCard 
            label="Active Dispatches" 
            value={stats.inProgress} 
            icon={<Clock className="text-yellow-500" size={20} />} 
            color="yellow" 
          />
          <StatCard 
            label="Resolved Cases" 
            value={stats.resolved} 
            icon={<CheckCircle2 className="text-green-500" size={20} />} 
            color="green" 
          />
        </div>

        {/* AI Task Prioritization Banner */}
        <div className="bg-zinc-900 border border-zinc-800 shadow-sm rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
            <Sparkles className="text-orange-600" size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">AI Task Prioritization</h4>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Optimizing response for maximum impact</p>
          </div>
        </div>
        <div className="text-xs text-zinc-500 italic">
          "Prioritize Health requests within 5km of your current location."
        </div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-white">Active Operations</h2>
          <p className="text-zinc-500 text-sm">Real-time task coordination for on-ground volunteers</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm transition-all text-white"
            />
          </div>
          <AnimatedFilter 
            label="Status Filter"
            value={filter}
            onChange={(v) => setFilter(v as any)}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'pending', label: 'Pending' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' }
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-orange-500" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredNeeds.map((need) => (
              <motion.div
                key={need.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.6, ease: "circOut" }}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 space-y-4 hover:border-zinc-700 transition-colors shadow-sm group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border w-fit",
                      need.type === 'health' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                      need.type === 'food' ? "bg-green-500/10 border-green-500/20 text-green-500" :
                      need.type === 'shelter' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                      "bg-orange-500/10 border-orange-500/20 text-orange-500"
                    )}>
                      {need.type}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                      {need.createdAt ? format(need.createdAt.toDate(), 'dd/MM/yyyy HH:mm') : 'just now'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                    <Clock size={12} />
                    {need.createdAt ? formatDistanceToNow(need.createdAt.toDate()) : 'just now'} ago
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold line-clamp-2 group-hover:text-orange-600 transition-colors leading-tight text-white">{need.description}</h3>
                    <div className="flex items-center gap-2 text-xs text-zinc-600 font-medium">
                      <span className="text-orange-600">Victim:</span> {need.name || 'Anonymous'}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <div className="grid grid-cols-2 gap-2 mb-2 pb-2 border-b border-zinc-800">
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">District</span>
                        <p className="text-[10px] text-zinc-700 font-bold uppercase">{need.district || 'N/A'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">State</span>
                        <p className="text-[10px] text-zinc-700 font-bold uppercase">{need.state || 'N/A'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">Pincode</span>
                        <p className="text-[10px] text-zinc-700 font-bold font-mono">{need.pincode || 'N/A'}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-bold">Phone</span>
                        <p className="text-[10px] text-zinc-700 font-bold font-mono">{need.phone || 'N/A'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-1">
                        <MapPin size={12} className="text-orange-500" />
                        Coordinates
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(`${need.location.lat}, ${need.location.lng}`);
                        }}
                        className="p-1 text-zinc-500 hover:text-zinc-700 transition-colors"
                        title="Copy Coordinates"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                      <span className="font-mono text-[10px] bg-zinc-950 px-2 py-1 rounded border border-zinc-800 w-full text-center">
                        {need.location.lat.toFixed(6)}, {need.location.lng.toFixed(6)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      {userLocation && (
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold flex items-center gap-1">
                          <Navigation size={10} className="text-blue-500" />
                          {calculateDistance(userLocation.lat, userLocation.lng, need.location.lat, need.location.lng)} km away
                        </span>
                      )}
                      <div className="flex gap-3 ml-auto">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNeed(need);
                          }}
                          className="text-[10px] font-bold text-blue-500 uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                          <MapPin size={10} />
                          View on Map
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`https://www.google.com/maps/search/?api=1&query=${need.location.lat},${need.location.lng}`, '_blank');
                          }}
                          className="text-[10px] font-bold text-orange-500 uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                          <Navigation size={10} />
                          Navigate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Status</span>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-[0.2em]",
                      need.status === 'pending' ? "text-yellow-600" :
                      need.status === 'in-progress' ? "text-blue-600" : "text-green-600"
                    )}>
                      {need.status}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    {need.status === 'pending' && (
                      <button 
                        onClick={() => updateStatus(need, 'in-progress')}
                        className="flex-1 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        <Navigation size={16} />
                        Accept Task
                      </button>
                    )}
                    {need.status === 'in-progress' && (
                      <button 
                        onClick={() => updateStatus(need, 'resolved')}
                        className="flex-1 py-3 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 rounded-xl text-xs font-black uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        <CheckCircle2 size={16} />
                        Mark Resolved
                      </button>
                    )}
                    <button className="p-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all border border-zinc-700">
                      <Phone size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredNeeds.length === 0 && (
            <div className="col-span-full py-20 text-center bg-zinc-950 rounded-3xl border border-zinc-800 border-dashed">
              <AlertCircle className="mx-auto text-zinc-400 mb-4" size={48} />
              <p className="text-zinc-500">No active tasks found matching your criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* Map Modal */}
      <AnimatePresence>
        {selectedNeed && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              onClick={() => setSelectedNeed(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.7, ease: "circOut" }}
              className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Task Location</h3>
                  <p className="text-xs text-zinc-500 truncate max-w-[300px]">{selectedNeed.description}</p>
                </div>
                <button 
                  onClick={() => setSelectedNeed(null)}
                  className="p-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-500 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="h-[400px] w-full relative z-0">
                <MapContainer 
                  center={[selectedNeed.location.lat, selectedNeed.location.lng]} 
                  zoom={15} 
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[selectedNeed.location.lat, selectedNeed.location.lng]}>
                    <Popup>
                      <div className="text-xs font-bold">{selectedNeed.type.toUpperCase()}</div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>

              <div className="p-4 bg-zinc-950 flex items-center justify-between border-t border-zinc-800">
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <MapPin size={14} className="text-orange-600" />
                  {selectedNeed.location.lat.toFixed(6)}, {selectedNeed.location.lng.toFixed(6)}
                </div>
                <button 
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${selectedNeed.location.lat},${selectedNeed.location.lng}`, '_blank')}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2"
                >
                  <Navigation size={14} />
                  Open in Google Maps
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        <VolunteerList />
      </main>

      {/* Page Footer */}
      <footer className="mt-20 pt-12 border-t border-zinc-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="font-bold text-xl text-white uppercase tracking-tighter">DM</span>
              </div>
              <span className="text-xl font-black tracking-tighter text-white uppercase">Disaster Management</span>
            </div>
            <p className="text-zinc-500 text-sm max-w-sm leading-relaxed">
              Our mission is to bridge the gap between those in need and those who can help during critical times. Leveraging AI and community coordination to save lives.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:border-orange-500 transition-colors cursor-pointer">
                <Globe size={14} className="text-zinc-400" />
              </div>
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:border-orange-500 transition-colors cursor-pointer">
                <Mail size={14} className="text-zinc-400" />
              </div>
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:border-orange-500 transition-colors cursor-pointer">
                <Phone size={14} className="text-zinc-400" />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">Platform</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li className="hover:text-orange-500 transition-colors cursor-pointer">Resource Map</li>
              <li className="hover:text-orange-500 transition-colors cursor-pointer">Volunteer Network</li>
              <li className="hover:text-orange-500 transition-colors cursor-pointer">NGO Coordination</li>
              <li className="hover:text-orange-500 transition-colors cursor-pointer">AI Strategic Analysis</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-white">Support</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li className="hover:text-orange-500 transition-colors cursor-pointer">Help Center</li>
              <li className="hover:text-orange-500 transition-colors cursor-pointer">Emergency Contacts</li>
              <li className="hover:text-orange-500 transition-colors cursor-pointer">Privacy Policy</li>
              <li className="hover:text-orange-500 transition-colors cursor-pointer">Terms of Service</li>
            </ul>
          </div>
        </div>
        
        <div className="py-8 border-t border-zinc-900 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">
            © 2026 Disaster Management Portal // All Rights Reserved
          </p>
          <div className="flex items-center gap-6">
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">Status: Secure</span>
            <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">Region: Global</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
  const isPending = label.toLowerCase().includes('pending') && value > 0;
  const isActive = label.toLowerCase().includes('active') && value > 0;
  const isResolved = (label.toLowerCase().includes('resolved') || label.toLowerCase().includes('actioned')) && value > 0;

  return (
    <motion.div 
      whileHover={{ y: -5, transition: { duration: 0.4 } }}
      className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 space-y-2 shadow-lg relative overflow-hidden"
    >
      {isPending && (
        <div className="absolute top-0 right-0 p-2">
          <div className="w-3 h-3 bg-red-600 rounded-full animate-[ping_0.4s_infinite] shadow-[0_0_20px_rgba(220,38,38,1)]" />
        </div>
      )}
      {isActive && (
        <div className="absolute top-0 right-0 p-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-[ping_0.2s_infinite] shadow-[0_0_25px_rgba(34,197,94,1)]" />
        </div>
      )}
      {isResolved && (
        <div className="absolute top-0 right-0 p-2">
          <div className="w-3 h-3 bg-green-500 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.8)]" />
        </div>
      )}

      <div className="flex items-center justify-between">
        {icon}
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Live Data</span>
      </div>
      <div>
        <h4 className="text-3xl font-bold tracking-tight text-white">{value}</h4>
        <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">{label}</p>
      </div>
    </motion.div>
  );
}
