// Custom error class to represent format errors
class MalformedError extends Error {
    constructor(message) {
        super(message);
        this.name = "MalformedError";
    }
}

// Byte stream management class for sequential byte reading
class ByteStream {
    constructor(data) {
        this.data = data;
        this.offset = 0;
    }

    // Get the next byte and move the offset
    nextByte() {
        if (this.offset >= this.data.length) {
            throw new MalformedError("Unexpected end of data");
        }
        return this.data[this.offset++];
    }

    // Get the number of remaining bytes
    remaining() {
        return this.data.length - this.offset;
    }
}

/**
 * Reads a variable-length integer from the byte stream.
 * @param {ByteStream} stream 
 * @returns {number} The decoded integer value.
 * @throws {MalformedError} If the encoding is invalid.
 */
function readVarint(stream) {
    if (stream.remaining() < 1) {
        throw new MalformedError("Insufficient data for varint");
    }

    const firstByte = stream.nextByte();
    const prefix = firstByte >> 6;

    if (prefix === 3) {
        throw new MalformedError("Invalid variable-length integer prefix: '11'");
    }

    let length;
    switch (prefix) {
        case 0:
            length = 1;
            break;
        case 1:
            length = 2;
            break;
        case 2:
            length = 4;
            break;
        default:
            throw new MalformedError("Invalid prefix for varint");
    }

    if (stream.remaining() < (length - 1)) {
        throw new MalformedError("Insufficient data for varint length");
    }

    let value = firstByte & 0x3F; // Mask out the two prefix bits

    for (let i = 1; i < length; i++) {
        value = (value << 8) + stream.nextByte();
    }

    // Minimal encoding check
    const minValue = prefix === 0 ? 0 :
                     prefix === 1 ? 64 :
                     prefix === 2 ? 16384 :
                     0; // Invalid prefix not used

    if (value < minValue) {
        throw new MalformedError("Varint does not use minimal encoding");
    }

    return value;
}

/**
 * Encodes an integer into the minimal variable-length byte array.
 * @param {number} value 
 * @returns {Uint8Array} The encoded byte array.
 * @throws {Error} If the value is out of supported range.
 */
function writeVarint(value) {
    let bytes;

    if (value <= 63) {
        // 1-byte encoding: prefix '00'
        bytes = new Uint8Array(1);
        bytes[0] = value & 0x3F; // Ensure only 6 bits are used
    } else if (value <= 16383) {
        // 2-byte encoding: prefix '01'
        bytes = new Uint8Array(2);
        bytes[0] = 0x40 | ((value >> 8) & 0x3F); // Set prefix to '01'
        bytes[1] = value & 0xFF;
    } else if (value <= 1073741823) {
        // 4-byte encoding: prefix '10'
        bytes = new Uint8Array(4);
        bytes[0] = 0x80 | ((value >> 24) & 0x3F); // Set prefix to '10'
        bytes[1] = (value >> 16) & 0xFF;
        bytes[2] = (value >> 8) & 0xFF;
        bytes[3] = value & 0xFF;
    } else {
        throw new Error("Value out of range for varint encoding");
    }

    return bytes;
}

/**
 * Represents an optional value.
 */
class Optional {
    /**
     * @param {boolean} present - Whether the value is present.
     * @param {Uint8Array} value - The actual value if present.
     */
    constructor(present, value = null) {
        this.present = present;
        this.value = value;
    }

    /**
     * Encodes the optional value into a byte array.
     * @returns {Uint8Array}
     */
    encode() {
        const presentByte = new Uint8Array(1);
        presentByte[0] = this.present ? 1 : 0;

        if (this.present) {
            if (!(this.value instanceof Uint8Array)) {
                throw new Error("Value must be a Uint8Array when present");
            }
            // Concatenate present byte and actual value
            const combined = new Uint8Array(1 + this.value.length);
            combined.set(presentByte, 0);
            combined.set(this.value, 1);
            return combined;
        } else {
            return presentByte;
        }
    }

    /**
     * Decodes an optional value from the byte stream.
     * @param {ByteStream} stream 
     * @returns {Optional}
     * @throws {MalformedError}
     */
    static decode(stream) {
        if (stream.remaining() < 1) {
            throw new MalformedError("Insufficient data for optional present byte");
        }

        const present = stream.nextByte();
        if (present !== 0 && present !== 1) {
            throw new MalformedError("Invalid present byte for optional: " + present);
        }

        if (present === 0) {
            return new Optional(false, null);
        } else {
            // Assume T is a known length or determined by context
            // For demonstration, read a single byte as the value
            if (stream.remaining() < 1) {
                throw new MalformedError("Insufficient data for optional value");
            }
            const value = new Uint8Array(1);
            value[0] = stream.nextByte();
            return new Optional(true, value);
        }
    }
}

// Example Usage:

// Encoding a variable-length integer
try {
    const valueToEncode = 15293; // Example value
    const encodedVarint = writeVarint(valueToEncode);
    console.log("Encoded Varint:", Array.from(encodedVarint).map(b => b.toString(16).padStart(2, '0')).join(' '));
    // Expected Output for 15293: 01 7b bd
} catch (e) {
    console.error(e);
}

// Decoding a variable-length integer
try {
    const encodedData = new Uint8Array([0x7b, 0xbd]); // Example two-byte encoding
    const stream = new ByteStream(encodedData);
    const decodedValue = readVarint(stream);
    console.log("Decoded Varint:", decodedValue);
    // Expected Output: 15293
} catch (e) {
    console.error(e);
}

// Encoding an optional value
try {
    const optionalValue = new Optional(true, new Uint8Array([0x25])); // Present with value 0x25
    const encodedOptional = optionalValue.encode();
    console.log("Encoded Optional:", Array.from(encodedOptional).map(b => b.toString(16).padStart(2, '0')).join(' '));
    // Expected Output: 01 25
} catch (e) {
    console.error(e);
}

// Decoding an optional value
try {
    const encodedOptionalData = new Uint8Array([0x01, 0x25]); // Present with value 0x25
    const stream = new ByteStream(encodedOptionalData);
    const decodedOptional = Optional.decode(stream);
    console.log("Decoded Optional - Present:", decodedOptional.present);
    console.log("Decoded Optional - Value:", decodedOptional.value ? decodedOptional.value[0] : null);
    // Expected Output: true, 37
} catch (e) {
    console.error(e);
}
