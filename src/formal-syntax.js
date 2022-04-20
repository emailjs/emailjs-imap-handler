// IMAP Formal Syntax
// http://tools.ietf.org/html/rfc3501#section-9

export const ASCII_NL = 10
export const ASCII_CR = 13
export const ASCII_SPACE = 32
export const ASCII_DQUOTE = 34 // "
export const ASCII_PERCENT_SIGN = 37 // %
export const ASCII_LEFT_PARENTHESIS = 40 // (
export const ASCII_RIGHT_PARENTHESIS = 41 // )
export const ASCII_ASTERISK = 42 // *
export const ASCII_PLUS = 43 // +
export const ASCII_COMMA = 44 // ,
export const ASCII_FULL_STOP = 46 // .
export const ASCII_COLON = 58 // :
export const ASCII_LESS_THAN_SIGN = 60 // <
export const ASCII_GREATER_THAN_SIGN = 62 // >
export const ASCII_LEFT_BRACKET = 91 // [
export const ASCII_BACKSLASH = 92 //
export const ASCII_RIGHT_BRACKET = 93 // ]
export const ASCII_LEFT_CURLY_BRACKET = 123 // {
export const ASCII_RIGHT_CURLY_BRACKET = 125 // }
export const ASCII_TILDE = 126 // ~

export const IS_CHAR = (chr) => chr >= 0x01 && chr <= 0x7F
export const IS_ATOM_CHAR = (chr) => IS_CHAR(chr) && !IS_ATOM_SPECIALS(chr)
export const IS_ATOM_SPECIALS = (chr) => chr === ASCII_LEFT_PARENTHESIS ||
  chr === ASCII_RIGHT_PARENTHESIS ||
  chr === ASCII_LEFT_CURLY_BRACKET ||
  chr === ASCII_SPACE ||
  IS_CTL(chr) ||
  IS_LIST_WILDCARDS(chr) ||
  IS_QUOTED_SPECIALS(chr) ||
  IS_RESP_SPECIALS(chr)
export const IS_CTL = (chr) => (chr >= 0x00 && chr <= 0x1F) || chr === 0x7F
export const IS_LIST_WILDCARDS = (chr) => chr === ASCII_PERCENT_SIGN || chr === ASCII_ASTERISK
export const IS_QUOTED_SPECIALS = (chr) => chr === ASCII_DQUOTE || chr === ASCII_BACKSLASH
export const IS_RESP_SPECIALS = (chr) => chr === ASCII_RIGHT_BRACKET
export const IS_DIGIT = (chr) => chr >= 0x30 && chr <= 0x39
export const IS_ALPHA = (chr) => (chr >= 0x41 && chr <= 0x5A) || (chr >= 0x61 && chr <= 0x7A)
export const IS_COMMAND = (chr) => IS_ALPHA(chr) || IS_DIGIT(chr)
export const IS_TAG = (chr) => IS_ASTRING_CHAR(chr) && chr !== ASCII_PLUS
export const IS_ASTRING_CHAR = (chr) => IS_ATOM_CHAR(chr) || IS_RESP_SPECIALS(chr)
