import React, { createContext, useContext, useState, useEffect } from 'react';
import { MotionConfig } from 'motion/react';
import { AnimationConfig } from '../types';
import { INITIAL_ANIMATION_CONFIG } from '../constants/initialCmsData';
import { apiFetch } from '../utils/api';

interface MotionContextType {
  config: AnimationConfig;
  updateConfig: (newConfig: Partial<AnimationConfig>) => void;
  shouldAnimate: boolean;
  getTransition: (delay?: number) => Record<string, any>;
  viewportConfig: { once: boolean; amount: number };
  hoverScale: any;
  tapScale: any;
  isSectionEnabled: (section: keyof AnimationConfig) => boolean;
  variants: {
    fadeIn: any;
    slideUp: any;
    staggerContainer: any;
    cardItem: any;
    scaleIn: any;
  };
}

const MotionContext = createContext<MotionContextType>({
  config: INITIAL_ANIMATION_CONFIG,
  updateConfig: () => {},
  shouldAnimate: true,
  getTransition: () => ({ duration: 0.5, ease: 'easeOut' }),
  viewportConfig: { once: true, amount: 0.15 },
  hoverScale: undefined,
  tapScale: undefined,
  isSectionEnabled: () => true,
  variants: {
    fadeIn: {},
    slideUp: {},
    staggerContainer: {},
    cardItem: {},
    scaleIn: {},
  },
});

export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AnimationConfig>(INITIAL_ANIMATION_CONFIG);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Detect system reduced motion preference
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  const loadConfig = () => {
    apiFetch('/api/appearance/animations')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) setConfig(data);
      })
      .catch(err => console.warn('Motion config load paused:', err));
  };

  useEffect(() => {
    loadConfig();
    window.addEventListener('nash-animations-updated', loadConfig);
    return () => window.removeEventListener('nash-animations-updated', loadConfig);
  }, []);

  const shouldAnimate =
    config.is_enabled &&
    config.preset !== 'disabled' &&
    (!config.respect_reduced_motion || !prefersReducedMotion);

  const isSectionEnabled = (section: keyof AnimationConfig): boolean => {
    if (!shouldAnimate) return false;
    const val = config[section];
    return typeof val === 'boolean' ? val : true;
  };

  const getTransition = (delay = 0) => {
    if (!shouldAnimate) {
      return { duration: 0, delay: 0 };
    }

    const duration =
      config.preset === 'subtle'
        ? 0.35
        : config.preset === 'dynamic' || config.preset === 'energetic'
        ? 0.4
        : config.preset === 'minimal'
        ? 0.2
        : config.duration || 0.5;

    const baseDelay = config.default_delay || 0;

    const ease =
      config.preset === 'dynamic' || config.preset === 'energetic'
        ? [0.34, 1.56, 0.64, 1] // bouncy spring feel
        : config.preset === 'subtle'
        ? [0.25, 0.1, 0.25, 1]
        : config.preset === 'minimal'
        ? 'easeOut'
        : [0.22, 1, 0.36, 1]; // smooth modern cubic-bezier

    return {
      duration,
      delay: baseDelay + delay,
      ease,
    };
  };

  const viewportConfig = {
    once: config.play_mode !== 'repeat',
    amount: 0.15,
  };

  const hoverScale =
    shouldAnimate && config.hover_effects && config.enable_button_hover
      ? { scale: config.intensity === 'high' ? 1.04 : 1.02, transition: { duration: 0.15 } }
      : undefined;

  const tapScale =
    shouldAnimate && config.hover_effects && config.enable_button_hover
      ? { scale: 0.97, transition: { duration: 0.1 } }
      : undefined;

  const variants = {
    fadeIn: {
      initial: shouldAnimate ? { opacity: 0 } : { opacity: 1 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    slideUp: {
      initial: shouldAnimate ? { opacity: 0, y: config.intensity === 'subtle' ? 10 : 18 } : { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      exit: shouldAnimate ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 },
    },
    scaleIn: {
      initial: shouldAnimate ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 },
      animate: { opacity: 1, scale: 1 },
      exit: shouldAnimate ? { opacity: 0, scale: 0.96 } : { opacity: 1, scale: 1 },
    },
    staggerContainer: {
      initial: {},
      animate: {
        transition: {
          staggerChildren: shouldAnimate ? config.stagger_delay || 0.08 : 0,
        },
      },
    },
    cardItem: {
      initial: shouldAnimate ? { opacity: 0, y: 14 } : { opacity: 1, y: 0 },
      animate: { opacity: 1, y: 0 },
      transition: getTransition(),
    },
  };

  const updateConfig = (newConfig: Partial<AnimationConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  };

  return (
    <MotionContext.Provider
      value={{
        config,
        updateConfig,
        shouldAnimate,
        getTransition,
        viewportConfig,
        hoverScale,
        tapScale,
        isSectionEnabled,
        variants,
      }}
    >
      <MotionConfig
        reducedMotion={!shouldAnimate ? 'always' : config.respect_reduced_motion ? 'user' : 'never'}
        transition={getTransition() as any}
      >
        {children}
      </MotionConfig>
    </MotionContext.Provider>
  );
};

export const useMotionSettings = () => useContext(MotionContext);
export const useMotion = () => useContext(MotionContext);
