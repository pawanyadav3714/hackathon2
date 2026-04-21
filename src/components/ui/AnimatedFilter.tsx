import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Filter, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Option {
  value: string;
  label: string;
}

interface AnimatedFilterProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function AnimatedFilter({ options, value, onChange, label, className }: AnimatedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("relative z-[50]", className)} ref={containerRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl transition-all duration-600",
          "hover:border-orange-500/30 hover:bg-zinc-900/60 shadow-lg shadow-black/20",
          isOpen && "border-orange-500/50 ring-2 ring-orange-500/10"
        )}
      >
        <div className="flex items-center justify-center w-6 h-6 bg-orange-500/10 rounded-lg">
          <Filter size={14} className="text-orange-500" />
        </div>
        <div className="flex flex-col items-start">
          {label && <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em] leading-none mb-1">{label}</span>}
          <span className="text-xs font-bold text-zinc-200 uppercase tracking-widest leading-none">
            {selectedOption.label}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.6, ease: "circOut" }}
          className="ml-2 text-zinc-500"
        >
          <ChevronDown size={16} />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.5, ease: "circOut" }}
            className="absolute right-0 mt-2 w-56 bg-zinc-900/90 backdrop-blur-2xl border border-zinc-800/50 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden p-1.5"
          >
            <div className="grid grid-cols-1 gap-1">
              {options.map((option) => (
                <motion.button
                  key={option.value}
                  whileHover={{ x: 4, backgroundColor: "rgba(249, 115, 22, 0.1)" }}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                    value === option.value 
                      ? "text-orange-500 bg-orange-500/10" 
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {option.label}
                  {value === option.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Check size={14} />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
