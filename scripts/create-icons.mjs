import sharp from 'sharp';
const svg='<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" rx="112" fill="#527c61"/><path d="M256 94c47 33 87 44 136 54v111c0 83-64 137-136 166-72-29-136-83-136-166V148c49-10 89-21 136-54Z" fill="#edf4e8"/><path d="m192 258 42 42 89-99" fill="none" stroke="#527c61" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/></svg>';
for(const size of [192,512])await sharp(Buffer.from(svg)).resize(size,size).png().toFile(`public/icon-${size}.png`);
