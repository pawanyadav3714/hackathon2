import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Loader2, Users, AlertTriangle, CheckCircle, Activity, Filter, Map as MapIcon, BarChart3, Sparkles, Maximize2, ChevronDown, Globe, Mail, Phone, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { analyzeNeeds } from '../services/aiService';
import { AnimatedFilter } from './ui/AnimatedFilter';
import VolunteerList from './VolunteerList';

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

// Custom Marker Icons
const getIcon = (color: string) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const blueIcon = getIcon('blue');
const greenIcon = getIcon('green');
const yellowIcon = getIcon('gold');

function MapBoundsHandler({ needs }: { needs: Need[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (needs.length > 0) {
      const validNeeds = needs.filter(n => n.location.lat !== 0 && n.location.lng !== 0);
      if (validNeeds.length > 0) {
        const bounds = L.latLngBounds(validNeeds.map(n => [n.location.lat, n.location.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [needs, map]);

  return null;
}

interface Need {
  id: string;
  userId: string;
  type: 'health' | 'education' | 'food' | 'shelter' | 'other';
  description: string;
  location: { lat: number, lng: number };
  status: 'pending' | 'in-progress' | 'resolved';
  createdAt: any;
}

export default function CoordinationLayer({ profile }: { profile: any }) {
  const [needs, setNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'health' | 'education' | 'food' | 'shelter' | 'other'>('all');

  // AI Recommendations State
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'needs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const needData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Need));
      setNeeds(needData);
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'needs'));

    return () => unsubscribe();
  }, []);

  const handleAiAnalyze = async () => {
    if (needs.length === 0) return;
    setAiAnalyzing(true);
    const recs = await analyzeNeeds(needs);
    // Add a specific hotspot analysis recommendation
    const hotspots = needs.reduce((acc: any, need) => {
      const key = `${need.location.lat.toFixed(1)},${need.location.lng.toFixed(1)}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const topHotspot = Object.entries(hotspots).sort((a: any, b: any) => b[1] - a[1])[0];
    if (topHotspot) {
      recs.unshift(`🚨 CRITICAL HOTSPOT: High density of requests detected at ${topHotspot[0]}. Immediate deployment recommended.`);
    }
    setRecommendations(recs);
    setAiAnalyzing(false);
  };

  const getMarkerColor = (type: string) => {
    switch (type) {
      case 'health': return '#ef4444';
      case 'food': return '#22c55e';
      case 'shelter': return '#3b82f6';
      case 'education': return '#a855f7';
      default: return '#f97316';
    }
  };

  const stats = {
    total: needs.length,
    pending: needs.filter(n => n.status === 'pending').length,
    inProgress: needs.filter(n => n.status === 'in-progress').length,
    // Counting both in-progress and resolved as "Actioned/Resolved" per user request
    resolved: needs.filter(n => n.status === 'in-progress' || n.status === 'resolved').length,
  };

  const filteredNeeds = needs.filter(n => filter === 'all' || n.type === filter);

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      <header className="mb-12 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Activity className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white uppercase italic">Coordination Layer</h1>
            <p className="text-zinc-500 font-mono text-xs uppercase tracking-[0.2em]">Strategic Oversight // AI-Driven Insights</p>
          </div>
        </div>
      </header>

      <main className="space-y-8">
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
          icon={<CheckCircle className="text-green-500" size={20} />} 
          color="green" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Map Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <MapIcon className="text-orange-500" />
              Geospatial Resource Map
            </h3>
            <AnimatedFilter 
              label="Filter by Type"
              value={filter}
              onChange={(v) => setFilter(v as any)}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'health', label: 'Health' },
                { value: 'food', label: 'Food' },
                { value: 'shelter', label: 'Shelter' },
                { value: 'education', label: 'Education' },
                { value: 'other', label: 'Other' }
              ]}
            />
          </div>
          
          <div className="h-[600px] w-full bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative z-0">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm z-10">
                <Loader2 className="animate-spin text-orange-500" size={32} />
              </div>
            ) : (
              <MapContainer 
                center={[20.5937, 78.9629]} 
                zoom={5} 
                scrollWheelZoom={true}
                className="h-full w-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <MapBoundsHandler needs={filteredNeeds} />
                {filteredNeeds.map((need) => (
                  <Marker 
                    key={need.id} 
                    position={[need.location.lat, need.location.lng]}
                    icon={need.status === 'resolved' ? greenIcon : need.status === 'in-progress' ? blueIcon : yellowIcon}
                  >
                    <Popup className="custom-popup">
                      <div className="p-4 space-y-3 text-xs text-zinc-200">
                        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2">
                          <div className="font-bold text-orange-500 uppercase tracking-wider">{need.name || 'Anonymous'}</div>
                          <div className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                            need.status === 'pending' ? "bg-red-500/20 text-red-500" :
                            need.status === 'in-progress' ? "bg-blue-500/20 text-blue-500" : "bg-green-500/20 text-green-500"
                          )}>
                            {need.status}
                          </div>
                        </div>
                        <div className="text-zinc-400 font-bold">NEED: <span className="text-white">{need.type.toUpperCase()}</span></div>
                        <p className="text-zinc-300 italic leading-relaxed">{need.description}</p>
                        <div className="text-[10px] text-zinc-500 font-mono pt-2 border-t border-zinc-800/50 flex items-center gap-1">
                          <Clock size={10} />
                          Sent: {need.createdAt?.toDate().toLocaleString()}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        </div>

        {/* Analytics Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="text-orange-500" />
            Operational Insights
          </h3>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-6 h-[600px] overflow-y-auto space-y-6">
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Resource Distribution</h4>
              <div className="space-y-3">
                <DistributionBar label="Health" count={needs.filter(n => n.type === 'health').length} total={needs.length} color="bg-red-500" />
                <DistributionBar label="Food" count={needs.filter(n => n.type === 'food').length} total={needs.length} color="bg-green-500" />
                <DistributionBar label="Shelter" count={needs.filter(n => n.type === 'shelter').length} total={needs.length} color="bg-blue-500" />
                <DistributionBar label="Education" count={needs.filter(n => n.type === 'education').length} total={needs.length} color="bg-purple-500" />
                <DistributionBar label="Other" count={needs.filter(n => n.type === 'other').length} total={needs.length} color="bg-orange-500" />
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-zinc-800">
              <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Recent Activity Log</h4>
              <div className="space-y-4">
                {needs.slice(0, 5).map((need) => (
                  <div key={need.id} className="flex gap-3 items-start">
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-1.5 shrink-0",
                      need.status === 'pending' ? "bg-yellow-500" :
                      need.status === 'in-progress' ? "bg-blue-500" : "bg-green-500"
                    )} />
                    <div>
                      <p className="text-sm font-medium text-zinc-200 line-clamp-1">{need.description}</p>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
                        {need.type} // {need.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl space-y-2">
              <h4 className="text-sm font-bold text-orange-500">System Recommendation</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Based on current trends, we recommend deploying additional medical volunteers to the high-density clusters identified on the map.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <VolunteerList />

      {/* AI Strategic Insights Banner */}
      <AnimatePresence>
        {needs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            className="bg-orange-500/10 border border-orange-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Sparkles className="text-white" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-orange-500">AI Strategic Recommendations</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono">Analyzing {needs.length} real-time data points</p>
              </div>
            </div>
            
            <div className="flex-1 max-w-2xl">
              {aiAnalyzing ? (
                <div className="flex items-center gap-2 text-zinc-500 text-sm italic">
                  <Loader2 className="animate-spin" size={16} />
                  Gemini is processing operational data...
                </div>
              ) : recommendations.length > 0 ? (
                <ul className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-zinc-300 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 leading-relaxed">
                      {rec}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-400">Click analyze to generate AI-driven resource allocation strategies.</p>
              )}
            </div>

            <button 
              onClick={handleAiAnalyze}
              disabled={aiAnalyzing}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-orange-500/20 disabled:opacity-50"
            >
              {aiAnalyzing ? 'Analyzing...' : 'Analyze Data'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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

function DistributionBar({ label, count, total, color }: { label: string, count: number, total: number, color: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
        <span className="text-zinc-400">{label}</span>
        <span className="text-zinc-500">{count} ({percentage.toFixed(0)}%)</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "circOut" }}
          className={cn("h-full rounded-full", color)}
        />
      </div>
    </div>
  );
}
