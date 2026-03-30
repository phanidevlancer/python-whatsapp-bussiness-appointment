'use client';

import createGlobe, { type COBEOptions } from 'cobe';
import Link from 'next/link';
import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeftIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const GLOBE_CONFIG: Omit<COBEOptions, 'onRender'> = {
  width: 600,
  height: 600,
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 0,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [1, 1, 1],
  markerColor: [251 / 255, 100 / 255, 21 / 255],
  glowColor: [1, 1, 1],
  markers: [
    { location: [41.0082, 28.9784], size: 0.06 },
    { location: [40.7128, -74.006], size: 0.1 },
    { location: [34.6937, 135.5022], size: 0.05 },
    { location: [-23.5505, -46.6333], size: 0.1 },
  ],
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.9, ease: 'easeOut' } },
};

const globeVariants = {
  hidden: { scale: 0.85, opacity: 0, y: 10 },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: { duration: 1, ease: 'easeOut' },
  },
  floating: {
    y: [-4, 4],
    transition: {
      duration: 5,
      ease: 'easeInOut',
      repeat: Infinity,
      repeatType: 'reverse' as const,
    },
  },
};

export interface GlobeProps {
  className?: string;
  config?: Omit<COBEOptions, 'onRender'>;
}

export function Globe({ className, config = GLOBE_CONFIG }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const widthRef = useRef(0);

  const onRender = useCallback((state: { phi: number; width: number; height: number }) => {
    phiRef.current += 0.005;
    state.phi = phiRef.current;
    state.width = widthRef.current * 2;
    state.height = widthRef.current * 2;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      widthRef.current = canvas.offsetWidth;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const globe = createGlobe(canvas, {
      ...config,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender,
    } as COBEOptions);

    return () => {
      globe.destroy();
      window.removeEventListener('resize', handleResize);
    };
  }, [config, onRender]);

  return (
    <div className={cn('relative aspect-square w-full max-w-md', className)}>
      <canvas ref={canvasRef} className="size-full [contain:layout_paint_size]" />
    </div>
  );
}

export interface Cosmic404Props {
  title?: string;
  description?: string;
  backText?: string;
  backHref?: string;
  className?: string;
}

export default function Cosmic404({
  title = 'Ups! Lost in space',
  description = 'We couldn’t find the page you’re looking for. It might have been moved or deleted.',
  backText = 'Go Back',
  backHref = '/appointments',
  className,
}: Cosmic404Props) {
  return (
    <div className={cn('flex min-h-[88vh] flex-col items-center justify-center bg-background px-4', className)}>
      <AnimatePresence mode="wait">
        <motion.div
          className="text-center"
          initial="hidden"
          animate="visible"
          exit="hidden"
          variants={fadeUp}
        >
          <div className="mb-10 flex items-center justify-center gap-4 sm:gap-6">
            <motion.span
              className="select-none text-6xl font-bold text-foreground/80 sm:text-7xl md:text-8xl"
              variants={fadeUp}
            >
              4
            </motion.span>

            <motion.div
              className="relative h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32"
              variants={globeVariants}
              animate={['visible', 'floating']}
            >
              <Globe />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.08)_0%,transparent_70%)]" />
            </motion.div>

            <motion.span
              className="select-none text-6xl font-bold text-foreground/80 sm:text-7xl md:text-8xl"
              variants={fadeUp}
            >
              4
            </motion.span>
          </div>

          <motion.h1
            className="mb-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl"
            variants={fadeUp}
          >
            {title}
          </motion.h1>

          <motion.p
            className="mx-auto mb-10 max-w-md text-base text-slate-500 md:text-lg"
            variants={fadeUp}
          >
            {description}
          </motion.p>

          <motion.div variants={fadeUp}>
            <Link
              href={backHref}
              className={cn(
                buttonVariants({ variant: 'default', size: 'default' }),
                'gap-2 transition-transform duration-300 hover:scale-105'
              )}
            >
                <ArrowLeftIcon className="h-5 w-5" />
                {backText}
            </Link>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
