import React, { useState } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, updateProfile, deleteUser, sendPasswordResetEmail, signInAnonymously } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { Mail, Lock, User, ArrowRight, Globe, Shield, Users, Heart, AlertCircle, Loader2, Sparkles, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { FloatingInput } from './ui/FloatingInput';

const clickEffect = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.96 },
  transition: { type: "spring", stiffness: 500, damping: 20 }
};

export default function Auth({ onGuestLogin }: { onGuestLogin?: () => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [role, setRole] = useState<'user' | 'volunteer' | 'coordinator'>('volunteer');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const bgImages = [
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=1920',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=1920',
    'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&q=80&w=1920',
  ];
  const [currentBg, setCurrentBg] = useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % bgImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleUserBypass = async () => {
    if (loading || isGoogleLoading) return;
    setRole('user');
    if (onGuestLogin) {
      onGuestLogin();
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('Please enter your email address first.');
      return;
    }
    setResetLoading(true);
    setError('');
    setSuccess('');
    try {
      await sendPasswordResetEmail(auth, formData.email);
      setSuccess('Password reset email sent! Please check your inbox.');
    } catch (err: any) {
      console.error("Reset error:", err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Failed to send reset email');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isGoogleLoading) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (!userDoc.exists()) {
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            firstName: formData.firstName || 'Admin',
            lastName: formData.lastName || 'User',
            email: formData.email,
            role: role,
            createdAt: serverTimestamp(),
          });
        }
      } else {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
          
          if (role === 'coordinator') {
            const q = query(collection(db, 'users'), where('role', '==', 'coordinator'));
            const querySnapshot = await getDocs(q);
            const existingCoordinator = querySnapshot.docs.find(doc => doc.id !== userCredential.user.uid);
            if (existingCoordinator) {
              await deleteUser(userCredential.user);
              setError('A coordinator already exists. Only one coordinator is allowed.');
              setLoading(false);
              return;
            }
          }

          await updateProfile(userCredential.user, {
            displayName: `${formData.firstName} ${formData.lastName}`,
          });
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            role: role,
            createdAt: serverTimestamp(),
          });
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            // If the email is already registered, try to sign them in instead
            await signInWithEmailAndPassword(auth, formData.email, formData.password);
          } else {
            throw createErr;
          }
        }
      }
      sessionStorage.setItem('just_logged_in', 'true');
      sessionStorage.setItem('login_role', role);
    } catch (err: any) {
      if (err.code !== 'auth/invalid-credential' && err.code !== 'auth/wrong-password' && err.code !== 'auth/user-not-found' && err.code !== 'auth/email-already-in-use') {
        console.error("Auth error:", err);
      }
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('ACTION REQUIRED: Enable Email/Password in Firebase Console (Authentication > Sign-in method)');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        if (!isLogin) {
          setError('This email is already registered, but the password provided is incorrect.');
        } else {
          setError('The email or password you entered is incorrect, or this email is not registered.');
        }
      } else if (err.code === 'permission-denied') {
        setError('Missing or insufficient permissions. Please contact the administrator.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isGoogleLoading || loading) return; // Prevent concurrent auth calls
    
    setIsGoogleLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      if (role === 'coordinator') {
        const q = query(collection(db, 'users'), where('role', '==', 'coordinator'));
        const querySnapshot = await getDocs(q);
        const existingCoordinator = querySnapshot.docs.find(doc => doc.id !== result.user.uid);
        if (existingCoordinator) {
          await deleteUser(result.user);
          setError('A coordinator already exists. Only one coordinator is allowed.');
          setIsGoogleLoading(false);
          return;
        }
      }

      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          firstName: result.user.displayName?.split(' ')[0] || 'User',
          lastName: result.user.displayName?.split(' ')[1] || '',
          email: result.user.email,
          role: role,
          createdAt: serverTimestamp(),
        });
      }
      sessionStorage.setItem('just_logged_in', 'true');
      sessionStorage.setItem('login_role', role);
    } catch (err: any) {
      if (err.code !== 'auth/popup-blocked' && err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
        console.error("Google Auth error:", err);
      }
      const errorMessage = err.message || '';
      
      if (err.code === 'auth/popup-blocked') {
        setError('Popup blocked. Please click the popup blocker icon in your address bar and select "Always allow popups".');
      } else if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        // User closed the popup or cancelled, don't show as a scary error
        console.log("Auth cancelled by user");
      } else if (errorMessage.includes('INTERNAL ASSERTION FAILED')) {
        // Ignore this specific firebase internal error that happens after popup close/block
        console.log("Firebase internal assertion error caught and ignored");
        setError('Authentication was interrupted. Please try again.');
      } else if (err.code === 'auth/multi-factor-auth-required') {
        setError('Multi-Factor Authentication is not supported. Please use a Google account without MFA.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('ACTION REQUIRED: Enable Google Sign-In in Firebase Console (Authentication > Sign-in method)');
      } else if (err.code === 'permission-denied') {
        setError('Missing or insufficient permissions. Please contact the administrator.');
      } else {
        setError(errorMessage || 'Google Sign-In failed');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-zinc-950 text-white">
      {/* Background Animations */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBg}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 0.7, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 z-0"
        >
          <img 
            src={bgImages[currentBg]} 
            alt="NGO Background" 
            className="w-full h-full object-cover brightness-110 contrast-110"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/50 to-zinc-950/90" />
        </motion.div>
      </AnimatePresence>

      {/* Main Content */}
      <main className="relative z-10 flex-grow flex flex-col items-center justify-center p-6">
        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "w-full max-w-lg p-10 bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800 rounded-[2.5rem] shadow-2xl transition-all duration-150",
            (loading || isGoogleLoading) && "authenticating-glow pointer-events-none"
          )}
        >
          <div className="text-center mb-8">
            <div className="relative w-24 h-24 bg-black rounded-full mx-auto shadow-lg logo-circulating-shadow overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-normal tracking-widest uppercase leading-tight [text-shadow:_-1px_-1px_0_#fff,1px_-1px_0_#fff,-1px_1px_0_#fff,1px_1px_0_#fff] text-transparent">
                <span className="text-[14px]">UNSCRIPTED</span>
                <span className="text-[14px]">GECIAN</span>
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="mb-8">
            <div className="grid grid-cols-3 gap-3">
              <RoleButton 
                active={role === 'user'} 
                onClick={handleUserBypass} 
                icon={<Heart size={16} />} 
                label="As User" 
              />
              <RoleButton 
                active={role === 'volunteer'} 
                onClick={() => setRole('volunteer')} 
                icon={<Users size={16} />} 
                label="As Volunteer" 
              />
              <RoleButton 
                active={role === 'coordinator'} 
                onClick={() => setRole('coordinator')} 
                icon={<Shield size={16} />} 
                label="As Coordinator" 
              />
            </div>
          </div>

          {role !== 'user' && (
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3 text-red-500 text-xs font-bold uppercase tracking-widest"
                    >
                      <AlertCircle size={16} />
                      {error}
                    </motion.div>
                  )}
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 flex items-center gap-3 text-green-500 text-xs font-bold uppercase tracking-widest"
                    >
                      <Sparkles size={16} />
                      {success}
                    </motion.div>
                  )}
                </AnimatePresence>

                {!isLogin && (
                  <div className="grid grid-cols-2 gap-4">
                    <FloatingInput 
                      label="First Name" 
                      name="firstName" 
                      value={formData.firstName} 
                      onChange={handleChange} 
                      required 
                      icon={User} 
                      placeholder="Enter first name"
                    />
                    <FloatingInput 
                      label="Last Name" 
                      name="lastName" 
                      value={formData.lastName} 
                      onChange={handleChange} 
                      required 
                      icon={User} 
                      placeholder="Enter last name"
                    />
                  </div>
                )}

                <FloatingInput 
                  label="Email Address" 
                  name="email" 
                  type="email"
                  value={formData.email} 
                  onChange={handleChange} 
                  required 
                  icon={Mail} 
                  placeholder="email@example.com"
                />

                <div className="space-y-2">
                  <FloatingInput 
                    label="Password" 
                    name="password" 
                    type="password"
                    value={formData.password} 
                    onChange={handleChange} 
                    required 
                    icon={Lock} 
                    placeholder="••••••••"
                  />
                  {isLogin && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={resetLoading}
                        className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-orange-500 transition-colors flex items-center gap-1 disabled:opacity-50"
                      >
                        {resetLoading ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <KeyRound size={10} />
                        )}
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>

                <motion.button
                  type="submit"
                  disabled={loading}
                  {...clickEffect}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 transition-all duration-100 flex items-center justify-center gap-2 group relative overflow-hidden"
                >
                  {loading ? (
                    <MulticolorLoader />
                  ) : (
                    <>
                      <span className="uppercase tracking-widest">{isLogin ? 'Sign In' : 'Create Account'}</span>
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </motion.button>
              </form>

              <div className="mt-6">
                <div className="relative flex items-center justify-center mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                </div>

                <motion.button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading || isGoogleLoading}
                  {...clickEffect}
                  className={cn(
                    "w-full py-3 font-bold rounded-xl transition-all duration-100 flex items-center justify-center gap-3 uppercase text-xs tracking-widest disabled:opacity-80 disabled:cursor-not-allowed",
                    isGoogleLoading ? "bg-zinc-800 text-white" : "bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-white"
                  )}
                >
                  {isGoogleLoading ? (
                    <>
                      <MulticolorLoader color="border-white/20 border-t-white" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                      Continue with Google
                    </>
                  )}
                </motion.button>

                <p className="text-center mt-8 text-zinc-500 text-xs font-bold uppercase tracking-widest">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                  <button
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-orange-500 font-bold hover:underline uppercase ml-1"
                  >
                    {isLogin ? 'Sign Up' : 'Sign In'}
                  </button>
                </p>
              </div>
            </>
          )}
        </motion.div>
      </main>
    </div>
  );
}

function RoleButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-3 px-2 rounded-xl border transition-all duration-100",
        active 
          ? "bg-orange-500 border-orange-400 text-white shadow-lg shadow-orange-500/20" 
          : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-white"
      )}
    >
      {icon}
      <span className="text-[9px] font-bold uppercase tracking-tighter text-center">{label}</span>
    </motion.button>
  );
}

function MulticolorLoader({ color = "border-white/20 border-t-white" }: { color?: string }) {
  return (
    <div className="relative w-4 h-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
        className={cn("w-full h-full border-2 rounded-full", color)}
      />
    </div>
  );
}
