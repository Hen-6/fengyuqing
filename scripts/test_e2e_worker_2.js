const fs = require('fs');
const pako = require('pako');

try {
    const buffer = fs.readFileSync('public/data/SUPER_DATASET_DEDUPED.bin');
    const arrayBuffer = new Uint8Array(buffer).buffer; // Simulate fetch().arrayBuffer()
    
    console.log("ArrayBuffer size:", arrayBuffer.byteLength);
    const decompressedArray = pako.inflate(new Uint8Array(arrayBuffer));
    const decompressed = new TextDecoder().decode(decompressedArray);
    console.log("Decompressed length:", decompressed.length);
    const parsed = JSON.parse(decompressed);
    console.log("Poems count:", parsed.poems.length);
} catch (e) {
    console.error("ERROR:", e);
}
