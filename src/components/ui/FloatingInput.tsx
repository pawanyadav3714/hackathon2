import React, { useState } from 'react';
import { cn } from '../../lib/utils';

interface FloatingInputProps {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  icon: any;
  placeholder?: string;
}

export function FloatingInput({ 
  label, 
  name, 
  type = "text", 
  value, 
  onChange, 
  required = false, 
  icon: Icon,
  placeholder = ""
}: FloatingInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = value.length > 0;

  return (
    <div className="relative group">
      <div className={cn(
        "absolute left-3 top-1/2 -translate-y-1/2 transition-all duration-600 pointer-events-none z-10",
        (isFocused || hasValue) ? "text-orange-600 scale-75 -translate-y-9 -translate-x-2" : "text-zinc-500"
      )}>
        <Icon size={16} />
      </div>
      <label className={cn(
        "absolute left-10 transition-all duration-600 pointer-events-none uppercase tracking-widest font-bold text-[10px] z-10",
        (isFocused || hasValue) 
          ? "top-0 -translate-y-1/2 text-orange-600 bg-zinc-950 px-2 scale-90" 
          : "top-1/2 -translate-y-1/2 text-zinc-500"
      )}>
        {label}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        required={required}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onChange={onChange}
        placeholder={isFocused ? placeholder : ""}
        className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-white text-sm placeholder:text-xs transition-all relative z-0"
      />
    </div>
  );
}
