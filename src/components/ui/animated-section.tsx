"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  /** Optional delay (seconds) before the reveal begins. */
  delay?: number;
  /** Which direction the section animates in from. */
  variant?: "fadeInUp" | "fadeInLeft" | "fadeInRight" | "scaleIn";
}

/**
 * fadeInUp — rises into place from below.
 */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 60 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

/**
 * fadeInLeft — slides in from the left edge.
 */
export const fadeInLeft: Variants = {
  initial: { opacity: 0, x: -60 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

/**
 * fadeInRight — slides in from the right edge.
 */
export const fadeInRight: Variants = {
  initial: { opacity: 0, x: 60 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

/**
 * scaleIn — grows from a smaller scale while fading in.
 */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.8 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

/**
 * staggerContainer — orchestrates children reveals with a gentle cascade.
 * Children animate 0.1s apart, starting 0.3s after the container triggers.
 */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const variantMap: Record<
  NonNullable<AnimatedSectionProps["variant"]>,
  Variants
> = {
  fadeInUp,
  fadeInLeft,
  fadeInRight,
  scaleIn,
};

/**
 * AnimatedSection wraps its children in a motion.div that reveals once when
 * scrolled into view (once-only, triggering 100px before it enters).
 */
export function AnimatedSection({
  children,
  className,
  delay = 0,
  variant = "fadeInUp",
}: AnimatedSectionProps) {
  const selected = variantMap[variant];

  return (
    <motion.div
      variants={selected}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: "-100px" }}
      transition={{ delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * StaggerContainer wraps children in a motion.div using the staggerContainer
 * variant so any nested motion children cascade in on view.
 */
export function StaggerContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      whileInView="animate"
      viewport={{ once: true, margin: "-100px" }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
