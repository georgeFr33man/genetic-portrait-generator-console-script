import fs from "fs";
import {JimpImageInterface, Picture, Point} from "genetic-portrait-generator/dist/entities/graphics";
import * as dotenv from 'dotenv';
import {ColorHelper} from "genetic-portrait-generator/dist/helpers";

dotenv.config();

const publicDir = process.env.PUBLIC_DIR;

const readyPath = publicDir + '/image-ready';
const readyDir = fs.opendirSync(readyPath);
let readyFolder = readyDir.readSync();

(async () => {
    while (readyFolder !== null) {
        if (!readyFolder.isDirectory()) {
            readyFolder = readyDir.readSync();
            continue;
        }
        const name = readyFolder.name;
        const path = readyFolder + '/' + name;
        const oi = publicDir + '/image-ready/' + name + '/' + name + '_oi.png';
        const em = publicDir + '/image-ready/' + name + '/' + name + '_em.png';
        const generated = publicDir + '/image-ready/' + name + '/' + name + '.png';
        const ratingPath = publicDir + '/image-ready/' + name + '/' + name + '_rate.json';

        const oiImage = new Picture(oi, true);
        const emImage = new Picture(em, true);
        const generatedImage = new Picture(generated, true);

        await oiImage.waitForInit();
        await emImage.waitForInit();
        await generatedImage.waitForInit();

        if (!(oiImage._oi && emImage._oi && generatedImage._oi)) {
            console.error('Cannot load images!!!!!!');
            return 0;
        }

        const rating = {
            edges: {ifWhiteBg: 0, ifBlackBg: 0, nofEdgePixels: 0, allPixels: 0, edgePercent: 0},
            skinTone: {ifWhiteBg: 0, ifBlackBg: 0, nofSkinTonePixels: 0, allPixels: 0, skinPercent: 0}
        };

        rating.edges = rateEdges(generatedImage._oi, emImage._oi);
        rating.skinTone = rateSkinTone(generatedImage._oi, oiImage._oi);

        fs.writeFileSync(ratingPath, JSON.stringify(rating));

        readyFolder = readyDir.readSync();
    }
})();

function rateEdges(generated: JimpImageInterface, edgeMatrix: JimpImageInterface): { ifWhiteBg: number, ifBlackBg: number, nofEdgePixels: number, allPixels: number, edgePercent: number } {
    let diffThanWhite = 0;
    let diffThanBlack = 0;
    let sum = 0;

    for (let x = 1; x < edgeMatrix.width; x++) {
        for (let y = 1; y < edgeMatrix.height; y++) {
            const point = new Point(x, y);
            const colorRGBA = getRGBA(point, edgeMatrix);
            if (colorRGBA.r === 0 && colorRGBA.g === 0 && colorRGBA.b === 0) {
                continue;
            }
            sum++;
            const colorOnGenerated = getRGBA(point, generated);

            if (!isBlack(colorOnGenerated)) {
                diffThanBlack++;
            } else if (!isWhite(colorOnGenerated)) {
                diffThanWhite++;
            }
        }
    }

    return {
        ifWhiteBg: 1 - (diffThanWhite / sum),
        ifBlackBg: 1 - (diffThanBlack / sum),
        nofEdgePixels: sum,
        allPixels: edgeMatrix.width * edgeMatrix.height,
        edgePercent: sum / (edgeMatrix.width * edgeMatrix.height)
    };
}

function rateSkinTone(generated: JimpImageInterface, originalImage: JimpImageInterface): { ifWhiteBg: number, ifBlackBg: number, nofSkinTonePixels: number, allPixels: number, skinPercent: number } {
    let diffThanWhite = 0;
    let diffThanBlack = 0;
    let sum = 0;

    for (let x = 1; x < originalImage.width; x++) {
        for (let y = 1; y < originalImage.height; y++) {
            const point = new Point(x, y);
            const colorRGBA = getRGBA(point, originalImage);
            if (!isSkin(colorRGBA.r, colorRGBA.g, colorRGBA.b)) {
                continue;
            }

            sum++;
            const colorOnGenerated = getRGBA(point, generated);

            if (!isBlack(colorOnGenerated)) {
                diffThanBlack++;
            } else if (!isWhite(colorOnGenerated)) {
                diffThanWhite++;
            }
        }
    }

    return {
        ifWhiteBg: diffThanWhite / sum,
        ifBlackBg: diffThanBlack / sum,
        nofSkinTonePixels: sum,
        allPixels: originalImage.width * originalImage.height,
        skinPercent: sum / (originalImage.width * originalImage.height)
    }
}

function getRGBA(point: Point, image: JimpImageInterface) {
    return ColorHelper.getRGBAColorFromInt(image.getColorOnPosition(point, 0))
}

function isBlack(rgba: { r: number; g: number; b: number; }) {
    return rgba.r === 0 && rgba.g === 0 && rgba.b === 0
}

function isWhite(rgba: { r: number; g: number; b: number; }) {
    return rgba.r === 255 && rgba.g === 255 && rgba.b === 255
}

function isSkin(r: number, g: number, b: number) {

    // classify based on RGB
    let rgbClassifier = ((r > 95) && (g > 40 && g < 100) && (b > 20) && ((Math.max(r, g, b) - Math.min(r, g, b)) > 15) && (Math.abs(r - g) > 15) && (r > g) && (r > b));

    // classify based on normalized RGB
    let sum = r + g + b;
    let nr = (r / sum),
        ng = (g / sum),
        nb = (b / sum),
        normRgbClassifier = (((nr / ng) > 1.185) && (((r * b) / (Math.pow(r + g + b, 2))) > 0.107) && (((r * g) / (Math.pow(r + g + b, 2))) > 0.112));

    // classify based on hue
    let h = 0,
        mx = Math.max(r, g, b),
        mn = Math.min(r, g, b),
        dif = mx - mn;

    if (mx == r) {
        h = (g - b) / dif;
    } else if (mx == g) {
        h = 2 + ((g - r) / dif)
    } else {
        h = 4 + ((r - g) / dif);
    }
    h = h * 60;
    if (h < 0) {
        h = h + 360;
    }
    let s = 1 - (3 * ((Math.min(r, g, b)) / (r + g + b)));
    let hsvClassifier = (h > 0 && h < 35 && s > 0.23 && s < 0.68);

    // match either of the classifiers
    return (rgbClassifier || normRgbClassifier || hsvClassifier);
}