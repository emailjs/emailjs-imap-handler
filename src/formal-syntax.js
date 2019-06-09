import { memoizeWith, identity, without, range } from 'ramda'

// IMAP Formal Syntax
// http://tools.ietf.org/html/rfc3501#section-9

const expandRange = (start, end) => String.fromCharCode.apply(String, range(start, end + 1))
const excludeChars = (source, exclude) => without(exclude.split(''), source.split('')).join('')

export const CHAR = memoizeWith(identity, () => expandRange(0x01, 0x7F))
export const CHAR8 = memoizeWith(identity, () => expandRange(0x01, 0xFF))
export const SP = () => ' '
export const CTL = memoizeWith(identity, () => expandRange(0x00, 0x1F) + '\x7F')
export const DQUOTE = () => '"'
export const ALPHA = memoizeWith(identity, () => expandRange(0x41, 0x5A) + expandRange(0x61, 0x7A))
export const DIGIT = memoizeWith(identity, () => expandRange(0x30, 0x39) + expandRange(0x61, 0x7A))
export const ATOM_CHAR = memoizeWith(identity, () => excludeChars(CHAR(), ATOM_SPECIALS()))
export const ASTRING_CHAR = memoizeWith(identity, () => ATOM_CHAR() + RESP_SPECIALS())
export const TEXT_CHAR = memoizeWith(identity, () => excludeChars(CHAR(), '\r\n'))
export const ATOM_SPECIALS = memoizeWith(identity, () => '(' + ')' + '{' + SP() + CTL() + LIST_WILDCARDS() + QUOTED_SPECIALS() + RESP_SPECIALS())
export const LIST_WILDCARDS = () => '%' + '*'
export const QUOTED_SPECIALS = memoizeWith(identity, () => DQUOTE() + '\\')
export const RESP_SPECIALS = () => ']'
export const TAG = memoizeWith(identity, () => excludeChars(ASTRING_CHAR(), '+'))
export const COMMAND = memoizeWith(identity, () => ALPHA() + DIGIT())
export const verify = function (str, allowedChars) {
  for (var i = 0, len = str.length; i < len; i++) {
    if (allowedChars.indexOf(str.charAt(i)) < 0) {
      return i
    }
  }
  return -1
}
