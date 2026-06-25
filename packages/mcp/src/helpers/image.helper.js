import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export function diffImages(bufA, bufB) {
    const imgA = PNG.sync.read(bufA);
    const imgB = PNG.sync.read(bufB);

    const width = Math.max(imgA.width, imgB.width);
    const height = Math.max(imgA.height, imgB.height);

    const out = new PNG({ width, height });

    const numDiff = pixelmatch(imgA.data, imgB.data, out.data, width, height, { threshold: 0.1 });
    const diffPercent = ((numDiff / (width * height)) * 100).toFixed(2);

    return {
        diffBuffer: PNG.sync.write(out),
        diffPercent: Number(diffPercent),
        totalPixels: width * height,
        diffPixels: numDiff,
    };
}

export function toBase64(buffer) {
    return buffer.toString('base64');
}

export function imageContent(buffer, label) {
    return {
        type: 'image',
        data: toBase64(buffer),
        mimeType: 'image/png',
        ...(label ? { annotations: { label } } : {}),
    };
}
