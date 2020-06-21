import { TextDecoder as _NodeTextDecoder, TextEncoder as _NodeTextEncoder } from 'util'

export function uint8ArrayFromBlob(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        // The old not nice way. (Safari, et. al.)
        const f = new FileReader()
        f.readAsArrayBuffer(blob)
        f.onloadend = () => {
            if (f.result == null) {
                console.info(blob)
                return reject("No data loaded from blob.")
            }
            if (typeof f.result == "string") {
                throw new Error("Unexpected type string for result.")
            } else {
                resolve(f.result)
            }
        }
    })
}

export const TextEncoder = 'TextEncoder' in global ? global.TextEncoder : _NodeTextEncoder
export const TextDecoder = 'TextDecoder' in global ? global.TextDecoder : _NodeTextDecoder
