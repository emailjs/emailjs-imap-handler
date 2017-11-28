import { memoize, without, range } from 'ramda'

// IMAP Formal Syntax
// http://tools.ietf.org/html/rfc3501#section-9

const expandRange = (start, end) => String.fromCharCode.apply(String, range(start, end + 1))
const excludeChars = (source, exclude) => without(exclude.split(''), source.split('')).join('')

export const CHAR = memoize(() => expandRange(0x01, 0x7F))
export const CHAR8 = memoize(() => expandRange(0x01, 0xFF))
export const SP = () => ' '
export const CTL = memoize(() => expandRange(0x00, 0x1F) + '\x7F')
export const DQUOTE = () => '"'
export const ALPHA = memoize(() => expandRange(0x41, 0x5A) + expandRange(0x61, 0x7A))
export const DIGIT = memoize(() => expandRange(0x30, 0x39) + expandRange(0x61, 0x7A))
export const ATOM_CHAR = memoize(() => excludeChars(CHAR(), ATOM_SPECIALS()))
export const ASTRING_CHAR = memoize(() => ATOM_CHAR() + RESP_SPECIALS())
export const TEXT_CHAR = memoize(() => excludeChars(CHAR(), '\r\n'))
export const ATOM_SPECIALS = memoize(() => '(' + ')' + '{' + SP() + CTL() + LIST_WILDCARDS() + QUOTED_SPECIALS() + RESP_SPECIALS())
export const LIST_WILDCARDS = () => '%' + '*'
export const QUOTED_SPECIALS = memoize(() => DQUOTE() + '\\')
export const RESP_SPECIALS = () => ']'
export const TAG = memoize(() => excludeChars(ASTRING_CHAR(), '+'))
export const COMMAND = memoize(() => ALPHA() + DIGIT())
export const verify = function (str, allowedChars) {
  for (var i = 0, len = str.length; i < len; i++) {
    if (allowedChars.indexOf(str.charAt(i)) < 0) {
      return i
    }
  }
  return -1
}
