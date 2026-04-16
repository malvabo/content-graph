/** Map aspect ratio string to pixel dimensions for image generation */
export const RATIO_DIMS: Record<string, { w: number; h: number }> = {
  '1:1':   { w: 1024, h: 1024 },
  '4:5':   { w: 1024, h: 1280 },
  '16:9':  { w: 1024, h: 576 },
  '9:16':  { w: 576, h: 1024 },
  '1.91:1': { w: 1200, h: 628 },
};

export function getDims(aspect: string | undefined): { w: number; h: number } {
  return RATIO_DIMS[aspect || '16:9'] || RATIO_DIMS['16:9'];
}

/** CSS aspect-ratio value from ratio string */
export function cssAspect(aspect: string | undefined): string {
  const d = getDims(aspect);
  return `${d.w} / ${d.h}`;
}

/** Purpose → default ratio mapping */
export const PURPOSE_RATIO: Record<string, string> = {
  'Blog hero': '16:9',
  'LinkedIn post': '1.91:1',
  'Newsletter header': '16:9',
  'Instagram slide': '1:1',
  'Social concept': '4:5',
};
