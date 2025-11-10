// byte-array-rw.ts
import { CTypeName, EndianName } from './c-type';

type SupportedCType =
  | CTypeName.uint8_t | CTypeName.int8_t
  | CTypeName.uint16_t | CTypeName.int16_t
  | CTypeName.uint32_t | CTypeName.int32_t
  | CTypeName.float | CTypeName.double;

export class ByteArrayRW {
    private bytes: Uint8Array;
    private _baseOffset: number;
    private view: DataView;

    constructor(
        source: ArrayBuffer | Uint8Array | number[] | ReadonlyArray<number>,
        baseOffset = 0
    ) {
        this.bytes =
      source instanceof Uint8Array
          ? source
          : source instanceof ArrayBuffer
              ? new Uint8Array(source)
              : Uint8Array.from(source);

        this._baseOffset = baseOffset;
        this.view = new DataView(
            this.bytes.buffer,
            this.bytes.byteOffset + this._baseOffset,
            this.bytes.length - this._baseOffset
        );
    }

    get baseOffset(): number {
        return this._baseOffset;
    }
    set baseOffset(next: number) {
        this._baseOffset = next;
        this.view = new DataView(
            this.bytes.buffer,
            this.bytes.byteOffset + this._baseOffset,
            this.bytes.length - this._baseOffset
        );
    }

    get length(): number {
        return this.view.byteLength;
    }
    get capacity(): number {
        return this.bytes.length;
    }

    /** Read with partial tolerance: zero-fills missing bytes; undefined if none available. */
    public read(
        type: SupportedCType,
        offset = 0,
        endian: EndianName = EndianName.le
    ): number | undefined {
        const size = this.sizeOf(type);
        if (size == null) return undefined;

        const avail = this.availBytes(offset, size);
        if (avail <= 0) return undefined;

        // Build a temp buffer of full size, zero-filled, then copy available bytes
        const little = endian === EndianName.le;
        const tmp = new Uint8Array(size); // zero-filled
        for (let i = 0; i < avail; i++) {
            // copy in memory order (LSB-first if LE, MSB-first if BE)
            const b = this.view.getUint8(offset + i);
            tmp[i] = b;
        }

        // Interpret tmp as value with the requested endianness
        const dv = new DataView(tmp.buffer, tmp.byteOffset, tmp.byteLength);
        switch (type) {
            case CTypeName.uint8_t:  return dv.getUint8(0);
            case CTypeName.int8_t:   return dv.getInt8(0);
            case CTypeName.uint16_t: return dv.getUint16(0, little);
            case CTypeName.int16_t:  return dv.getInt16(0, little);
            case CTypeName.uint32_t: return dv.getUint32(0, little);
            case CTypeName.int32_t:  return dv.getInt32(0, little);
            case CTypeName.float:    return dv.getFloat32(0, little);
            case CTypeName.double:   return dv.getFloat64(0, little);
            default:                 return undefined;
        }
    }

    /**
   * Write with partial tolerance: writes as many bytes as fit.
   * Returns the number of bytes actually written (0..size).
   */
    public write(
        value: number,
        type: SupportedCType,
        offset = 0,
        endian: EndianName = EndianName.le
    ): number {
        const size = this.sizeOf(type);
        if (size == null) return 0;

        const avail = this.availBytes(offset, size);
        if (avail <= 0) return 0;

        // Pack value into a full-size byte array in memory order
        const bytes = this.packToBytes(value, type, endian);

        // Copy only the bytes that fit
        for (let i = 0; i < avail; i++) {
            this.view.setUint8(offset + i, bytes[i]);
        }
        return avail;
    }

    // ---------- helpers ----------
    private sizeOf(type: CTypeName): number | undefined {
        switch (type) {
            case CTypeName.uint8_t:
            case CTypeName.int8_t:
                return 1;
            case CTypeName.uint16_t:
            case CTypeName.int16_t:
                return 2;
            case CTypeName.uint32_t:
            case CTypeName.int32_t:
            case CTypeName.float:
                return 4;
            case CTypeName.double:
                return 8;
            case CTypeName.uint64_t:
            case CTypeName.int64_t:
                return undefined; // BigInt unsupported
            default:
                return undefined;
        }
    }

    private availBytes(offset: number, size: number): number {
        if (!Number.isInteger(offset) || offset < 0) return 0;
        return Math.max(0, Math.min(size, this.view.byteLength - offset));
    // 0..size inclusive
    }

    /** Pack a JS number into a typed memory-order byte array for the given C type. */
    private packToBytes(value: number, type: SupportedCType, endian: EndianName): Uint8Array {
        const size = this.sizeOf(type)!;
        const arr = new Uint8Array(size);
        const dv = new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
        const little = endian === EndianName.le;

        switch (type) {
            case CTypeName.uint8_t:  dv.setUint8(0, value); break;
            case CTypeName.int8_t:   dv.setInt8(0, value); break;
            case CTypeName.uint16_t: dv.setUint16(0, value, little); break;
            case CTypeName.int16_t:  dv.setInt16(0, value, little); break;
            case CTypeName.uint32_t: dv.setUint32(0, value, little); break;
            case CTypeName.int32_t:  dv.setInt32(0, value, little); break;
            case CTypeName.float:    dv.setFloat32(0, value, little); break;
            case CTypeName.double:   dv.setFloat64(0, value, little); break;
        }
        return arr;
    }
}
