import { useEffect, useRef } from 'react';
import type { Brick } from '../../engine/packer';
import { BrickViewer, type ShowOptions } from '../viewer/BrickViewer';

interface Props extends ShowOptions {
  bricks: Brick[];
  autoRotate?: boolean;
  azimuth?: number;
  className?: string;
  label?: string;
}

export function Viewer3D({ bricks, autoRotate, azimuth, upToStep, highlightStep, className, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const viewer = useRef<BrickViewer | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      viewer.current = new BrickViewer(ref.current, { autoRotate, azimuth });
    } catch (err) {
      console.error('3D görüntüleyici başlatılamadı', err);
      ref.current.textContent = '3D önizleme bu cihazda desteklenmiyor.';
    }
    return () => {
      viewer.current?.dispose();
      viewer.current = null;
    };
    // Görüntüleyici yalnızca bir kez kurulur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    viewer.current?.setModel(bricks, { upToStep, highlightStep });
  }, [bricks, upToStep, highlightStep]);

  return <div ref={ref} className={`viewer3d ${className ?? ''}`} role="img" aria-label={label ?? 'Figürün 3D önizlemesi'} />;
}
