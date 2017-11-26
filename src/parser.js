import {
  SP, DIGIT, ATOM_CHAR,
  TAG, COMMAND, verify
} from './formal-syntax'

let ASCII_NL = 10
let ASCII_CR = 13
let ASCII_SPACE = 32
let ASCII_LEFT_BRACKET = 91
let ASCII_RIGHT_BRACKET = 93

function fromCharCode (uint8Array) {
  const batchSize = 10240
  var strings = []

  for (var i = 0; i < uint8Array.length; i += batchSize) {
    const begin = i
    const end = Math.min(i + batchSize, uint8Array.length)
    strings.push(String.fromCharCode.apply(null, uint8Array.subarray(begin, end)))
  }

  return strings.join('')
}

function fromCharCodeTrimmed (uint8Array) {
  let begin = 0
  let end = uint8Array.length

  while (uint8Array[begin] === ASCII_SPACE) {
    begin++
  }

  while (uint8Array[end - 1] === ASCII_SPACE) {
    end--
  }

  if (begin !== 0 || end !== uint8Array.length) {
    uint8Array = uint8Array.subarray(begin, end)
  }

  return fromCharCode(uint8Array)
}

function isEmpty (uint8Array) {
  for (let i = 0; i < uint8Array.length; i++) {
    if (uint8Array[i] !== ASCII_SPACE) {
      return false
    }
  }

  return true
}

class ParserInstance {
  constructor (input, options) {
    this.remainder = new Uint8Array(input || 0)
    this.options = options || {}
    this.pos = 0
  }
  getTag () {
    if (!this.tag) {
      this.tag = this.getElement(TAG() + '*+', true)
    }
    return this.tag
  }

  getCommand () {
    if (!this.command) {
      this.command = this.getElement(COMMAND())
    }

    switch ((this.command || '').toString().toUpperCase()) {
      case 'OK':
      case 'NO':
      case 'BAD':
      case 'PREAUTH':
      case 'BYE':
        let lastRightBracket = this.remainder.lastIndexOf(ASCII_RIGHT_BRACKET)
        if (this.remainder[1] === ASCII_LEFT_BRACKET && lastRightBracket > 1) {
          this.humanReadable = fromCharCodeTrimmed(this.remainder.subarray(lastRightBracket + 1))
          this.remainder = this.remainder.subarray(0, lastRightBracket + 1)
        } else {
          this.humanReadable = fromCharCodeTrimmed(this.remainder)
          this.remainder = new Uint8Array(0)
        }
        break
    }

    return this.command
  }

  getElement (syntax) {
    let element
    if (this.remainder[0] === ASCII_SPACE) {
      throw new Error('Unexpected whitespace at position ' + this.pos)
    }

    let firstSpace = this.remainder.indexOf(ASCII_SPACE)
    if (this.remainder.length > 0 && firstSpace !== 0) {
      if (firstSpace === -1) {
        element = fromCharCode(this.remainder)
      } else {
        element = fromCharCode(this.remainder.subarray(0, firstSpace))
      }

      const errPos = verify(element, syntax)
      if (errPos >= 0) {
        throw new Error('Unexpected char at position ' + (this.pos + errPos))
      }
    } else {
      throw new Error('Unexpected end of input at position ' + this.pos)
    }

    this.pos += element.length
    this.remainder = this.remainder.subarray(element.length)

    return element
  }

  getSpace () {
    if (!this.remainder.length) {
      throw new Error('Unexpected end of input at position ' + this.pos)
    }

    if (verify(String.fromCharCode(this.remainder[0]), SP()) >= 0) {
      throw new Error('Unexpected char at position ' + this.pos)
    }

    this.pos++
    this.remainder = this.remainder.subarray(1)
  }

  getAttributes () {
    if (!this.remainder.length) {
      throw new Error('Unexpected end of input at position ' + this.pos)
    }

    if (this.remainder[0] === ASCII_SPACE) {
      throw new Error('Unexpected whitespace at position ' + this.pos)
    }

    return new TokenParser(this, this.pos, this.remainder.subarray(), this.options).getAttributes()
  }
}

class Node {
  constructor (uint8Array, parentNode, startPos) {
    this.uint8Array = uint8Array
    this.childNodes = []
    this.type = false
    this.closed = true
    this.valueSkip = []
    this.startPos = startPos
    this.valueStart = this.valueEnd = typeof startPos === 'number' ? startPos + 1 : 0

    if (parentNode) {
      this.parentNode = parentNode
      parentNode.childNodes.push(this)
    }
  }

  getValue () {
    let value = fromCharCode(this.getValueArray())
    return this.valueToUpperCase ? value.toUpperCase() : value
  }

  getValueLength () {
    return this.valueEnd - this.valueStart - this.valueSkip.length
  }

  getValueArray () {
    const valueArray = this.uint8Array.subarray(this.valueStart, this.valueEnd)

    if (this.valueSkip.length === 0) {
      return valueArray
    }

    let filteredArray = new Uint8Array(valueArray.length - this.valueSkip.length)
    let begin = 0
    let offset = 0
    let skip = this.valueSkip.slice()

    skip.push(valueArray.length)

    skip.forEach(function (end) {
      if (end > begin) {
        var subArray = valueArray.subarray(begin, end)
        filteredArray.set(subArray, offset)
        offset += subArray.length
      }
      begin = end + 1
    })

    return filteredArray
  }

  equals (value, caseSensitive) {
    if (this.getValueLength() !== value.length) {
      return false
    }

    return this.equalsAt(value, 0, caseSensitive)
  }

  equalsAt (value, index, caseSensitive) {
    caseSensitive = typeof caseSensitive === 'boolean' ? caseSensitive : true

    if (index < 0) {
      index = this.valueEnd + index

      while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
        index--
      }
    } else {
      index = this.valueStart + index
    }

    for (let i = 0; i < value.length; i++) {
      while (this.valueSkip.indexOf(index - this.valueStart) >= 0) {
        index++
      }

      if (index >= this.valueEnd) {
        return false
      }

      let uint8Char = String.fromCharCode(this.uint8Array[index])
      let char = value[i]

      if (!caseSensitive) {
        uint8Char = uint8Char.toUpperCase()
        char = char.toUpperCase()
      }

      if (uint8Char !== char) {
        return false
      }

      index++
    }

    return true
  }

  isNumber () {
    for (let i = 0; i < this.valueEnd - this.valueStart; i++) {
      if (this.valueSkip.indexOf(i) >= 0) {
        continue
      }

      if (!this.isDigit(i)) {
        return false
      }
    }

    return true
  }

  isDigit (index) {
    if (index < 0) {
      index = this.valueEnd + index

      while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
        index--
      }
    } else {
      index = this.valueStart + index

      while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
        index++
      }
    }

    let ascii = this.uint8Array[index]
    return ascii >= 48 && ascii <= 57
  }

  containsChar (char) {
    let ascii = char.charCodeAt(0)

    for (let i = this.valueStart; i < this.valueEnd; i++) {
      if (this.valueSkip.indexOf(i - this.valueStart) >= 0) {
        continue
      }

      if (this.uint8Array[i] === ascii) {
        return true
      }
    }

    return false
  }
}

class TokenParser {
  constructor (parent, startPos, uint8Array, options = {}) {
    this.uint8Array = uint8Array
    this.options = options
    this.parent = parent

    this.tree = this.currentNode = this.createNode()
    this.pos = startPos || 0

    this.currentNode.type = 'TREE'

    this.state = 'NORMAL'

    if (this.options.valueAsString === undefined) {
      this.options.valueAsString = true
    }

    this.processString()
  }

  getAttributes () {
    let attributes = []
    let branch = attributes

    let walk = node => {
      let elm
      let curBranch = branch
      let partial

      if (!node.closed && node.type === 'SEQUENCE' && node.equals('*')) {
        node.closed = true
        node.type = 'ATOM'
      }

    // If the node was never closed, throw it
      if (!node.closed) {
        throw new Error('Unexpected end of input at position ' + (this.pos + this.uint8Array.length - 1))
      }

      switch (node.type.toUpperCase()) {
        case 'LITERAL':
        case 'STRING':
          elm = {
            type: node.type.toUpperCase(),
            value: this.options.valueAsString ? node.getValue() : node.getValueArray()
          }
          branch.push(elm)
          break
        case 'SEQUENCE':
          elm = {
            type: node.type.toUpperCase(),
            value: node.getValue()
          }
          branch.push(elm)
          break
        case 'ATOM':
          if (node.equals('NIL', true)) {
            branch.push(null)
            break
          }
          elm = {
            type: node.type.toUpperCase(),
            value: node.getValue()
          }
          branch.push(elm)
          break
        case 'SECTION':
          branch = branch[branch.length - 1].section = []
          break
        case 'LIST':
          elm = []
          branch.push(elm)
          branch = elm
          break
        case 'PARTIAL':
          partial = node.getValue().split('.').map(Number)
          branch[branch.length - 1].partial = partial
          break
      }

      node.childNodes.forEach(function (childNode) {
        walk(childNode)
      })
      branch = curBranch
    }

    walk(this.tree)

    return attributes
  }

  createNode (parentNode, startPos) {
    return new Node(this.uint8Array, parentNode, startPos)
  }

  processString () {
    let i
    let len
    const checkSP = (pos) => {
    // jump to the next non whitespace pos
      while (this.uint8Array[i + 1] === ' ') {
        i++
      }
    }

    for (i = 0, len = this.uint8Array.length; i < len; i++) {
      let chr = String.fromCharCode(this.uint8Array[i])

      switch (this.state) {
        case 'NORMAL':

          switch (chr) {
          // DQUOTE starts a new string
            case '"':
              this.currentNode = this.createNode(this.currentNode, i)
              this.currentNode.type = 'string'
              this.state = 'STRING'
              this.currentNode.closed = false
              break

          // ( starts a new list
            case '(':
              this.currentNode = this.createNode(this.currentNode, i)
              this.currentNode.type = 'LIST'
              this.currentNode.closed = false
              break

          // ) closes a list
            case ')':
              if (this.currentNode.type !== 'LIST') {
                throw new Error('Unexpected list terminator ) at position ' + (this.pos + i))
              }

              this.currentNode.closed = true
              this.currentNode.endPos = this.pos + i
              this.currentNode = this.currentNode.parentNode

              checkSP()
              break

          // ] closes section group
            case ']':
              if (this.currentNode.type !== 'SECTION') {
                throw new Error('Unexpected section terminator ] at position ' + (this.pos + i))
              }
              this.currentNode.closed = true
              this.currentNode.endPos = this.pos + i
              this.currentNode = this.currentNode.parentNode
              checkSP()
              break

          // < starts a new partial
            case '<':
              if (String.fromCharCode(this.uint8Array[i - 1]) !== ']') {
                this.currentNode = this.createNode(this.currentNode, i)
                this.currentNode.type = 'ATOM'
                this.currentNode.valueStart = i
                this.currentNode.valueEnd = i + 1
                this.state = 'ATOM'
              } else {
                this.currentNode = this.createNode(this.currentNode, i)
                this.currentNode.type = 'PARTIAL'
                this.state = 'PARTIAL'
                this.currentNode.closed = false
              }
              break

          // { starts a new literal
            case '{':
              this.currentNode = this.createNode(this.currentNode, i)
              this.currentNode.type = 'LITERAL'
              this.state = 'LITERAL'
              this.currentNode.closed = false
              break

          // ( starts a new sequence
            case '*':
              this.currentNode = this.createNode(this.currentNode, i)
              this.currentNode.type = 'SEQUENCE'
              this.currentNode.valueStart = i
              this.currentNode.valueEnd = i + 1
              this.currentNode.closed = false
              this.state = 'SEQUENCE'
              break

          // normally a space should never occur
            case ' ':
            // just ignore
              break

          // [ starts section
            case '[':
            // If it is the *first* element after response command, then process as a response argument list
              if (['OK', 'NO', 'BAD', 'BYE', 'PREAUTH'].indexOf(this.parent.command.toUpperCase()) >= 0 && this.currentNode === this.tree) {
                this.currentNode.endPos = this.pos + i

                this.currentNode = this.createNode(this.currentNode, i)
                this.currentNode.type = 'ATOM'

                this.currentNode = this.createNode(this.currentNode, i)
                this.currentNode.type = 'SECTION'
                this.currentNode.closed = false
                this.state = 'NORMAL'

              // RFC2221 defines a response code REFERRAL whose payload is an
              // RFC2192/RFC5092 imapurl that we will try to parse as an ATOM but
              // fail quite badly at parsing.  Since the imapurl is such a unique
              // (and crazy) term, we just specialize that case here.
                if (fromCharCode(this.uint8Array.subarray(i + 1, i + 10)).toUpperCase() === 'REFERRAL ') {
                // create the REFERRAL atom
                  this.currentNode = this.createNode(this.currentNode, this.pos + i + 1)
                  this.currentNode.type = 'ATOM'
                  this.currentNode.endPos = this.pos + i + 8
                  this.currentNode.valueStart = i + 1
                  this.currentNode.valueEnd = i + 9
                  this.currentNode.valueToUpperCase = true
                  this.currentNode = this.currentNode.parentNode

                // eat all the way through the ] to be the  IMAPURL token.
                  this.currentNode = this.createNode(this.currentNode, this.pos + i + 10)
                // just call this an ATOM, even though IMAPURL might be more correct
                  this.currentNode.type = 'ATOM'
                // jump i to the ']'
                  i = this.uint8Array.indexOf(ASCII_RIGHT_BRACKET, i + 10)
                  this.currentNode.endPos = this.pos + i - 1
                  this.currentNode.valueStart = this.currentNode.startPos - this.pos
                  this.currentNode.valueEnd = this.currentNode.endPos - this.pos + 1
                  this.currentNode = this.currentNode.parentNode

                // close out the SECTION
                  this.currentNode.closed = true
                  this.currentNode = this.currentNode.parentNode
                  checkSP()
                }

                break
              }
          /* falls through */
            default:
            // Any ATOM supported char starts a new Atom sequence, otherwise throw an error
            // Allow \ as the first char for atom to support system flags
            // Allow % to support LIST '' %
              if (ATOM_CHAR().indexOf(chr) < 0 && chr !== '\\' && chr !== '%') {
                throw new Error('Unexpected char at position ' + (this.pos + i))
              }

              this.currentNode = this.createNode(this.currentNode, i)
              this.currentNode.type = 'ATOM'
              this.currentNode.valueStart = i
              this.currentNode.valueEnd = i + 1
              this.state = 'ATOM'
              break
          }
          break

        case 'ATOM':

        // space finishes an atom
          if (chr === ' ') {
            this.currentNode.endPos = this.pos + i - 1
            this.currentNode = this.currentNode.parentNode
            this.state = 'NORMAL'
            break
          }

        //
          if (
          this.currentNode.parentNode &&
          (
            (chr === ')' && this.currentNode.parentNode.type === 'LIST') ||
            (chr === ']' && this.currentNode.parentNode.type === 'SECTION')
          )
        ) {
            this.currentNode.endPos = this.pos + i - 1
            this.currentNode = this.currentNode.parentNode

            this.currentNode.closed = true
            this.currentNode.endPos = this.pos + i
            this.currentNode = this.currentNode.parentNode
            this.state = 'NORMAL'

            checkSP()
            break
          }

          if ((chr === ',' || chr === ':') && this.currentNode.isNumber()) {
            this.currentNode.type = 'SEQUENCE'
            this.currentNode.closed = true
            this.state = 'SEQUENCE'
          }

        // [ starts a section group for this element
          if (chr === '[' && (this.currentNode.equals('BODY', false) || this.currentNode.equals('BODY.PEEK', false))) {
            this.currentNode.endPos = this.pos + i
            this.currentNode = this.createNode(this.currentNode.parentNode, this.pos + i)
            this.currentNode.type = 'SECTION'
            this.currentNode.closed = false
            this.state = 'NORMAL'
            break
          }

          if (chr === '<') {
            throw new Error('Unexpected start of partial at position ' + this.pos)
          }

        // if the char is not ATOM compatible, throw. Allow \* as an exception
          if (ATOM_CHAR().indexOf(chr) < 0 && chr !== ']' && !(chr === '*' && this.currentNode.equals('\\'))) {
            throw new Error('Unexpected char at position ' + (this.pos + i))
          } else if (this.currentNode.equals('\\*')) {
            throw new Error('Unexpected char at position ' + (this.pos + i))
          }

          this.currentNode.valueEnd = i + 1
          break

        case 'STRING':

        // DQUOTE ends the string sequence
          if (chr === '"') {
            this.currentNode.endPos = this.pos + i
            this.currentNode.closed = true
            this.currentNode = this.currentNode.parentNode
            this.state = 'NORMAL'

            checkSP()
            break
          }

        // \ Escapes the following char
          if (chr === '\\') {
            this.currentNode.valueSkip.push(i - this.currentNode.valueStart)
            i++
            if (i >= len) {
              throw new Error('Unexpected end of input at position ' + (this.pos + i))
            }
            chr = String.fromCharCode(this.uint8Array[i])
          }

        /* // skip this check, otherwise the parser might explode on binary input
        if (TEXT_CHAR().indexOf(chr) < 0) {
            throw new Error('Unexpected char at position ' + (this.pos + i));
        }
        */

          this.currentNode.valueEnd = i + 1
          break

        case 'PARTIAL':
          if (chr === '>') {
            if (this.currentNode.equalsAt('.', -1)) {
              throw new Error('Unexpected end of partial at position ' + this.pos)
            }
            this.currentNode.endPos = this.pos + i
            this.currentNode.closed = true
            this.currentNode = this.currentNode.parentNode
            this.state = 'NORMAL'
            checkSP()
            break
          }

          if (chr === '.' && (!this.currentNode.getValueLength() || this.currentNode.containsChar('.'))) {
            throw new Error('Unexpected partial separator . at position ' + this.pos)
          }

          if (DIGIT().indexOf(chr) < 0 && chr !== '.') {
            throw new Error('Unexpected char at position ' + (this.pos + i))
          }

          if (chr !== '.' && (this.currentNode.equals('0') || this.currentNode.equalsAt('.0', -2))) {
            throw new Error('Invalid partial at position ' + (this.pos + i))
          }

          this.currentNode.valueEnd = i + 1
          break

        case 'LITERAL':
          if (this.currentNode.started) {
            if (chr === '\u0000') {
              throw new Error('Unexpected \\x00 at position ' + (this.pos + i))
            }
            this.currentNode.valueEnd = i + 1

            if (this.currentNode.getValueLength() >= this.currentNode.literalLength) {
              this.currentNode.endPos = this.pos + i
              this.currentNode.closed = true
              this.currentNode = this.currentNode.parentNode
              this.state = 'NORMAL'
              checkSP()
            }
            break
          }

          if (chr === '+' && this.options.literalPlus) {
            this.currentNode.literalPlus = true
            break
          }

          if (chr === '}') {
            if (!('literalLength' in this.currentNode)) {
              throw new Error('Unexpected literal prefix end char } at position ' + (this.pos + i))
            }
            if (this.uint8Array[i + 1] === ASCII_NL) {
              i++
            } else if (this.uint8Array[i + 1] === ASCII_CR && this.uint8Array[i + 2] === ASCII_NL) {
              i += 2
            } else {
              throw new Error('Unexpected char at position ' + (this.pos + i))
            }
            this.currentNode.valueStart = i + 1
            this.currentNode.literalLength = Number(this.currentNode.literalLength)
            this.currentNode.started = true

            if (!this.currentNode.literalLength) {
            // special case where literal content length is 0
            // close the node right away, do not wait for additional input
              this.currentNode.endPos = this.pos + i
              this.currentNode.closed = true
              this.currentNode = this.currentNode.parentNode
              this.state = 'NORMAL'
              checkSP()
            }
            break
          }
          if (DIGIT().indexOf(chr) < 0) {
            throw new Error('Unexpected char at position ' + (this.pos + i))
          }
          if (this.currentNode.literalLength === '0') {
            throw new Error('Invalid literal at position ' + (this.pos + i))
          }
          this.currentNode.literalLength = (this.currentNode.literalLength || '') + chr
          break

        case 'SEQUENCE':
        // space finishes the sequence set
          if (chr === ' ') {
            if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
              throw new Error('Unexpected whitespace at position ' + (this.pos + i))
            }

            if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
              throw new Error('Unexpected whitespace at position ' + (this.pos + i))
            }

            this.currentNode.closed = true
            this.currentNode.endPos = this.pos + i - 1
            this.currentNode = this.currentNode.parentNode
            this.state = 'NORMAL'
            break
          } else if (this.currentNode.parentNode &&
          chr === ']' &&
          this.currentNode.parentNode.type === 'SECTION') {
            this.currentNode.endPos = this.pos + i - 1
            this.currentNode = this.currentNode.parentNode

            this.currentNode.closed = true
            this.currentNode.endPos = this.pos + i
            this.currentNode = this.currentNode.parentNode
            this.state = 'NORMAL'

            checkSP()
            break
          }

          if (chr === ':') {
            if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
              throw new Error('Unexpected range separator : at position ' + (this.pos + i))
            }
          } else if (chr === '*') {
            if (!this.currentNode.equalsAt(',', -1) && !this.currentNode.equalsAt(':', -1)) {
              throw new Error('Unexpected range wildcard at position ' + (this.pos + i))
            }
          } else if (chr === ',') {
            if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
              throw new Error('Unexpected sequence separator , at position ' + (this.pos + i))
            }
            if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
              throw new Error('Unexpected sequence separator , at position ' + (this.pos + i))
            }
          } else if (!/\d/.test(chr)) {
            throw new Error('Unexpected char at position ' + (this.pos + i))
          }

          if (/\d/.test(chr) && this.currentNode.equalsAt('*', -1)) {
            throw new Error('Unexpected number at position ' + (this.pos + i))
          }

          this.currentNode.valueEnd = i + 1
          break
      }
    }
  }
}

export default function (buffers, options = {}) {
  let parser = new ParserInstance(buffers, options)
  let response = {}

  response.tag = parser.getTag()
  parser.getSpace()
  response.command = parser.getCommand()

  if (['UID', 'AUTHENTICATE'].indexOf((response.command || '').toUpperCase()) >= 0) {
    parser.getSpace()
    response.command += ' ' + parser.getElement(COMMAND())
  }

  if (!isEmpty(parser.remainder)) {
    parser.getSpace()
    response.attributes = parser.getAttributes()
  }

  if (parser.humanReadable) {
    response.attributes = (response.attributes || []).concat({
      type: 'TEXT',
      value: parser.humanReadable
    })
  }

  return response
}
