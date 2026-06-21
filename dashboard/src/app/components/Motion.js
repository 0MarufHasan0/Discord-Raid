"use client";

import { motion, AnimatePresence } from "framer-motion";

export const MotionDiv = motion.div;
export const MotionSpan = motion.span;
export const MotionH1 = motion.h1;
export const MotionP = motion.p;

export { AnimatePresence };

export function FadeInUp({ children, delay = 0, duration = 0.6, className = "" }) {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}

export function FadeIn({ children, delay = 0, duration = 0.6, className = "" }) {
  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}

export function ScaleIn({ children, delay = 0, duration = 0.5, className = "" }) {
  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}

export function StaggerContainer({ children, className = "", delay = 0 }) {
  return (
    <MotionDiv
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.08,
            delayChildren: delay
          }
        }
      }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}

export function StaggerItem({ children, className = "" }) {
  return (
    <MotionDiv
      variants={{
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
      }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}
