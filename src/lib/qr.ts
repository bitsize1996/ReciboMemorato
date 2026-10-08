/**
 * A small QR code generator with no outside libraries.
 * Text is stored as bytes with error correction level M (it still scans if a
 * little of the code is dirty or damaged). Supports versions 1-10, up to about
 * 210 characters, which is plenty for a web address.
 */

// Index = version (1-10). Error-correction codewords per block, and number of blocks, for level M.
const ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
const NUM_BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
const MAX_VERSION = 10;

const rawModules = (ver: number): number => {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
};

const dataCodewords = (ver: number): number =>
  Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver]! * NUM_BLOCKS[ver]!;

// ---- Reed-Solomon error correction over GF(256) ----
const gfMultiply = (x: number, y: number): number => {
  let z = 0;
  for (let i = 7; i >= 0; i -= 1) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
};

const rsGenerator = (degree: number): number[] => {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMultiply(result[j]!, root);
      if (j + 1 < result.length) result[j] = result[j]! ^ result[j + 1]!;
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
};

const rsRemainder = (data: number[], generator: number[]): number[] => {
  const result = generator.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    generator.forEach((coef, i) => {
      result[i] = result[i]! ^ gfMultiply(coef, factor);
    });
  }
  return result;
};

const bit = (value: number, index: number): boolean => ((value >>> index) & 1) !== 0;

/** The QR code as rows of dark (true) and light (false) squares, without the white border. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));

  let ver = 1;
  for (; ver <= MAX_VERSION; ver += 1) {
    const countBits = ver < 10 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  }
  if (ver > MAX_VERSION) throw new Error("That web address is too long for a QR code.");

  // ---- data bits ----
  const bits: number[] = [];
  const append = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  append(0b0100, 4);
  append(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => append(b, 8));
  const capacity = dataCodewords(ver) * 8;
  append(0, Math.min(4, capacity - bits.length));
  append(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | bits[i + j]!;
    data.push(byte);
  }

  // ---- error correction, interleaved ----
  const numBlocks = NUM_BLOCKS[ver]!;
  const blockEcc = ECC_PER_BLOCK[ver]!;
  const rawCodewords = Math.floor(rawModules(ver) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const generator = rsGenerator(blockEcc);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i += 1) {
    const piece = data.slice(k, k + shortLen - blockEcc + (i < numShort ? 0 : 1));
    k += piece.length;
    const ecc = rsRemainder(piece, generator);
    if (i < numShort) piece.push(0);
    blocks.push(piece.concat(ecc));
  }
  const codewords: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i += 1) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - blockEcc || j >= numShort) codewords.push(block[i]!);
    });
  }

  // ---- fixed patterns ----
  const size = ver * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => {
    modules[y]![x] = dark;
    fixed[y]![x] = true;
  };

  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, distance !== 2 && distance !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  const positions: number[] = [];
  if (ver > 1) {
    const count = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
    positions.push(6);
    for (let pos = size - 7, added = 1; added < count; pos -= step, added += 1) positions.splice(1, 0, pos);
  }
  positions.forEach((cy, i) => {
    positions.forEach((cx, j) => {
      const onFinder =
        (i === 0 && j === 0) || (i === 0 && j === positions.length - 1) || (i === positions.length - 1 && j === 0);
      if (onFinder) return;
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    });
  });

  const drawFormat = (mask: number) => {
    const formatData = (0 << 3) | mask; // error correction level M
    let rem = formatData;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const formatBits = ((formatData << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i += 1) set(8, i, bit(formatBits, i));
    set(8, 7, bit(formatBits, 6));
    set(8, 8, bit(formatBits, 7));
    set(7, 8, bit(formatBits, 8));
    for (let i = 9; i < 15; i += 1) set(14 - i, 8, bit(formatBits, i));
    for (let i = 0; i < 8; i += 1) set(size - 1 - i, 8, bit(formatBits, i));
    for (let i = 8; i < 15; i += 1) set(8, size - 15 + i, bit(formatBits, i));
    set(8, size - 8, true);
  };
  const drawVersion = () => {
    if (ver < 7) return;
    let rem = ver;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const versionBits = (ver << 12) | rem;
    for (let i = 0; i < 18; i += 1) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, bit(versionBits, i));
      set(b, a, bit(versionBits, i));
    }
  };
  drawFormat(0);
  drawVersion();

  // ---- place the data, zig-zagging up and down the columns ----
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fixed[y]![x]! && index < codewords.length * 8) {
          modules[y]![x] = bit(codewords[index >>> 3]!, 7 - (index & 7));
          index += 1;
        }
      }
    }
  }

  // ---- pick the mask that gives the most readable pattern ----
  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const invert =
          mask === 0 ? (x + y) % 2 === 0
          : mask === 1 ? y % 2 === 0
          : mask === 2 ? x % 3 === 0
          : mask === 3 ? (x + y) % 3 === 0
          : mask === 4 ? (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0
          : mask === 5 ? ((x * y) % 2) + ((x * y) % 3) === 0
          : mask === 6 ? (((x * y) % 2) + ((x * y) % 3)) % 2 === 0
          : (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        if (!fixed[y]![x]! && invert) modules[y]![x] = !modules[y]![x];
      }
    }
  };

  const penalty = (): number => {
    let result = 0;
    const addHistory = (run: number, history: number[]) => {
      if (history[0] === 0) run += size;
      history.pop();
      history.unshift(run);
    };
    const patterns = (history: number[]): number => {
      const n = history[1]!;
      const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
      return (core && history[0]! >= n * 4 && history[6]! >= n ? 1 : 0) + (core && history[6]! >= n * 4 && history[0]! >= n ? 1 : 0);
    };
    const scanLine = (cell: (i: number) => boolean) => {
      let color = false;
      let run = 0;
      const history = [0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < size; i += 1) {
        if (cell(i) === color) {
          run += 1;
          if (run === 5) result += 3;
          else if (run > 5) result += 1;
        } else {
          addHistory(run, history);
          if (!color) result += patterns(history) * 40;
          color = cell(i);
          run = 1;
        }
      }
      if (color) {
        addHistory(run, history);
        run = 0;
      }
      run += size;
      addHistory(run, history);
      result += patterns(history) * 40;
    };
    for (let y = 0; y < size; y += 1) scanLine((x) => modules[y]![x]!);
    for (let x = 0; x < size; x += 1) scanLine((y) => modules[y]![x]!);
    for (let y = 0; y < size - 1; y += 1) {
      for (let x = 0; x < size - 1; x += 1) {
        const c = modules[y]![x]!;
        if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1]) result += 3;
      }
    }
    let dark = 0;
    for (const row of modules) for (const cell of row) if (cell) dark += 1;
    const total = size * size;
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return result;
  };

  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    applyMask(mask);
    drawFormat(mask);
    const score = penalty();
    if (score < bestPenalty) {
      bestPenalty = score;
      bestMask = mask;
    }
    applyMask(mask); // undo
  }
  applyMask(bestMask);
  drawFormat(bestMask);
  return modules;
}

/** SVG path covering every dark square (one unit per square). */
export function qrPath(modules: boolean[][]): string {
  let path = "";
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`;
    });
  });
  return path;
}

/** A complete SVG picture of the QR code with the required white border. */
export function qrSvg(text: string, border = 4): string {
  const modules = qrMatrix(text);
  const total = modules.length + border * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path transform="translate(${border} ${border})" d="${qrPath(modules)}" fill="#000000"/></svg>`;
}
