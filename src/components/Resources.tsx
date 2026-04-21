import React, { useState } from 'react';
import { AlertCircle, BookOpen, CheckSquare, Map as MapIcon, HelpCircle, FileText, Phone, Download, ShieldAlert, Navigation, ChevronDown, ChevronUp, Send, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const TABS = [
  { id: 'alerts', label: 'Emergency Alerts', icon: AlertCircle },
  { id: 'resources', label: 'Resource Center', icon: BookOpen },
  { id: 'planning', label: 'Planning Tools', icon: CheckSquare },
  { id: 'map', label: 'Interactive Map', icon: MapIcon },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'report', label: 'Reporting Tools', icon: FileText },
];

export default function Resources({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState('alerts');

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-12">
      <header className="space-y-4 text-center relative">
        {onBack && (
          <button 
            onClick={onBack}
            className="absolute left-0 top-0 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-bold text-sm uppercase tracking-widest">Back to Portal</span>
          </button>
        )}
        <h1 className="text-5xl font-black text-white uppercase tracking-tighter pt-12 md:pt-0">Disaster Management <span className="text-orange-500">Resources</span></h1>
        <p className="text-zinc-400 max-w-2xl mx-auto text-lg">Access critical information, tools, and support for emergency preparedness and response.</p>
      </header>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap justify-center gap-2 border-b border-zinc-800 pb-4">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all ${
                isActive 
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                  : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'alerts' && <EmergencyAlerts />}
            {activeTab === 'resources' && <ResourceCenter />}
            {activeTab === 'planning' && <PlanningTools />}
            {activeTab === 'map' && <InteractiveMap />}
            {activeTab === 'faq' && <FAQSection />}
            {activeTab === 'report' && <ReportingTools />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Tab Components ---

function EmergencyAlerts() {
  const alerts = [
    { id: 1, type: 'critical', title: 'Cyclone Warning: Coastal Region', time: '10 mins ago', desc: 'Evacuation ordered for low-lying areas in the coastal belt. Seek higher ground immediately.' },
    { id: 2, type: 'warning', title: 'Heavy Rainfall Alert', time: '2 hours ago', desc: 'Expect severe waterlogging in urban areas. Avoid unnecessary travel.' },
    { id: 3, type: 'info', title: 'Relief Camp Opened', time: '5 hours ago', desc: 'New relief camp operational at City Central School with food and medical supplies.' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2"><AlertCircle className="text-red-500" /> Live Emergency Alerts</h2>
      <div className="space-y-4">
        {alerts.map(alert => (
          <div key={alert.id} className={`p-6 rounded-2xl border ${
            alert.type === 'critical' ? 'bg-red-500/10 border-red-500/30' : 
            alert.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' : 
            'bg-blue-500/10 border-blue-500/30'
          }`}>
            <div className="flex justify-between items-start mb-2">
              <h3 className={`text-xl font-bold ${
                alert.type === 'critical' ? 'text-red-400' : 
                alert.type === 'warning' ? 'text-yellow-400' : 
                'text-blue-400'
              }`}>{alert.title}</h3>
              <span className="text-xs text-zinc-400 font-mono">{alert.time}</span>
            </div>
            <p className="text-zinc-300">{alert.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResourceCenter() {
  const contacts = [
    { name: 'National Emergency Number', number: '112' },
    { name: 'Police', number: '100' },
    { name: 'Fire Brigade', number: '101' },
    { name: 'Ambulance', number: '102' },
    { name: 'Disaster Management Services', number: '108' },
    { name: 'Women Helpline', number: '1091' },
  ];

  const guidelines = [
    { title: 'Earthquake Safety Guide', size: '2.4 MB PDF' },
    { title: 'Flood Preparedness Manual', size: '1.8 MB PDF' },
    { title: 'First Aid Basic Instructions', size: '3.1 MB PDF' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Phone className="text-orange-500" /> Helpline Numbers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {contacts.map((contact, idx) => (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center justify-center text-center hover:border-orange-500/50 transition-colors">
              <span className="text-zinc-400 text-sm mb-1">{contact.name}</span>
              <span className="text-2xl font-black text-white tracking-widest">{contact.number}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><BookOpen className="text-blue-500" /> Guidelines & Manuals</h2>
        <div className="space-y-4">
          {guidelines.map((guide, idx) => (
            <div key={idx} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between hover:bg-zinc-800 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500">
                  <FileText size={20} />
                </div>
                <div>
                  <h4 className="text-white font-bold">{guide.title}</h4>
                  <span className="text-xs text-zinc-500">{guide.size}</span>
                </div>
              </div>
              <button className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-orange-500 transition-colors">
                <Download size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanningTools() {
  const [checklist, setChecklist] = useState([
    { id: 1, text: 'Water (one gallon per person per day for at least three days)', checked: false },
    { id: 2, text: 'Food (at least a three-day supply of non-perishable food)', checked: false },
    { id: 3, text: 'Battery-powered or hand crank radio and a NOAA Weather Radio', checked: false },
    { id: 4, text: 'Flashlight and extra batteries', checked: false },
    { id: 5, text: 'First aid kit', checked: false },
    { id: 6, text: 'Whistle to signal for help', checked: false },
    { id: 7, text: 'Dust mask to help filter contaminated air', checked: false },
    { id: 8, text: 'Moist towelettes, garbage bags and plastic ties for personal sanitation', checked: false },
  ]);

  const toggleCheck = (id: number) => {
    setChecklist(checklist.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const progress = Math.round((checklist.filter(i => i.checked).length / checklist.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">Emergency Kit Checklist</h2>
        <p className="text-zinc-400">Prepare your basic disaster supplies kit.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">Preparedness Level</span>
          <span className="text-sm font-bold text-orange-500">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-orange-500"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="space-y-3 mt-8">
          {checklist.map(item => (
            <div 
              key={item.id} 
              onClick={() => toggleCheck(item.id)}
              className={`flex items-start gap-4 p-4 rounded-xl cursor-pointer transition-colors ${
                item.checked ? 'bg-green-500/10 border border-green-500/20' : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
              }`}
            >
              <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                item.checked ? 'bg-green-500 border-green-500 text-white' : 'border-zinc-600 bg-zinc-900'
              }`}>
                {item.checked && <CheckSquare size={14} />}
              </div>
              <span className={`${item.checked ? 'text-zinc-300 line-through opacity-70' : 'text-zinc-200'}`}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InteractiveMap() {
  // Default center (e.g., a central location)
  const center: [number, number] = [20.5937, 78.9629]; // India center as example

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2"><MapIcon className="text-orange-500" /> Disaster Risk & Relief Map</h2>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 opacity-50"></div> Risk Area</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Relief Camp</div>
          <div className="flex items-center gap-2"><div className="w-4 h-1 bg-green-500"></div> Safe Route</div>
        </div>
      </div>
      
      <div className="h-[500px] w-full rounded-3xl overflow-hidden border border-zinc-800 relative z-0">
        <MapContainer center={center} zoom={5} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            className="map-tiles"
          />
          
          {/* Example Risk Area */}
          <Circle center={[19.0760, 72.8777]} pathOptions={{ color: 'red', fillColor: 'red', fillOpacity: 0.2 }} radius={50000}>
            <Popup>High Flood Risk Zone</Popup>
          </Circle>

          {/* Example Relief Camp */}
          <Marker position={[18.5204, 73.8567]}>
            <Popup>
              <strong>Central Relief Camp</strong><br/>
              Capacity: 500<br/>
              Status: Open
            </Popup>
          </Marker>

          {/* Example Safe Route */}
          <Polyline pathOptions={{ color: 'green', weight: 4 }} positions={[
            [19.0760, 72.8777],
            [18.5204, 73.8567]
          ]} />
        </MapContainer>
      </div>
    </div>
  );
}

function FAQSection() {
  const faqs = [
    { q: "What should I do during an earthquake?", a: "Drop, Cover, and Hold On. Drop to your hands and knees. Cover your head and neck with your arms. Hold on to any sturdy furniture until the shaking stops. If you are outdoors, stay away from buildings, streetlights, and utility wires." },
    { q: "How do I prepare for a flood?", a: "Build an emergency kit, make a family communications plan, and elevate critical utilities. If a flood is likely in your area, listen to the radio or television for information and be ready to evacuate." },
    { q: "Where can I find the nearest relief camp?", a: "You can use the 'Interactive Map' section in this Resource Center to locate the nearest active relief camps, or call the National Emergency Number (112) for immediate guidance." },
    { q: "How can I volunteer to help?", a: "Go to the 'Get Involved' section on the main portal and register as a volunteer. You will be matched with NGOs and local authorities based on your skills and location." },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-white text-center">Frequently Asked Questions</h2>
      <div className="space-y-4">
        {faqs.map((faq, idx) => (
          <FAQItem key={idx} question={faq.q} answer={faq.a} />
        ))}
      </div>
    </div>
  );
}

const FAQItem = ({ question, answer, key }: { question: string, answer: string, key?: any }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-zinc-800 transition-colors"
      >
        <span className="font-bold text-white">{question}</span>
        {isOpen ? <ChevronUp className="text-zinc-500" /> : <ChevronDown className="text-zinc-500" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-6 pb-4 text-zinc-400"
          >
            {answer}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ReportingTools() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2"><ShieldAlert className="text-yellow-500" /> Public Incident Reporting</h2>
        <p className="text-zinc-400">Report hazards, damages, or emergencies to help authorities respond faster.</p>
      </div>

      <form className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-6" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Incident Type</label>
            <select className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors">
              <option>Flood / Waterlogging</option>
              <option>Building Collapse</option>
              <option>Fire</option>
              <option>Medical Emergency</option>
              <option>Road Blockage</option>
              <option>Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Location</label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Enter address or landmark" 
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 pl-10 text-white focus:outline-none focus:border-orange-500 transition-colors"
              />
              <Navigation size={16} className="absolute left-4 top-3.5 text-zinc-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Description</label>
            <textarea 
              rows={4}
              placeholder="Describe the situation..." 
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors resize-none"
            ></textarea>
          </div>
        </div>

        <button className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors">
          <Send size={18} />
          Submit Report
        </button>
        <p className="text-xs text-center text-zinc-500">For immediate life-threatening emergencies, please call 112.</p>
      </form>
    </div>
  );
}
