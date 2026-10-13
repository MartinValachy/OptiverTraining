// Exact rational arithmetic on BigInt numerator/denominator.
// Always stored normalised: gcd(n, d) = 1 and d > 0.

function babs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

export function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b !== 0n) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

export type FracLike = Fraction | number | bigint | string;

export class Fraction {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = typeof n === "bigint" ? n : BigInt(n);
    let dd = typeof d === "bigint" ? d : BigInt(d);
    if (dd === 0n) throw new RangeError("Fraction: zero denominator");
    if (dd < 0n) {
      nn = -nn;
      dd = -dd;
    }
    const g = bgcd(nn, dd);
    this.n = g > 1n ? nn / g : nn;
    this.d = g > 1n ? dd / g : dd;
  }

  static of(x: FracLike): Fraction {
    if (x instanceof Fraction) return x;
    if (typeof x === "bigint") return new Fraction(x, 1n);
    if (typeof x === "string") return Fraction.parse(x);
    if (!Number.isFinite(x)) throw new RangeError("Fraction.of: non-finite");
    if (Number.isInteger(x)) return new Fraction(BigInt(x), 1n);
    // Exact conversion of a finite double via its decimal expansion is lossy; only allow short decimals.
    return Fraction.parse(String(x));
  }

  /** Parse "3", "-3/4", "0.125", "1e-3". */
  static parse(s: string): Fraction {
    const t = s.trim();
    if (t.includes("/")) {
      const [a, b] = t.split("/");
      return Fraction.parse(a).div(Fraction.parse(b));
    }
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(t);
    if (!m || (m[2] === "" && (m[3] ?? "") === "")) throw new SyntaxError(`Fraction.parse: ${s}`);
    const sign = m[1] === "-" ? -1n : 1n;
    const intPart = m[2] || "0";
    const frac = m[3] ?? "";
    const exp = m[4] ? parseInt(m[4], 10) : 0;
    let num = BigInt(intPart + frac) * sign;
    let den = 10n ** BigInt(frac.length);
    if (exp > 0) num *= 10n ** BigInt(exp);
    if (exp < 0) den *= 10n ** BigInt(-exp);
    return new Fraction(num, den);
  }

  static readonly ZERO = new Fraction(0n, 1n);
  static readonly ONE = new Fraction(1n, 1n);

  add(o: FracLike): Fraction {
    const b = Fraction.of(o);
    return new Fraction(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  sub(o: FracLike): Fraction {
    const b = Fraction.of(o);
    return new Fraction(this.n * b.d - b.n * this.d, this.d * b.d);
  }
  mul(o: FracLike): Fraction {
    const b = Fraction.of(o);
    return new Fraction(this.n * b.n, this.d * b.d);
  }
  div(o: FracLike): Fraction {
    const b = Fraction.of(o);
    if (b.n === 0n) throw new RangeError("Fraction: division by zero");
    return new Fraction(this.n * b.d, this.d * b.n);
  }
  neg(): Fraction {
    return new Fraction(-this.n, this.d);
  }
  inv(): Fraction {
    return new Fraction(this.d, this.n);
  }
  pow(k: number): Fraction {
    if (!Number.isInteger(k)) throw new RangeError("Fraction.pow: integer exponent only");
    if (k < 0) return this.inv().pow(-k);
    return new Fraction(this.n ** BigInt(k), this.d ** BigInt(k));
  }
  /** 1 - this */
  comp(): Fraction {
    return Fraction.ONE.sub(this);
  }
  cmp(o: FracLike): number {
    const b = Fraction.of(o);
    const l = this.n * b.d;
    const r = b.n * this.d;
    return l < r ? -1 : l > r ? 1 : 0;
  }
  eq(o: FracLike): boolean {
    return this.cmp(o) === 0;
  }
  lt(o: FracLike): boolean {
    return this.cmp(o) < 0;
  }
  gt(o: FracLike): boolean {
    return this.cmp(o) > 0;
  }
  isZero(): boolean {
    return this.n === 0n;
  }
  isInteger(): boolean {
    return this.d === 1n;
  }
  sign(): number {
    return this.n === 0n ? 0 : this.n > 0n ? 1 : -1;
  }
  abs(): Fraction {
    return this.n < 0n ? this.neg() : this;
  }
  floor(): bigint {
    const q = this.n / this.d;
    return this.n < 0n && q * this.d !== this.n ? q - 1n : q;
  }

  /** Accurate conversion even for huge numerators/denominators. */
  toNumber(): number {
    const n = this.n;
    const d = this.d;
    if (babs(n) < 2n ** 53n && d < 2n ** 53n) return Number(n) / Number(d);
    // Scale to keep ~60 significant bits.
    const nb = babs(n).toString(2).length;
    const db = d.toString(2).length;
    const shift = 60 - (nb - db);
    const q = shift >= 0 ? (n << BigInt(shift)) / d : n / (d << BigInt(-shift));
    return Number(q) * 2 ** -shift;
  }

  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }

  toJSON(): string {
    return this.toString();
  }
}

export const F = (n: bigint | number, d: bigint | number = 1n) => new Fraction(n, d);

export function fsum(xs: Iterable<FracLike>): Fraction {
  let s = Fraction.ZERO;
  for (const x of xs) s = s.add(x);
  return s;
}
