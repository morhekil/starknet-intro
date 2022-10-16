import { uint256 } from "starknet";

const SHORT_STRING_MAX_CHARACTERS = 31;

export function shortStringToBigInt(convertableString) {
  if (!convertableString) {
    throw new Error("A non-empty string must be provided");
  }

  if (convertableString.length > SHORT_STRING_MAX_CHARACTERS) {
    const msg = `Short strings must have a max of ${SHORT_STRING_MAX_CHARACTERS} characters.`;
    throw new Error(msg);
  }

  const invalidChars = {};
  const charArray = [];
  for (const c of convertableString.split("")) {
    const charCode = c.charCodeAt(0);
    if (charCode > 127) {
      invalidChars[c] = true;
    }
    charArray.push(charCode.toString(16));
  }

  const invalidCharArray = Object.keys(invalidChars);
  if (invalidCharArray.length) {
    const msg = `Non-standard-ASCII character${
      invalidCharArray.length === 1 ? "" : "s"
    }: ${invalidCharArray.join(", ")}`;
    throw new Error(msg);
  }

  return BigInt("0x" + charArray.join(""));
}

export function toUint256WithFelts(num) {
  const n = uint256.bnToUint256(num);
  return [BigInt(n.low.toString()), BigInt(n.high.toString())];
}
