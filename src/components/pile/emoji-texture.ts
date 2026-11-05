import * as THREE from "three";

const SIZE = 160;

export class EmojiTextureLoader extends THREE.Loader<THREE.CanvasTexture> {
  load(
    url: string,
    onLoad?: (data: THREE.CanvasTexture) => void,
    _onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ) {
    const img = new Image();
    img.crossOrigin = this.crossOrigin || "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        onError?.(new Error("canvas"));
        return;
      }
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      onLoad?.(tex);
    };
    img.onerror = () => onError?.(new Error(`emoji ${url}`));
    img.src = url;
  }
}
