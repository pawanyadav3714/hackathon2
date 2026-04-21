/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import Auth from './components/Auth';
import UserLayer from './components/UserLayer';
import OperationalLayer from './components/OperationalLayer';
import CoordinationLayer from './components/CoordinationLayer';
import { Loader2, LogOut, LayoutDashboard, User as UserIcon, ClipboardList, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { Toaster } from 'sonner';

type AppRole = 'user' | 'volunteer' | 'coordinator';

interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AppRole;
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setCurrentTab] = useState<'user' | 'volunteer' | 'coordinator'>('user');
  const [isGuest, setIsGuest] = useState(false);

  const setActiveTab = (tab: 'user' | 'volunteer' | 'coordinator', userRole?: AppRole) => {
    const role = userRole || profile?.role;
    if (role === 'coordinator' && tab !== 'coordinator') return;
    setCurrentTab(tab);
  };
  const [showLoginSuccess, setShowLoginSuccess] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = undefined;
      }
      
      if (firebaseUser) {
        // Check if we just logged in
        if (sessionStorage.getItem('just_logged_in') === 'true') {
          setShowLoginSuccess(true);
          sessionStorage.removeItem('just_logged_in');
          setTimeout(() => setShowLoginSuccess(false), 800);
        }
        try {
          unsubscribeProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data() as UserProfile;
              setProfile(data);
              // Set initial tab based on role if not already set
              const loginRole = sessionStorage.getItem('login_role');
              const isDefaultAdmin = firebaseUser.email === 'beaconsos123@gmail.com';
              
              let targetTab = data.role;
              if (loginRole) {
                if (loginRole === 'coordinator' && (data.role === 'coordinator' || isDefaultAdmin)) {
                  targetTab = 'coordinator';
                } else if (loginRole === 'volunteer' && (data.role === 'volunteer' || isDefaultAdmin)) {
                  targetTab = 'volunteer';
                } else if (loginRole === 'user') {
                  targetTab = 'user';
                }
                sessionStorage.removeItem('login_role');
              }

              if (targetTab === 'coordinator') {
                setActiveTab('coordinator', data.role);
              } else if (targetTab === 'volunteer') {
                setActiveTab('volunteer', data.role);
              } else {
                setActiveTab('user', data.role);
              }
              setLoading(false);
            } else {
              // Wait a bit to see if Auth.tsx creates the document
              setTimeout(async () => {
                const retryDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (!retryDoc.exists()) {
                  // New user from Google Auth (if Auth.tsx didn't handle it)
                  const newProfile: UserProfile = {
                    uid: firebaseUser.uid,
                    firstName: firebaseUser.displayName?.split(' ')[0] || 'User',
                    lastName: firebaseUser.displayName?.split(' ')[1] || '',
                    email: firebaseUser.email || '',
                    role: 'user',
                  };
                  await setDoc(doc(db, 'users', firebaseUser.uid), {
                    ...newProfile,
                    createdAt: serverTimestamp(),
                  });
                }
              }, 2000);
            }
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
            setLoading(false);
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  const handleLogout = () => {
    setCurrentTab('user');
    sessionStorage.removeItem('login_role');
    if (isGuest) {
      setIsGuest(false);
    } else {
      auth.signOut();
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isGuest && (!user || !profile)) {
    return <Auth onGuestLogin={() => { setIsGuest(true); setCurrentTab('user'); }} />;
  }

  const currentProfile = isGuest ? { uid: 'guest_' + Math.random().toString(36).substring(2, 9), firstName: 'USER', lastName: '', email: '', role: 'user' as AppRole } : profile!;
  const isDefaultAdmin = !isGuest && user?.email === 'beaconsos123@gmail.com';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Global Success Overlay */}
      <AnimatePresence>
        {showLoginSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-zinc-900 border border-orange-500/50 p-12 rounded-[3rem] shadow-2xl shadow-orange-500/20 text-center space-y-6"
            >
              <div className="relative w-24 h-24 bg-black rounded-full mx-auto flex items-center justify-center shadow-lg shadow-black/20 overflow-hidden">
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-normal tracking-widest uppercase leading-tight [text-shadow:_-1px_-1px_0_#fff,1px_-1px_0_#fff,-1px_1px_0_#fff,1px_1px_0_#fff] text-transparent">
                  <span className="text-[14px]">UNSCRIPTED</span>
                  <span className="text-[14px]">GECIAN</span>
                </div>
              </div>
              <h2 className="text-4xl font-black text-white uppercase tracking-tighter">LOGIN SUCCESSFUL!</h2>
              <div className="flex justify-center gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.3 }}
                    className="w-2 h-2 bg-orange-500 rounded-full"
                  />
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Rail (Desktop) / Bottom Bar (Mobile) */}
      {activeTab !== 'user' && (
        <nav className="fixed left-0 bottom-0 right-0 h-20 md:left-0 md:top-0 md:bottom-0 md:w-20 bg-zinc-900/50 border-t md:border-t-0 md:border-r border-zinc-800 flex md:flex-col items-center justify-around md:py-8 z-50">
          <div className="hidden md:block mb-12 flex flex-col items-center">
            <div className="relative w-16 h-16 rounded-full flex items-center justify-center shadow-lg logo-circulating-shadow overflow-hidden bg-black">
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-normal tracking-widest uppercase leading-tight [text-shadow:_-1px_-1px_0_#fff,1px_-1px_0_#fff,-1px_1px_0_#fff,1px_1px_0_#fff] text-transparent">
                <span className="text-[8px]">UNSCRIPTED</span>
                <span className="text-[8px]">GECIAN</span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex md:flex-col items-center justify-around md:gap-8 w-full md:w-auto">
            {/* Volunteer Tab: Only for 'volunteer' role. Hidden for coordinators. */}
            {currentProfile.role === 'volunteer' && (
              <NavButton 
                active={activeTab === 'volunteer'} 
                onClick={() => setActiveTab('volunteer')} 
                icon={<ClipboardList size={24} />} 
                label="Volunteer" 
              />
            )}
            
            {/* Admin Tab: Only for 'coordinator' role or default admin */}
            {(currentProfile.role === 'coordinator' || isDefaultAdmin) && (
              <NavButton 
                active={activeTab === 'coordinator'} 
                onClick={() => setActiveTab('coordinator')} 
                icon={<LayoutDashboard size={24} />} 
                label="Admin" 
              />
            )}
          </div>

          <button 
            onClick={handleLogout}
            className="p-3 text-zinc-500 hover:text-orange-500 transition-colors"
          >
            <LogOut size={24} />
          </button>
        </nav>
      )}

      {/* Main Content */}
      <main className={cn("min-h-screen pb-20 md:pb-0", activeTab !== 'user' && "md:pl-20")}>
        <Toaster position="top-center" richColors />
        {activeTab !== 'user' && (
          <header className="h-20 border-b border-zinc-800 flex items-center justify-between px-8 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-40">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                {activeTab === 'volunteer' && 'Operational Tasks'}
                {activeTab === 'coordinator' && 'Coordination Center'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{currentProfile.firstName} {currentProfile.lastName}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{currentProfile.role}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon size={20} className="text-zinc-400" />
                )}
              </div>
            </div>
          </header>
        )}

        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
            >
              {activeTab === 'user' && <UserLayer profile={currentProfile} onLogout={handleLogout} />}
              {activeTab === 'volunteer' && <OperationalLayer profile={currentProfile} />}
              {activeTab === 'coordinator' && <CoordinationLayer profile={currentProfile} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`group relative p-2 md:p-3 rounded-xl transition-all duration-600 ${active ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'}`}
    >
      {icon}
      <span className="hidden md:block absolute left-full ml-4 px-2 py-1 bg-zinc-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 bg-orange-500 rounded-r-full hidden md:block"
        />
      )}
    </button>
  );
}
