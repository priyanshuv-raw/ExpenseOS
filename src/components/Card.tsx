import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', hoverEffect = true, onClick }: CardProps) {
  return (
    <motion.div
      whileHover={hoverEffect ? { y: -2, scale: 1.005 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onClick={onClick}
      className={`bg-white dark:bg-neutral-900/60 apple-border rounded-2xl p-5 apple-shadow ${className}`}
    >
      {children}
    </motion.div>
  );
}
