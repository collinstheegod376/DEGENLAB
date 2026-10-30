import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
export const shortId = customAlphabet(alphabet, 10);
export const shareId = customAlphabet(alphabet, 16);
