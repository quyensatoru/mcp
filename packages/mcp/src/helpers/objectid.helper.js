import mongoose from 'mongoose';

const { ObjectId } = mongoose.Types;

export function toObjectId(value) {
    if (value instanceof ObjectId) return value;
    if (ObjectId.isValid(value)) return new ObjectId(value);
    throw new Error(`Invalid ObjectId: ${value}`);
}

export function tryObjectId(value) {
    try {
        return toObjectId(value);
    } catch {
        return null;
    }
}
