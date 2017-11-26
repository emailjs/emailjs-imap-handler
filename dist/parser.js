'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = function (buffers) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var parser = new ParserInstance(buffers, options);
  var response = {};

  response.tag = parser.getTag();
  parser.getSpace();
  response.command = parser.getCommand();

  if (['UID', 'AUTHENTICATE'].indexOf((response.command || '').toUpperCase()) >= 0) {
    parser.getSpace();
    response.command += ' ' + parser.getElement((0, _formalSyntax.COMMAND)());
  }

  if (!isEmpty(parser.remainder)) {
    parser.getSpace();
    response.attributes = parser.getAttributes();
  }

  if (parser.humanReadable) {
    response.attributes = (response.attributes || []).concat({
      type: 'TEXT',
      value: parser.humanReadable
    });
  }

  return response;
};

var _formalSyntax = require('./formal-syntax');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ASCII_NL = 10;
var ASCII_CR = 13;
var ASCII_SPACE = 32;
var ASCII_LEFT_BRACKET = 91;
var ASCII_RIGHT_BRACKET = 93;

function fromCharCode(uint8Array) {
  var batchSize = 10240;
  var strings = [];

  for (var i = 0; i < uint8Array.length; i += batchSize) {
    var begin = i;
    var end = Math.min(i + batchSize, uint8Array.length);
    strings.push(String.fromCharCode.apply(null, uint8Array.subarray(begin, end)));
  }

  return strings.join('');
}

function fromCharCodeTrimmed(uint8Array) {
  var begin = 0;
  var end = uint8Array.length;

  while (uint8Array[begin] === ASCII_SPACE) {
    begin++;
  }

  while (uint8Array[end - 1] === ASCII_SPACE) {
    end--;
  }

  if (begin !== 0 || end !== uint8Array.length) {
    uint8Array = uint8Array.subarray(begin, end);
  }

  return fromCharCode(uint8Array);
}

function isEmpty(uint8Array) {
  for (var i = 0; i < uint8Array.length; i++) {
    if (uint8Array[i] !== ASCII_SPACE) {
      return false;
    }
  }

  return true;
}

var ParserInstance = function () {
  function ParserInstance(input, options) {
    _classCallCheck(this, ParserInstance);

    this.remainder = new Uint8Array(input || 0);
    this.options = options || {};
    this.pos = 0;
  }

  _createClass(ParserInstance, [{
    key: 'getTag',
    value: function getTag() {
      if (!this.tag) {
        this.tag = this.getElement((0, _formalSyntax.TAG)() + '*+', true);
      }
      return this.tag;
    }
  }, {
    key: 'getCommand',
    value: function getCommand() {
      if (!this.command) {
        this.command = this.getElement((0, _formalSyntax.COMMAND)());
      }

      switch ((this.command || '').toString().toUpperCase()) {
        case 'OK':
        case 'NO':
        case 'BAD':
        case 'PREAUTH':
        case 'BYE':
          var lastRightBracket = this.remainder.lastIndexOf(ASCII_RIGHT_BRACKET);
          if (this.remainder[1] === ASCII_LEFT_BRACKET && lastRightBracket > 1) {
            this.humanReadable = fromCharCodeTrimmed(this.remainder.subarray(lastRightBracket + 1));
            this.remainder = this.remainder.subarray(0, lastRightBracket + 1);
          } else {
            this.humanReadable = fromCharCodeTrimmed(this.remainder);
            this.remainder = new Uint8Array(0);
          }
          break;
      }

      return this.command;
    }
  }, {
    key: 'getElement',
    value: function getElement(syntax) {
      var element = void 0;
      if (this.remainder[0] === ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      var firstSpace = this.remainder.indexOf(ASCII_SPACE);
      if (this.remainder.length > 0 && firstSpace !== 0) {
        if (firstSpace === -1) {
          element = fromCharCode(this.remainder);
        } else {
          element = fromCharCode(this.remainder.subarray(0, firstSpace));
        }

        var errPos = (0, _formalSyntax.verify)(element, syntax);
        if (errPos >= 0) {
          throw new Error('Unexpected char at position ' + (this.pos + errPos));
        }
      } else {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      this.pos += element.length;
      this.remainder = this.remainder.subarray(element.length);

      return element;
    }
  }, {
    key: 'getSpace',
    value: function getSpace() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if ((0, _formalSyntax.verify)(String.fromCharCode(this.remainder[0]), (0, _formalSyntax.SP)()) >= 0) {
        throw new Error('Unexpected char at position ' + this.pos);
      }

      this.pos++;
      this.remainder = this.remainder.subarray(1);
    }
  }, {
    key: 'getAttributes',
    value: function getAttributes() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if (this.remainder[0] === ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      return new TokenParser(this, this.pos, this.remainder.subarray(), this.options).getAttributes();
    }
  }]);

  return ParserInstance;
}();

var Node = function () {
  function Node(uint8Array, parentNode, startPos) {
    _classCallCheck(this, Node);

    this.uint8Array = uint8Array;
    this.childNodes = [];
    this.type = false;
    this.closed = true;
    this.valueSkip = [];
    this.startPos = startPos;
    this.valueStart = this.valueEnd = typeof startPos === 'number' ? startPos + 1 : 0;

    if (parentNode) {
      this.parentNode = parentNode;
      parentNode.childNodes.push(this);
    }
  }

  _createClass(Node, [{
    key: 'getValue',
    value: function getValue() {
      var value = fromCharCode(this.getValueArray());
      return this.valueToUpperCase ? value.toUpperCase() : value;
    }
  }, {
    key: 'getValueLength',
    value: function getValueLength() {
      return this.valueEnd - this.valueStart - this.valueSkip.length;
    }
  }, {
    key: 'getValueArray',
    value: function getValueArray() {
      var valueArray = this.uint8Array.subarray(this.valueStart, this.valueEnd);

      if (this.valueSkip.length === 0) {
        return valueArray;
      }

      var filteredArray = new Uint8Array(valueArray.length - this.valueSkip.length);
      var begin = 0;
      var offset = 0;
      var skip = this.valueSkip.slice();

      skip.push(valueArray.length);

      skip.forEach(function (end) {
        if (end > begin) {
          var subArray = valueArray.subarray(begin, end);
          filteredArray.set(subArray, offset);
          offset += subArray.length;
        }
        begin = end + 1;
      });

      return filteredArray;
    }
  }, {
    key: 'equals',
    value: function equals(value, caseSensitive) {
      if (this.getValueLength() !== value.length) {
        return false;
      }

      return this.equalsAt(value, 0, caseSensitive);
    }
  }, {
    key: 'equalsAt',
    value: function equalsAt(value, index, caseSensitive) {
      caseSensitive = typeof caseSensitive === 'boolean' ? caseSensitive : true;

      if (index < 0) {
        index = this.valueEnd + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index--;
        }
      } else {
        index = this.valueStart + index;
      }

      for (var i = 0; i < value.length; i++) {
        while (this.valueSkip.indexOf(index - this.valueStart) >= 0) {
          index++;
        }

        if (index >= this.valueEnd) {
          return false;
        }

        var uint8Char = String.fromCharCode(this.uint8Array[index]);
        var char = value[i];

        if (!caseSensitive) {
          uint8Char = uint8Char.toUpperCase();
          char = char.toUpperCase();
        }

        if (uint8Char !== char) {
          return false;
        }

        index++;
      }

      return true;
    }
  }, {
    key: 'isNumber',
    value: function isNumber() {
      for (var i = 0; i < this.valueEnd - this.valueStart; i++) {
        if (this.valueSkip.indexOf(i) >= 0) {
          continue;
        }

        if (!this.isDigit(i)) {
          return false;
        }
      }

      return true;
    }
  }, {
    key: 'isDigit',
    value: function isDigit(index) {
      if (index < 0) {
        index = this.valueEnd + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index--;
        }
      } else {
        index = this.valueStart + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index++;
        }
      }

      var ascii = this.uint8Array[index];
      return ascii >= 48 && ascii <= 57;
    }
  }, {
    key: 'containsChar',
    value: function containsChar(char) {
      var ascii = char.charCodeAt(0);

      for (var i = this.valueStart; i < this.valueEnd; i++) {
        if (this.valueSkip.indexOf(i - this.valueStart) >= 0) {
          continue;
        }

        if (this.uint8Array[i] === ascii) {
          return true;
        }
      }

      return false;
    }
  }]);

  return Node;
}();

var TokenParser = function () {
  function TokenParser(parent, startPos, uint8Array) {
    var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    _classCallCheck(this, TokenParser);

    this.uint8Array = uint8Array;
    this.options = options;
    this.parent = parent;

    this.tree = this.currentNode = this.createNode();
    this.pos = startPos || 0;

    this.currentNode.type = 'TREE';

    this.state = 'NORMAL';

    if (this.options.valueAsString === undefined) {
      this.options.valueAsString = true;
    }

    this.processString();
  }

  _createClass(TokenParser, [{
    key: 'getAttributes',
    value: function getAttributes() {
      var _this = this;

      var attributes = [];
      var branch = attributes;

      var walk = function walk(node) {
        var elm = void 0;
        var curBranch = branch;
        var partial = void 0;

        if (!node.closed && node.type === 'SEQUENCE' && node.equals('*')) {
          node.closed = true;
          node.type = 'ATOM';
        }

        // If the node was never closed, throw it
        if (!node.closed) {
          throw new Error('Unexpected end of input at position ' + (_this.pos + _this.uint8Array.length - 1));
        }

        switch (node.type.toUpperCase()) {
          case 'LITERAL':
          case 'STRING':
            elm = {
              type: node.type.toUpperCase(),
              value: _this.options.valueAsString ? node.getValue() : node.getValueArray()
            };
            branch.push(elm);
            break;
          case 'SEQUENCE':
            elm = {
              type: node.type.toUpperCase(),
              value: node.getValue()
            };
            branch.push(elm);
            break;
          case 'ATOM':
            if (node.equals('NIL', true)) {
              branch.push(null);
              break;
            }
            elm = {
              type: node.type.toUpperCase(),
              value: node.getValue()
            };
            branch.push(elm);
            break;
          case 'SECTION':
            branch = branch[branch.length - 1].section = [];
            break;
          case 'LIST':
            elm = [];
            branch.push(elm);
            branch = elm;
            break;
          case 'PARTIAL':
            partial = node.getValue().split('.').map(Number);
            branch[branch.length - 1].partial = partial;
            break;
        }

        node.childNodes.forEach(function (childNode) {
          walk(childNode);
        });
        branch = curBranch;
      };

      walk(this.tree);

      return attributes;
    }
  }, {
    key: 'createNode',
    value: function createNode(parentNode, startPos) {
      return new Node(this.uint8Array, parentNode, startPos);
    }
  }, {
    key: 'processString',
    value: function processString() {
      var _this2 = this;

      var i = void 0;
      var len = void 0;
      var checkSP = function checkSP(pos) {
        // jump to the next non whitespace pos
        while (_this2.uint8Array[i + 1] === ' ') {
          i++;
        }
      };

      for (i = 0, len = this.uint8Array.length; i < len; i++) {
        var chr = String.fromCharCode(this.uint8Array[i]);

        switch (this.state) {
          case 'NORMAL':

            switch (chr) {
              // DQUOTE starts a new string
              case '"':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'string';
                this.state = 'STRING';
                this.currentNode.closed = false;
                break;

              // ( starts a new list
              case '(':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LIST';
                this.currentNode.closed = false;
                break;

              // ) closes a list
              case ')':
                if (this.currentNode.type !== 'LIST') {
                  throw new Error('Unexpected list terminator ) at position ' + (this.pos + i));
                }

                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;

                checkSP();
                break;

              // ] closes section group
              case ']':
                if (this.currentNode.type !== 'SECTION') {
                  throw new Error('Unexpected section terminator ] at position ' + (this.pos + i));
                }
                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;
                checkSP();
                break;

              // < starts a new partial
              case '<':
                if (String.fromCharCode(this.uint8Array[i - 1]) !== ']') {
                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'ATOM';
                  this.currentNode.valueStart = i;
                  this.currentNode.valueEnd = i + 1;
                  this.state = 'ATOM';
                } else {
                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'PARTIAL';
                  this.state = 'PARTIAL';
                  this.currentNode.closed = false;
                }
                break;

              // { starts a new literal
              case '{':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LITERAL';
                this.state = 'LITERAL';
                this.currentNode.closed = false;
                break;

              // ( starts a new sequence
              case '*':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'SEQUENCE';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.currentNode.closed = false;
                this.state = 'SEQUENCE';
                break;

              // normally a space should never occur
              case ' ':
                // just ignore
                break;

              // [ starts section
              case '[':
                // If it is the *first* element after response command, then process as a response argument list
                if (['OK', 'NO', 'BAD', 'BYE', 'PREAUTH'].indexOf(this.parent.command.toUpperCase()) >= 0 && this.currentNode === this.tree) {
                  this.currentNode.endPos = this.pos + i;

                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'ATOM';

                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'SECTION';
                  this.currentNode.closed = false;
                  this.state = 'NORMAL';

                  // RFC2221 defines a response code REFERRAL whose payload is an
                  // RFC2192/RFC5092 imapurl that we will try to parse as an ATOM but
                  // fail quite badly at parsing.  Since the imapurl is such a unique
                  // (and crazy) term, we just specialize that case here.
                  if (fromCharCode(this.uint8Array.subarray(i + 1, i + 10)).toUpperCase() === 'REFERRAL ') {
                    // create the REFERRAL atom
                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 1);
                    this.currentNode.type = 'ATOM';
                    this.currentNode.endPos = this.pos + i + 8;
                    this.currentNode.valueStart = i + 1;
                    this.currentNode.valueEnd = i + 9;
                    this.currentNode.valueToUpperCase = true;
                    this.currentNode = this.currentNode.parentNode;

                    // eat all the way through the ] to be the  IMAPURL token.
                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 10);
                    // just call this an ATOM, even though IMAPURL might be more correct
                    this.currentNode.type = 'ATOM';
                    // jump i to the ']'
                    i = this.uint8Array.indexOf(ASCII_RIGHT_BRACKET, i + 10);
                    this.currentNode.endPos = this.pos + i - 1;
                    this.currentNode.valueStart = this.currentNode.startPos - this.pos;
                    this.currentNode.valueEnd = this.currentNode.endPos - this.pos + 1;
                    this.currentNode = this.currentNode.parentNode;

                    // close out the SECTION
                    this.currentNode.closed = true;
                    this.currentNode = this.currentNode.parentNode;
                    checkSP();
                  }

                  break;
                }
              /* falls through */
              default:
                // Any ATOM supported char starts a new Atom sequence, otherwise throw an error
                // Allow \ as the first char for atom to support system flags
                // Allow % to support LIST '' %
                if ((0, _formalSyntax.ATOM_CHAR)().indexOf(chr) < 0 && chr !== '\\' && chr !== '%') {
                  throw new Error('Unexpected char at position ' + (this.pos + i));
                }

                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'ATOM';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.state = 'ATOM';
                break;
            }
            break;

          case 'ATOM':

            // space finishes an atom
            if (chr === ' ') {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            }

            //
            if (this.currentNode.parentNode && (chr === ')' && this.currentNode.parentNode.type === 'LIST' || chr === ']' && this.currentNode.parentNode.type === 'SECTION')) {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if ((chr === ',' || chr === ':') && this.currentNode.isNumber()) {
              this.currentNode.type = 'SEQUENCE';
              this.currentNode.closed = true;
              this.state = 'SEQUENCE';
            }

            // [ starts a section group for this element
            if (chr === '[' && (this.currentNode.equals('BODY', false) || this.currentNode.equals('BODY.PEEK', false))) {
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.createNode(this.currentNode.parentNode, this.pos + i);
              this.currentNode.type = 'SECTION';
              this.currentNode.closed = false;
              this.state = 'NORMAL';
              break;
            }

            if (chr === '<') {
              throw new Error('Unexpected start of partial at position ' + this.pos);
            }

            // if the char is not ATOM compatible, throw. Allow \* as an exception
            if ((0, _formalSyntax.ATOM_CHAR)().indexOf(chr) < 0 && chr !== ']' && !(chr === '*' && this.currentNode.equals('\\'))) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            } else if (this.currentNode.equals('\\*')) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'STRING':

            // DQUOTE ends the string sequence
            if (chr === '"') {
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            // \ Escapes the following char
            if (chr === '\\') {
              this.currentNode.valueSkip.push(i - this.currentNode.valueStart);
              i++;
              if (i >= len) {
                throw new Error('Unexpected end of input at position ' + (this.pos + i));
              }
              chr = String.fromCharCode(this.uint8Array[i]);
            }

            /* // skip this check, otherwise the parser might explode on binary input
            if (TEXT_CHAR().indexOf(chr) < 0) {
                throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            */

            this.currentNode.valueEnd = i + 1;
            break;

          case 'PARTIAL':
            if (chr === '>') {
              if (this.currentNode.equalsAt('.', -1)) {
                throw new Error('Unexpected end of partial at position ' + this.pos);
              }
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              checkSP();
              break;
            }

            if (chr === '.' && (!this.currentNode.getValueLength() || this.currentNode.containsChar('.'))) {
              throw new Error('Unexpected partial separator . at position ' + this.pos);
            }

            if ((0, _formalSyntax.DIGIT)().indexOf(chr) < 0 && chr !== '.') {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if (chr !== '.' && (this.currentNode.equals('0') || this.currentNode.equalsAt('.0', -2))) {
              throw new Error('Invalid partial at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'LITERAL':
            if (this.currentNode.started) {
              if (chr === '\0') {
                throw new Error('Unexpected \\x00 at position ' + (this.pos + i));
              }
              this.currentNode.valueEnd = i + 1;

              if (this.currentNode.getValueLength() >= this.currentNode.literalLength) {
                this.currentNode.endPos = this.pos + i;
                this.currentNode.closed = true;
                this.currentNode = this.currentNode.parentNode;
                this.state = 'NORMAL';
                checkSP();
              }
              break;
            }

            if (chr === '+' && this.options.literalPlus) {
              this.currentNode.literalPlus = true;
              break;
            }

            if (chr === '}') {
              if (!('literalLength' in this.currentNode)) {
                throw new Error('Unexpected literal prefix end char } at position ' + (this.pos + i));
              }
              if (this.uint8Array[i + 1] === ASCII_NL) {
                i++;
              } else if (this.uint8Array[i + 1] === ASCII_CR && this.uint8Array[i + 2] === ASCII_NL) {
                i += 2;
              } else {
                throw new Error('Unexpected char at position ' + (this.pos + i));
              }
              this.currentNode.valueStart = i + 1;
              this.currentNode.literalLength = Number(this.currentNode.literalLength);
              this.currentNode.started = true;

              if (!this.currentNode.literalLength) {
                // special case where literal content length is 0
                // close the node right away, do not wait for additional input
                this.currentNode.endPos = this.pos + i;
                this.currentNode.closed = true;
                this.currentNode = this.currentNode.parentNode;
                this.state = 'NORMAL';
                checkSP();
              }
              break;
            }
            if ((0, _formalSyntax.DIGIT)().indexOf(chr) < 0) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            if (this.currentNode.literalLength === '0') {
              throw new Error('Invalid literal at position ' + (this.pos + i));
            }
            this.currentNode.literalLength = (this.currentNode.literalLength || '') + chr;
            break;

          case 'SEQUENCE':
            // space finishes the sequence set
            if (chr === ' ') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected whitespace at position ' + (this.pos + i));
              }

              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected whitespace at position ' + (this.pos + i));
              }

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            } else if (this.currentNode.parentNode && chr === ']' && this.currentNode.parentNode.type === 'SECTION') {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if (chr === ':') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected range separator : at position ' + (this.pos + i));
              }
            } else if (chr === '*') {
              if (!this.currentNode.equalsAt(',', -1) && !this.currentNode.equalsAt(':', -1)) {
                throw new Error('Unexpected range wildcard at position ' + (this.pos + i));
              }
            } else if (chr === ',') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
            } else if (!/\d/.test(chr)) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if (/\d/.test(chr) && this.currentNode.equalsAt('*', -1)) {
              throw new Error('Unexpected number at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;
        }
      }
    }
  }]);

  return TokenParser;
}();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wYXJzZXIuanMiXSwibmFtZXMiOlsiYnVmZmVycyIsIm9wdGlvbnMiLCJwYXJzZXIiLCJQYXJzZXJJbnN0YW5jZSIsInJlc3BvbnNlIiwidGFnIiwiZ2V0VGFnIiwiZ2V0U3BhY2UiLCJjb21tYW5kIiwiZ2V0Q29tbWFuZCIsImluZGV4T2YiLCJ0b1VwcGVyQ2FzZSIsImdldEVsZW1lbnQiLCJpc0VtcHR5IiwicmVtYWluZGVyIiwiYXR0cmlidXRlcyIsImdldEF0dHJpYnV0ZXMiLCJodW1hblJlYWRhYmxlIiwiY29uY2F0IiwidHlwZSIsInZhbHVlIiwiQVNDSUlfTkwiLCJBU0NJSV9DUiIsIkFTQ0lJX1NQQUNFIiwiQVNDSUlfTEVGVF9CUkFDS0VUIiwiQVNDSUlfUklHSFRfQlJBQ0tFVCIsImZyb21DaGFyQ29kZSIsInVpbnQ4QXJyYXkiLCJiYXRjaFNpemUiLCJzdHJpbmdzIiwiaSIsImxlbmd0aCIsImJlZ2luIiwiZW5kIiwiTWF0aCIsIm1pbiIsInB1c2giLCJTdHJpbmciLCJhcHBseSIsInN1YmFycmF5Iiwiam9pbiIsImZyb21DaGFyQ29kZVRyaW1tZWQiLCJpbnB1dCIsIlVpbnQ4QXJyYXkiLCJwb3MiLCJ0b1N0cmluZyIsImxhc3RSaWdodEJyYWNrZXQiLCJsYXN0SW5kZXhPZiIsInN5bnRheCIsImVsZW1lbnQiLCJFcnJvciIsImZpcnN0U3BhY2UiLCJlcnJQb3MiLCJUb2tlblBhcnNlciIsIk5vZGUiLCJwYXJlbnROb2RlIiwic3RhcnRQb3MiLCJjaGlsZE5vZGVzIiwiY2xvc2VkIiwidmFsdWVTa2lwIiwidmFsdWVTdGFydCIsInZhbHVlRW5kIiwiZ2V0VmFsdWVBcnJheSIsInZhbHVlVG9VcHBlckNhc2UiLCJ2YWx1ZUFycmF5IiwiZmlsdGVyZWRBcnJheSIsIm9mZnNldCIsInNraXAiLCJzbGljZSIsImZvckVhY2giLCJzdWJBcnJheSIsInNldCIsImNhc2VTZW5zaXRpdmUiLCJnZXRWYWx1ZUxlbmd0aCIsImVxdWFsc0F0IiwiaW5kZXgiLCJ1aW50OENoYXIiLCJjaGFyIiwiaXNEaWdpdCIsImFzY2lpIiwiY2hhckNvZGVBdCIsInBhcmVudCIsInRyZWUiLCJjdXJyZW50Tm9kZSIsImNyZWF0ZU5vZGUiLCJzdGF0ZSIsInZhbHVlQXNTdHJpbmciLCJ1bmRlZmluZWQiLCJwcm9jZXNzU3RyaW5nIiwiYnJhbmNoIiwid2FsayIsImVsbSIsImN1ckJyYW5jaCIsInBhcnRpYWwiLCJub2RlIiwiZXF1YWxzIiwiZ2V0VmFsdWUiLCJzZWN0aW9uIiwic3BsaXQiLCJtYXAiLCJOdW1iZXIiLCJjaGlsZE5vZGUiLCJsZW4iLCJjaGVja1NQIiwiY2hyIiwiZW5kUG9zIiwiaXNOdW1iZXIiLCJjb250YWluc0NoYXIiLCJzdGFydGVkIiwibGl0ZXJhbExlbmd0aCIsImxpdGVyYWxQbHVzIiwidGVzdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7a0JBbXhCZSxVQUFVQSxPQUFWLEVBQWlDO0FBQUEsTUFBZEMsT0FBYyx1RUFBSixFQUFJOztBQUM5QyxNQUFJQyxTQUFTLElBQUlDLGNBQUosQ0FBbUJILE9BQW5CLEVBQTRCQyxPQUE1QixDQUFiO0FBQ0EsTUFBSUcsV0FBVyxFQUFmOztBQUVBQSxXQUFTQyxHQUFULEdBQWVILE9BQU9JLE1BQVAsRUFBZjtBQUNBSixTQUFPSyxRQUFQO0FBQ0FILFdBQVNJLE9BQVQsR0FBbUJOLE9BQU9PLFVBQVAsRUFBbkI7O0FBRUEsTUFBSSxDQUFDLEtBQUQsRUFBUSxjQUFSLEVBQXdCQyxPQUF4QixDQUFnQyxDQUFDTixTQUFTSSxPQUFULElBQW9CLEVBQXJCLEVBQXlCRyxXQUF6QixFQUFoQyxLQUEyRSxDQUEvRSxFQUFrRjtBQUNoRlQsV0FBT0ssUUFBUDtBQUNBSCxhQUFTSSxPQUFULElBQW9CLE1BQU1OLE9BQU9VLFVBQVAsQ0FBa0IsNEJBQWxCLENBQTFCO0FBQ0Q7O0FBRUQsTUFBSSxDQUFDQyxRQUFRWCxPQUFPWSxTQUFmLENBQUwsRUFBZ0M7QUFDOUJaLFdBQU9LLFFBQVA7QUFDQUgsYUFBU1csVUFBVCxHQUFzQmIsT0FBT2MsYUFBUCxFQUF0QjtBQUNEOztBQUVELE1BQUlkLE9BQU9lLGFBQVgsRUFBMEI7QUFDeEJiLGFBQVNXLFVBQVQsR0FBc0IsQ0FBQ1gsU0FBU1csVUFBVCxJQUF1QixFQUF4QixFQUE0QkcsTUFBNUIsQ0FBbUM7QUFDdkRDLFlBQU0sTUFEaUQ7QUFFdkRDLGFBQU9sQixPQUFPZTtBQUZ5QyxLQUFuQyxDQUF0QjtBQUlEOztBQUVELFNBQU9iLFFBQVA7QUFDRCxDOztBQTd5QkQ7Ozs7QUFLQSxJQUFJaUIsV0FBVyxFQUFmO0FBQ0EsSUFBSUMsV0FBVyxFQUFmO0FBQ0EsSUFBSUMsY0FBYyxFQUFsQjtBQUNBLElBQUlDLHFCQUFxQixFQUF6QjtBQUNBLElBQUlDLHNCQUFzQixFQUExQjs7QUFFQSxTQUFTQyxZQUFULENBQXVCQyxVQUF2QixFQUFtQztBQUNqQyxNQUFNQyxZQUFZLEtBQWxCO0FBQ0EsTUFBSUMsVUFBVSxFQUFkOztBQUVBLE9BQUssSUFBSUMsSUFBSSxDQUFiLEVBQWdCQSxJQUFJSCxXQUFXSSxNQUEvQixFQUF1Q0QsS0FBS0YsU0FBNUMsRUFBdUQ7QUFDckQsUUFBTUksUUFBUUYsQ0FBZDtBQUNBLFFBQU1HLE1BQU1DLEtBQUtDLEdBQUwsQ0FBU0wsSUFBSUYsU0FBYixFQUF3QkQsV0FBV0ksTUFBbkMsQ0FBWjtBQUNBRixZQUFRTyxJQUFSLENBQWFDLE9BQU9YLFlBQVAsQ0FBb0JZLEtBQXBCLENBQTBCLElBQTFCLEVBQWdDWCxXQUFXWSxRQUFYLENBQW9CUCxLQUFwQixFQUEyQkMsR0FBM0IsQ0FBaEMsQ0FBYjtBQUNEOztBQUVELFNBQU9KLFFBQVFXLElBQVIsQ0FBYSxFQUFiLENBQVA7QUFDRDs7QUFFRCxTQUFTQyxtQkFBVCxDQUE4QmQsVUFBOUIsRUFBMEM7QUFDeEMsTUFBSUssUUFBUSxDQUFaO0FBQ0EsTUFBSUMsTUFBTU4sV0FBV0ksTUFBckI7O0FBRUEsU0FBT0osV0FBV0ssS0FBWCxNQUFzQlQsV0FBN0IsRUFBMEM7QUFDeENTO0FBQ0Q7O0FBRUQsU0FBT0wsV0FBV00sTUFBTSxDQUFqQixNQUF3QlYsV0FBL0IsRUFBNEM7QUFDMUNVO0FBQ0Q7O0FBRUQsTUFBSUQsVUFBVSxDQUFWLElBQWVDLFFBQVFOLFdBQVdJLE1BQXRDLEVBQThDO0FBQzVDSixpQkFBYUEsV0FBV1ksUUFBWCxDQUFvQlAsS0FBcEIsRUFBMkJDLEdBQTNCLENBQWI7QUFDRDs7QUFFRCxTQUFPUCxhQUFhQyxVQUFiLENBQVA7QUFDRDs7QUFFRCxTQUFTZCxPQUFULENBQWtCYyxVQUFsQixFQUE4QjtBQUM1QixPQUFLLElBQUlHLElBQUksQ0FBYixFQUFnQkEsSUFBSUgsV0FBV0ksTUFBL0IsRUFBdUNELEdBQXZDLEVBQTRDO0FBQzFDLFFBQUlILFdBQVdHLENBQVgsTUFBa0JQLFdBQXRCLEVBQW1DO0FBQ2pDLGFBQU8sS0FBUDtBQUNEO0FBQ0Y7O0FBRUQsU0FBTyxJQUFQO0FBQ0Q7O0lBRUtwQixjO0FBQ0osMEJBQWF1QyxLQUFiLEVBQW9CekMsT0FBcEIsRUFBNkI7QUFBQTs7QUFDM0IsU0FBS2EsU0FBTCxHQUFpQixJQUFJNkIsVUFBSixDQUFlRCxTQUFTLENBQXhCLENBQWpCO0FBQ0EsU0FBS3pDLE9BQUwsR0FBZUEsV0FBVyxFQUExQjtBQUNBLFNBQUsyQyxHQUFMLEdBQVcsQ0FBWDtBQUNEOzs7OzZCQUNTO0FBQ1IsVUFBSSxDQUFDLEtBQUt2QyxHQUFWLEVBQWU7QUFDYixhQUFLQSxHQUFMLEdBQVcsS0FBS08sVUFBTCxDQUFnQiwyQkFBUSxJQUF4QixFQUE4QixJQUE5QixDQUFYO0FBQ0Q7QUFDRCxhQUFPLEtBQUtQLEdBQVo7QUFDRDs7O2lDQUVhO0FBQ1osVUFBSSxDQUFDLEtBQUtHLE9BQVYsRUFBbUI7QUFDakIsYUFBS0EsT0FBTCxHQUFlLEtBQUtJLFVBQUwsQ0FBZ0IsNEJBQWhCLENBQWY7QUFDRDs7QUFFRCxjQUFRLENBQUMsS0FBS0osT0FBTCxJQUFnQixFQUFqQixFQUFxQnFDLFFBQXJCLEdBQWdDbEMsV0FBaEMsRUFBUjtBQUNFLGFBQUssSUFBTDtBQUNBLGFBQUssSUFBTDtBQUNBLGFBQUssS0FBTDtBQUNBLGFBQUssU0FBTDtBQUNBLGFBQUssS0FBTDtBQUNFLGNBQUltQyxtQkFBbUIsS0FBS2hDLFNBQUwsQ0FBZWlDLFdBQWYsQ0FBMkJ0QixtQkFBM0IsQ0FBdkI7QUFDQSxjQUFJLEtBQUtYLFNBQUwsQ0FBZSxDQUFmLE1BQXNCVSxrQkFBdEIsSUFBNENzQixtQkFBbUIsQ0FBbkUsRUFBc0U7QUFDcEUsaUJBQUs3QixhQUFMLEdBQXFCd0Isb0JBQW9CLEtBQUszQixTQUFMLENBQWV5QixRQUFmLENBQXdCTyxtQkFBbUIsQ0FBM0MsQ0FBcEIsQ0FBckI7QUFDQSxpQkFBS2hDLFNBQUwsR0FBaUIsS0FBS0EsU0FBTCxDQUFleUIsUUFBZixDQUF3QixDQUF4QixFQUEyQk8sbUJBQW1CLENBQTlDLENBQWpCO0FBQ0QsV0FIRCxNQUdPO0FBQ0wsaUJBQUs3QixhQUFMLEdBQXFCd0Isb0JBQW9CLEtBQUszQixTQUF6QixDQUFyQjtBQUNBLGlCQUFLQSxTQUFMLEdBQWlCLElBQUk2QixVQUFKLENBQWUsQ0FBZixDQUFqQjtBQUNEO0FBQ0Q7QUFkSjs7QUFpQkEsYUFBTyxLQUFLbkMsT0FBWjtBQUNEOzs7K0JBRVd3QyxNLEVBQVE7QUFDbEIsVUFBSUMsZ0JBQUo7QUFDQSxVQUFJLEtBQUtuQyxTQUFMLENBQWUsQ0FBZixNQUFzQlMsV0FBMUIsRUFBdUM7QUFDckMsY0FBTSxJQUFJMkIsS0FBSixDQUFVLHVDQUF1QyxLQUFLTixHQUF0RCxDQUFOO0FBQ0Q7O0FBRUQsVUFBSU8sYUFBYSxLQUFLckMsU0FBTCxDQUFlSixPQUFmLENBQXVCYSxXQUF2QixDQUFqQjtBQUNBLFVBQUksS0FBS1QsU0FBTCxDQUFlaUIsTUFBZixHQUF3QixDQUF4QixJQUE2Qm9CLGVBQWUsQ0FBaEQsRUFBbUQ7QUFDakQsWUFBSUEsZUFBZSxDQUFDLENBQXBCLEVBQXVCO0FBQ3JCRixvQkFBVXZCLGFBQWEsS0FBS1osU0FBbEIsQ0FBVjtBQUNELFNBRkQsTUFFTztBQUNMbUMsb0JBQVV2QixhQUFhLEtBQUtaLFNBQUwsQ0FBZXlCLFFBQWYsQ0FBd0IsQ0FBeEIsRUFBMkJZLFVBQTNCLENBQWIsQ0FBVjtBQUNEOztBQUVELFlBQU1DLFNBQVMsMEJBQU9ILE9BQVAsRUFBZ0JELE1BQWhCLENBQWY7QUFDQSxZQUFJSSxVQUFVLENBQWQsRUFBaUI7QUFDZixnQkFBTSxJQUFJRixLQUFKLENBQVUsa0NBQWtDLEtBQUtOLEdBQUwsR0FBV1EsTUFBN0MsQ0FBVixDQUFOO0FBQ0Q7QUFDRixPQVhELE1BV087QUFDTCxjQUFNLElBQUlGLEtBQUosQ0FBVSx5Q0FBeUMsS0FBS04sR0FBeEQsQ0FBTjtBQUNEOztBQUVELFdBQUtBLEdBQUwsSUFBWUssUUFBUWxCLE1BQXBCO0FBQ0EsV0FBS2pCLFNBQUwsR0FBaUIsS0FBS0EsU0FBTCxDQUFleUIsUUFBZixDQUF3QlUsUUFBUWxCLE1BQWhDLENBQWpCOztBQUVBLGFBQU9rQixPQUFQO0FBQ0Q7OzsrQkFFVztBQUNWLFVBQUksQ0FBQyxLQUFLbkMsU0FBTCxDQUFlaUIsTUFBcEIsRUFBNEI7QUFDMUIsY0FBTSxJQUFJbUIsS0FBSixDQUFVLHlDQUF5QyxLQUFLTixHQUF4RCxDQUFOO0FBQ0Q7O0FBRUQsVUFBSSwwQkFBT1AsT0FBT1gsWUFBUCxDQUFvQixLQUFLWixTQUFMLENBQWUsQ0FBZixDQUFwQixDQUFQLEVBQStDLHVCQUEvQyxLQUF3RCxDQUE1RCxFQUErRDtBQUM3RCxjQUFNLElBQUlvQyxLQUFKLENBQVUsaUNBQWlDLEtBQUtOLEdBQWhELENBQU47QUFDRDs7QUFFRCxXQUFLQSxHQUFMO0FBQ0EsV0FBSzlCLFNBQUwsR0FBaUIsS0FBS0EsU0FBTCxDQUFleUIsUUFBZixDQUF3QixDQUF4QixDQUFqQjtBQUNEOzs7b0NBRWdCO0FBQ2YsVUFBSSxDQUFDLEtBQUt6QixTQUFMLENBQWVpQixNQUFwQixFQUE0QjtBQUMxQixjQUFNLElBQUltQixLQUFKLENBQVUseUNBQXlDLEtBQUtOLEdBQXhELENBQU47QUFDRDs7QUFFRCxVQUFJLEtBQUs5QixTQUFMLENBQWUsQ0FBZixNQUFzQlMsV0FBMUIsRUFBdUM7QUFDckMsY0FBTSxJQUFJMkIsS0FBSixDQUFVLHVDQUF1QyxLQUFLTixHQUF0RCxDQUFOO0FBQ0Q7O0FBRUQsYUFBTyxJQUFJUyxXQUFKLENBQWdCLElBQWhCLEVBQXNCLEtBQUtULEdBQTNCLEVBQWdDLEtBQUs5QixTQUFMLENBQWV5QixRQUFmLEVBQWhDLEVBQTJELEtBQUt0QyxPQUFoRSxFQUF5RWUsYUFBekUsRUFBUDtBQUNEOzs7Ozs7SUFHR3NDLEk7QUFDSixnQkFBYTNCLFVBQWIsRUFBeUI0QixVQUF6QixFQUFxQ0MsUUFBckMsRUFBK0M7QUFBQTs7QUFDN0MsU0FBSzdCLFVBQUwsR0FBa0JBLFVBQWxCO0FBQ0EsU0FBSzhCLFVBQUwsR0FBa0IsRUFBbEI7QUFDQSxTQUFLdEMsSUFBTCxHQUFZLEtBQVo7QUFDQSxTQUFLdUMsTUFBTCxHQUFjLElBQWQ7QUFDQSxTQUFLQyxTQUFMLEdBQWlCLEVBQWpCO0FBQ0EsU0FBS0gsUUFBTCxHQUFnQkEsUUFBaEI7QUFDQSxTQUFLSSxVQUFMLEdBQWtCLEtBQUtDLFFBQUwsR0FBZ0IsT0FBT0wsUUFBUCxLQUFvQixRQUFwQixHQUErQkEsV0FBVyxDQUExQyxHQUE4QyxDQUFoRjs7QUFFQSxRQUFJRCxVQUFKLEVBQWdCO0FBQ2QsV0FBS0EsVUFBTCxHQUFrQkEsVUFBbEI7QUFDQUEsaUJBQVdFLFVBQVgsQ0FBc0JyQixJQUF0QixDQUEyQixJQUEzQjtBQUNEO0FBQ0Y7Ozs7K0JBRVc7QUFDVixVQUFJaEIsUUFBUU0sYUFBYSxLQUFLb0MsYUFBTCxFQUFiLENBQVo7QUFDQSxhQUFPLEtBQUtDLGdCQUFMLEdBQXdCM0MsTUFBTVQsV0FBTixFQUF4QixHQUE4Q1MsS0FBckQ7QUFDRDs7O3FDQUVpQjtBQUNoQixhQUFPLEtBQUt5QyxRQUFMLEdBQWdCLEtBQUtELFVBQXJCLEdBQWtDLEtBQUtELFNBQUwsQ0FBZTVCLE1BQXhEO0FBQ0Q7OztvQ0FFZ0I7QUFDZixVQUFNaUMsYUFBYSxLQUFLckMsVUFBTCxDQUFnQlksUUFBaEIsQ0FBeUIsS0FBS3FCLFVBQTlCLEVBQTBDLEtBQUtDLFFBQS9DLENBQW5COztBQUVBLFVBQUksS0FBS0YsU0FBTCxDQUFlNUIsTUFBZixLQUEwQixDQUE5QixFQUFpQztBQUMvQixlQUFPaUMsVUFBUDtBQUNEOztBQUVELFVBQUlDLGdCQUFnQixJQUFJdEIsVUFBSixDQUFlcUIsV0FBV2pDLE1BQVgsR0FBb0IsS0FBSzRCLFNBQUwsQ0FBZTVCLE1BQWxELENBQXBCO0FBQ0EsVUFBSUMsUUFBUSxDQUFaO0FBQ0EsVUFBSWtDLFNBQVMsQ0FBYjtBQUNBLFVBQUlDLE9BQU8sS0FBS1IsU0FBTCxDQUFlUyxLQUFmLEVBQVg7O0FBRUFELFdBQUsvQixJQUFMLENBQVU0QixXQUFXakMsTUFBckI7O0FBRUFvQyxXQUFLRSxPQUFMLENBQWEsVUFBVXBDLEdBQVYsRUFBZTtBQUMxQixZQUFJQSxNQUFNRCxLQUFWLEVBQWlCO0FBQ2YsY0FBSXNDLFdBQVdOLFdBQVd6QixRQUFYLENBQW9CUCxLQUFwQixFQUEyQkMsR0FBM0IsQ0FBZjtBQUNBZ0Msd0JBQWNNLEdBQWQsQ0FBa0JELFFBQWxCLEVBQTRCSixNQUE1QjtBQUNBQSxvQkFBVUksU0FBU3ZDLE1BQW5CO0FBQ0Q7QUFDREMsZ0JBQVFDLE1BQU0sQ0FBZDtBQUNELE9BUEQ7O0FBU0EsYUFBT2dDLGFBQVA7QUFDRDs7OzJCQUVPN0MsSyxFQUFPb0QsYSxFQUFlO0FBQzVCLFVBQUksS0FBS0MsY0FBTCxPQUEwQnJELE1BQU1XLE1BQXBDLEVBQTRDO0FBQzFDLGVBQU8sS0FBUDtBQUNEOztBQUVELGFBQU8sS0FBSzJDLFFBQUwsQ0FBY3RELEtBQWQsRUFBcUIsQ0FBckIsRUFBd0JvRCxhQUF4QixDQUFQO0FBQ0Q7Ozs2QkFFU3BELEssRUFBT3VELEssRUFBT0gsYSxFQUFlO0FBQ3JDQSxzQkFBZ0IsT0FBT0EsYUFBUCxLQUF5QixTQUF6QixHQUFxQ0EsYUFBckMsR0FBcUQsSUFBckU7O0FBRUEsVUFBSUcsUUFBUSxDQUFaLEVBQWU7QUFDYkEsZ0JBQVEsS0FBS2QsUUFBTCxHQUFnQmMsS0FBeEI7O0FBRUEsZUFBTyxLQUFLaEIsU0FBTCxDQUFlakQsT0FBZixDQUF1QixLQUFLa0QsVUFBTCxHQUFrQmUsS0FBekMsS0FBbUQsQ0FBMUQsRUFBNkQ7QUFDM0RBO0FBQ0Q7QUFDRixPQU5ELE1BTU87QUFDTEEsZ0JBQVEsS0FBS2YsVUFBTCxHQUFrQmUsS0FBMUI7QUFDRDs7QUFFRCxXQUFLLElBQUk3QyxJQUFJLENBQWIsRUFBZ0JBLElBQUlWLE1BQU1XLE1BQTFCLEVBQWtDRCxHQUFsQyxFQUF1QztBQUNyQyxlQUFPLEtBQUs2QixTQUFMLENBQWVqRCxPQUFmLENBQXVCaUUsUUFBUSxLQUFLZixVQUFwQyxLQUFtRCxDQUExRCxFQUE2RDtBQUMzRGU7QUFDRDs7QUFFRCxZQUFJQSxTQUFTLEtBQUtkLFFBQWxCLEVBQTRCO0FBQzFCLGlCQUFPLEtBQVA7QUFDRDs7QUFFRCxZQUFJZSxZQUFZdkMsT0FBT1gsWUFBUCxDQUFvQixLQUFLQyxVQUFMLENBQWdCZ0QsS0FBaEIsQ0FBcEIsQ0FBaEI7QUFDQSxZQUFJRSxPQUFPekQsTUFBTVUsQ0FBTixDQUFYOztBQUVBLFlBQUksQ0FBQzBDLGFBQUwsRUFBb0I7QUFDbEJJLHNCQUFZQSxVQUFVakUsV0FBVixFQUFaO0FBQ0FrRSxpQkFBT0EsS0FBS2xFLFdBQUwsRUFBUDtBQUNEOztBQUVELFlBQUlpRSxjQUFjQyxJQUFsQixFQUF3QjtBQUN0QixpQkFBTyxLQUFQO0FBQ0Q7O0FBRURGO0FBQ0Q7O0FBRUQsYUFBTyxJQUFQO0FBQ0Q7OzsrQkFFVztBQUNWLFdBQUssSUFBSTdDLElBQUksQ0FBYixFQUFnQkEsSUFBSSxLQUFLK0IsUUFBTCxHQUFnQixLQUFLRCxVQUF6QyxFQUFxRDlCLEdBQXJELEVBQTBEO0FBQ3hELFlBQUksS0FBSzZCLFNBQUwsQ0FBZWpELE9BQWYsQ0FBdUJvQixDQUF2QixLQUE2QixDQUFqQyxFQUFvQztBQUNsQztBQUNEOztBQUVELFlBQUksQ0FBQyxLQUFLZ0QsT0FBTCxDQUFhaEQsQ0FBYixDQUFMLEVBQXNCO0FBQ3BCLGlCQUFPLEtBQVA7QUFDRDtBQUNGOztBQUVELGFBQU8sSUFBUDtBQUNEOzs7NEJBRVE2QyxLLEVBQU87QUFDZCxVQUFJQSxRQUFRLENBQVosRUFBZTtBQUNiQSxnQkFBUSxLQUFLZCxRQUFMLEdBQWdCYyxLQUF4Qjs7QUFFQSxlQUFPLEtBQUtoQixTQUFMLENBQWVqRCxPQUFmLENBQXVCLEtBQUtrRCxVQUFMLEdBQWtCZSxLQUF6QyxLQUFtRCxDQUExRCxFQUE2RDtBQUMzREE7QUFDRDtBQUNGLE9BTkQsTUFNTztBQUNMQSxnQkFBUSxLQUFLZixVQUFMLEdBQWtCZSxLQUExQjs7QUFFQSxlQUFPLEtBQUtoQixTQUFMLENBQWVqRCxPQUFmLENBQXVCLEtBQUtrRCxVQUFMLEdBQWtCZSxLQUF6QyxLQUFtRCxDQUExRCxFQUE2RDtBQUMzREE7QUFDRDtBQUNGOztBQUVELFVBQUlJLFFBQVEsS0FBS3BELFVBQUwsQ0FBZ0JnRCxLQUFoQixDQUFaO0FBQ0EsYUFBT0ksU0FBUyxFQUFULElBQWVBLFNBQVMsRUFBL0I7QUFDRDs7O2lDQUVhRixJLEVBQU07QUFDbEIsVUFBSUUsUUFBUUYsS0FBS0csVUFBTCxDQUFnQixDQUFoQixDQUFaOztBQUVBLFdBQUssSUFBSWxELElBQUksS0FBSzhCLFVBQWxCLEVBQThCOUIsSUFBSSxLQUFLK0IsUUFBdkMsRUFBaUQvQixHQUFqRCxFQUFzRDtBQUNwRCxZQUFJLEtBQUs2QixTQUFMLENBQWVqRCxPQUFmLENBQXVCb0IsSUFBSSxLQUFLOEIsVUFBaEMsS0FBK0MsQ0FBbkQsRUFBc0Q7QUFDcEQ7QUFDRDs7QUFFRCxZQUFJLEtBQUtqQyxVQUFMLENBQWdCRyxDQUFoQixNQUF1QmlELEtBQTNCLEVBQWtDO0FBQ2hDLGlCQUFPLElBQVA7QUFDRDtBQUNGOztBQUVELGFBQU8sS0FBUDtBQUNEOzs7Ozs7SUFHRzFCLFc7QUFDSix1QkFBYTRCLE1BQWIsRUFBcUJ6QixRQUFyQixFQUErQjdCLFVBQS9CLEVBQXlEO0FBQUEsUUFBZDFCLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFDdkQsU0FBSzBCLFVBQUwsR0FBa0JBLFVBQWxCO0FBQ0EsU0FBSzFCLE9BQUwsR0FBZUEsT0FBZjtBQUNBLFNBQUtnRixNQUFMLEdBQWNBLE1BQWQ7O0FBRUEsU0FBS0MsSUFBTCxHQUFZLEtBQUtDLFdBQUwsR0FBbUIsS0FBS0MsVUFBTCxFQUEvQjtBQUNBLFNBQUt4QyxHQUFMLEdBQVdZLFlBQVksQ0FBdkI7O0FBRUEsU0FBSzJCLFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4Qjs7QUFFQSxTQUFLa0UsS0FBTCxHQUFhLFFBQWI7O0FBRUEsUUFBSSxLQUFLcEYsT0FBTCxDQUFhcUYsYUFBYixLQUErQkMsU0FBbkMsRUFBOEM7QUFDNUMsV0FBS3RGLE9BQUwsQ0FBYXFGLGFBQWIsR0FBNkIsSUFBN0I7QUFDRDs7QUFFRCxTQUFLRSxhQUFMO0FBQ0Q7Ozs7b0NBRWdCO0FBQUE7O0FBQ2YsVUFBSXpFLGFBQWEsRUFBakI7QUFDQSxVQUFJMEUsU0FBUzFFLFVBQWI7O0FBRUEsVUFBSTJFLE9BQU8sU0FBUEEsSUFBTyxPQUFRO0FBQ2pCLFlBQUlDLFlBQUo7QUFDQSxZQUFJQyxZQUFZSCxNQUFoQjtBQUNBLFlBQUlJLGdCQUFKOztBQUVBLFlBQUksQ0FBQ0MsS0FBS3BDLE1BQU4sSUFBZ0JvQyxLQUFLM0UsSUFBTCxLQUFjLFVBQTlCLElBQTRDMkUsS0FBS0MsTUFBTCxDQUFZLEdBQVosQ0FBaEQsRUFBa0U7QUFDaEVELGVBQUtwQyxNQUFMLEdBQWMsSUFBZDtBQUNBb0MsZUFBSzNFLElBQUwsR0FBWSxNQUFaO0FBQ0Q7O0FBRUg7QUFDRSxZQUFJLENBQUMyRSxLQUFLcEMsTUFBVixFQUFrQjtBQUNoQixnQkFBTSxJQUFJUixLQUFKLENBQVUsMENBQTBDLE1BQUtOLEdBQUwsR0FBVyxNQUFLakIsVUFBTCxDQUFnQkksTUFBM0IsR0FBb0MsQ0FBOUUsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsZ0JBQVErRCxLQUFLM0UsSUFBTCxDQUFVUixXQUFWLEVBQVI7QUFDRSxlQUFLLFNBQUw7QUFDQSxlQUFLLFFBQUw7QUFDRWdGLGtCQUFNO0FBQ0p4RSxvQkFBTTJFLEtBQUszRSxJQUFMLENBQVVSLFdBQVYsRUFERjtBQUVKUyxxQkFBTyxNQUFLbkIsT0FBTCxDQUFhcUYsYUFBYixHQUE2QlEsS0FBS0UsUUFBTCxFQUE3QixHQUErQ0YsS0FBS2hDLGFBQUw7QUFGbEQsYUFBTjtBQUlBMkIsbUJBQU9yRCxJQUFQLENBQVl1RCxHQUFaO0FBQ0E7QUFDRixlQUFLLFVBQUw7QUFDRUEsa0JBQU07QUFDSnhFLG9CQUFNMkUsS0FBSzNFLElBQUwsQ0FBVVIsV0FBVixFQURGO0FBRUpTLHFCQUFPMEUsS0FBS0UsUUFBTDtBQUZILGFBQU47QUFJQVAsbUJBQU9yRCxJQUFQLENBQVl1RCxHQUFaO0FBQ0E7QUFDRixlQUFLLE1BQUw7QUFDRSxnQkFBSUcsS0FBS0MsTUFBTCxDQUFZLEtBQVosRUFBbUIsSUFBbkIsQ0FBSixFQUE4QjtBQUM1Qk4scUJBQU9yRCxJQUFQLENBQVksSUFBWjtBQUNBO0FBQ0Q7QUFDRHVELGtCQUFNO0FBQ0p4RSxvQkFBTTJFLEtBQUszRSxJQUFMLENBQVVSLFdBQVYsRUFERjtBQUVKUyxxQkFBTzBFLEtBQUtFLFFBQUw7QUFGSCxhQUFOO0FBSUFQLG1CQUFPckQsSUFBUCxDQUFZdUQsR0FBWjtBQUNBO0FBQ0YsZUFBSyxTQUFMO0FBQ0VGLHFCQUFTQSxPQUFPQSxPQUFPMUQsTUFBUCxHQUFnQixDQUF2QixFQUEwQmtFLE9BQTFCLEdBQW9DLEVBQTdDO0FBQ0E7QUFDRixlQUFLLE1BQUw7QUFDRU4sa0JBQU0sRUFBTjtBQUNBRixtQkFBT3JELElBQVAsQ0FBWXVELEdBQVo7QUFDQUYscUJBQVNFLEdBQVQ7QUFDQTtBQUNGLGVBQUssU0FBTDtBQUNFRSxzQkFBVUMsS0FBS0UsUUFBTCxHQUFnQkUsS0FBaEIsQ0FBc0IsR0FBdEIsRUFBMkJDLEdBQTNCLENBQStCQyxNQUEvQixDQUFWO0FBQ0FYLG1CQUFPQSxPQUFPMUQsTUFBUCxHQUFnQixDQUF2QixFQUEwQjhELE9BQTFCLEdBQW9DQSxPQUFwQztBQUNBO0FBdENKOztBQXlDQUMsYUFBS3JDLFVBQUwsQ0FBZ0JZLE9BQWhCLENBQXdCLFVBQVVnQyxTQUFWLEVBQXFCO0FBQzNDWCxlQUFLVyxTQUFMO0FBQ0QsU0FGRDtBQUdBWixpQkFBU0csU0FBVDtBQUNELE9BNUREOztBQThEQUYsV0FBSyxLQUFLUixJQUFWOztBQUVBLGFBQU9uRSxVQUFQO0FBQ0Q7OzsrQkFFV3dDLFUsRUFBWUMsUSxFQUFVO0FBQ2hDLGFBQU8sSUFBSUYsSUFBSixDQUFTLEtBQUszQixVQUFkLEVBQTBCNEIsVUFBMUIsRUFBc0NDLFFBQXRDLENBQVA7QUFDRDs7O29DQUVnQjtBQUFBOztBQUNmLFVBQUkxQixVQUFKO0FBQ0EsVUFBSXdFLFlBQUo7QUFDQSxVQUFNQyxVQUFVLFNBQVZBLE9BQVUsQ0FBQzNELEdBQUQsRUFBUztBQUN6QjtBQUNFLGVBQU8sT0FBS2pCLFVBQUwsQ0FBZ0JHLElBQUksQ0FBcEIsTUFBMkIsR0FBbEMsRUFBdUM7QUFDckNBO0FBQ0Q7QUFDRixPQUxEOztBQU9BLFdBQUtBLElBQUksQ0FBSixFQUFPd0UsTUFBTSxLQUFLM0UsVUFBTCxDQUFnQkksTUFBbEMsRUFBMENELElBQUl3RSxHQUE5QyxFQUFtRHhFLEdBQW5ELEVBQXdEO0FBQ3RELFlBQUkwRSxNQUFNbkUsT0FBT1gsWUFBUCxDQUFvQixLQUFLQyxVQUFMLENBQWdCRyxDQUFoQixDQUFwQixDQUFWOztBQUVBLGdCQUFRLEtBQUt1RCxLQUFiO0FBQ0UsZUFBSyxRQUFMOztBQUVFLG9CQUFRbUIsR0FBUjtBQUNBO0FBQ0UsbUJBQUssR0FBTDtBQUNFLHFCQUFLckIsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDckQsQ0FBbEMsQ0FBbkI7QUFDQSxxQkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixRQUF4QjtBQUNBLHFCQUFLa0UsS0FBTCxHQUFhLFFBQWI7QUFDQSxxQkFBS0YsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLEtBQTFCO0FBQ0E7O0FBRUo7QUFDRSxtQkFBSyxHQUFMO0FBQ0UscUJBQUt5QixXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0NyRCxDQUFsQyxDQUFuQjtBQUNBLHFCQUFLcUQsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLE1BQXhCO0FBQ0EscUJBQUtnRSxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsS0FBMUI7QUFDQTs7QUFFSjtBQUNFLG1CQUFLLEdBQUw7QUFDRSxvQkFBSSxLQUFLeUIsV0FBTCxDQUFpQmhFLElBQWpCLEtBQTBCLE1BQTlCLEVBQXNDO0FBQ3BDLHdCQUFNLElBQUkrQixLQUFKLENBQVUsK0NBQStDLEtBQUtOLEdBQUwsR0FBV2QsQ0FBMUQsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQscUJBQUtxRCxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxxQkFBS3lCLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFyQztBQUNBLHFCQUFLcUQsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7O0FBRUFnRDtBQUNBOztBQUVKO0FBQ0UsbUJBQUssR0FBTDtBQUNFLG9CQUFJLEtBQUtwQixXQUFMLENBQWlCaEUsSUFBakIsS0FBMEIsU0FBOUIsRUFBeUM7QUFDdkMsd0JBQU0sSUFBSStCLEtBQUosQ0FBVSxrREFBa0QsS0FBS04sR0FBTCxHQUFXZCxDQUE3RCxDQUFWLENBQU47QUFDRDtBQUNELHFCQUFLcUQsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLElBQTFCO0FBQ0EscUJBQUt5QixXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBckM7QUFDQSxxQkFBS3FELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0FnRDtBQUNBOztBQUVKO0FBQ0UsbUJBQUssR0FBTDtBQUNFLG9CQUFJbEUsT0FBT1gsWUFBUCxDQUFvQixLQUFLQyxVQUFMLENBQWdCRyxJQUFJLENBQXBCLENBQXBCLE1BQWdELEdBQXBELEVBQXlEO0FBQ3ZELHVCQUFLcUQsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDckQsQ0FBbEMsQ0FBbkI7QUFDQSx1QkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4QjtBQUNBLHVCQUFLZ0UsV0FBTCxDQUFpQnZCLFVBQWpCLEdBQThCOUIsQ0FBOUI7QUFDQSx1QkFBS3FELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0Qi9CLElBQUksQ0FBaEM7QUFDQSx1QkFBS3VELEtBQUwsR0FBYSxNQUFiO0FBQ0QsaUJBTkQsTUFNTztBQUNMLHVCQUFLRixXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0NyRCxDQUFsQyxDQUFuQjtBQUNBLHVCQUFLcUQsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLFNBQXhCO0FBQ0EsdUJBQUtrRSxLQUFMLEdBQWEsU0FBYjtBQUNBLHVCQUFLRixXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsS0FBMUI7QUFDRDtBQUNEOztBQUVKO0FBQ0UsbUJBQUssR0FBTDtBQUNFLHFCQUFLeUIsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDckQsQ0FBbEMsQ0FBbkI7QUFDQSxxQkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixTQUF4QjtBQUNBLHFCQUFLa0UsS0FBTCxHQUFhLFNBQWI7QUFDQSxxQkFBS0YsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLEtBQTFCO0FBQ0E7O0FBRUo7QUFDRSxtQkFBSyxHQUFMO0FBQ0UscUJBQUt5QixXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0NyRCxDQUFsQyxDQUFuQjtBQUNBLHFCQUFLcUQsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLFVBQXhCO0FBQ0EscUJBQUtnRSxXQUFMLENBQWlCdkIsVUFBakIsR0FBOEI5QixDQUE5QjtBQUNBLHFCQUFLcUQsV0FBTCxDQUFpQnRCLFFBQWpCLEdBQTRCL0IsSUFBSSxDQUFoQztBQUNBLHFCQUFLcUQsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLEtBQTFCO0FBQ0EscUJBQUsyQixLQUFMLEdBQWEsVUFBYjtBQUNBOztBQUVKO0FBQ0UsbUJBQUssR0FBTDtBQUNBO0FBQ0U7O0FBRUo7QUFDRSxtQkFBSyxHQUFMO0FBQ0E7QUFDRSxvQkFBSSxDQUFDLElBQUQsRUFBTyxJQUFQLEVBQWEsS0FBYixFQUFvQixLQUFwQixFQUEyQixTQUEzQixFQUFzQzNFLE9BQXRDLENBQThDLEtBQUt1RSxNQUFMLENBQVl6RSxPQUFaLENBQW9CRyxXQUFwQixFQUE5QyxLQUFvRixDQUFwRixJQUF5RixLQUFLd0UsV0FBTCxLQUFxQixLQUFLRCxJQUF2SCxFQUE2SDtBQUMzSCx1QkFBS0MsV0FBTCxDQUFpQnNCLE1BQWpCLEdBQTBCLEtBQUs3RCxHQUFMLEdBQVdkLENBQXJDOztBQUVBLHVCQUFLcUQsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDckQsQ0FBbEMsQ0FBbkI7QUFDQSx1QkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4Qjs7QUFFQSx1QkFBS2dFLFdBQUwsR0FBbUIsS0FBS0MsVUFBTCxDQUFnQixLQUFLRCxXQUFyQixFQUFrQ3JELENBQWxDLENBQW5CO0FBQ0EsdUJBQUtxRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsU0FBeEI7QUFDQSx1QkFBS2dFLFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixLQUExQjtBQUNBLHVCQUFLMkIsS0FBTCxHQUFhLFFBQWI7O0FBRUY7QUFDQTtBQUNBO0FBQ0E7QUFDRSxzQkFBSTNELGFBQWEsS0FBS0MsVUFBTCxDQUFnQlksUUFBaEIsQ0FBeUJULElBQUksQ0FBN0IsRUFBZ0NBLElBQUksRUFBcEMsQ0FBYixFQUFzRG5CLFdBQXRELE9BQXdFLFdBQTVFLEVBQXlGO0FBQ3pGO0FBQ0UseUJBQUt3RSxXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0MsS0FBS3ZDLEdBQUwsR0FBV2QsQ0FBWCxHQUFlLENBQWpELENBQW5CO0FBQ0EseUJBQUtxRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsTUFBeEI7QUFDQSx5QkFBS2dFLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFYLEdBQWUsQ0FBekM7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJ2QixVQUFqQixHQUE4QjlCLElBQUksQ0FBbEM7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0Qi9CLElBQUksQ0FBaEM7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJwQixnQkFBakIsR0FBb0MsSUFBcEM7QUFDQSx5QkFBS29CLFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDOztBQUVGO0FBQ0UseUJBQUs0QixXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0MsS0FBS3ZDLEdBQUwsR0FBV2QsQ0FBWCxHQUFlLEVBQWpELENBQW5CO0FBQ0Y7QUFDRSx5QkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4QjtBQUNGO0FBQ0VXLHdCQUFJLEtBQUtILFVBQUwsQ0FBZ0JqQixPQUFoQixDQUF3QmUsbUJBQXhCLEVBQTZDSyxJQUFJLEVBQWpELENBQUo7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFYLEdBQWUsQ0FBekM7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJ2QixVQUFqQixHQUE4QixLQUFLdUIsV0FBTCxDQUFpQjNCLFFBQWpCLEdBQTRCLEtBQUtaLEdBQS9EO0FBQ0EseUJBQUt1QyxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEIsS0FBS3NCLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBL0IsR0FBcUMsQ0FBakU7QUFDQSx5QkFBS3VDLFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDOztBQUVGO0FBQ0UseUJBQUs0QixXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSx5QkFBS3lCLFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0FnRDtBQUNEOztBQUVEO0FBQ0Q7QUFDTDtBQUNFO0FBQ0E7QUFDQTtBQUNBO0FBQ0Usb0JBQUksK0JBQVk3RixPQUFaLENBQW9COEYsR0FBcEIsSUFBMkIsQ0FBM0IsSUFBZ0NBLFFBQVEsSUFBeEMsSUFBZ0RBLFFBQVEsR0FBNUQsRUFBaUU7QUFDL0Qsd0JBQU0sSUFBSXRELEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRDs7QUFFRCxxQkFBS3FELFdBQUwsR0FBbUIsS0FBS0MsVUFBTCxDQUFnQixLQUFLRCxXQUFyQixFQUFrQ3JELENBQWxDLENBQW5CO0FBQ0EscUJBQUtxRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsTUFBeEI7QUFDQSxxQkFBS2dFLFdBQUwsQ0FBaUJ2QixVQUFqQixHQUE4QjlCLENBQTlCO0FBQ0EscUJBQUtxRCxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEIvQixJQUFJLENBQWhDO0FBQ0EscUJBQUt1RCxLQUFMLEdBQWEsTUFBYjtBQUNBO0FBNUlKO0FBOElBOztBQUVGLGVBQUssTUFBTDs7QUFFQTtBQUNFLGdCQUFJbUIsUUFBUSxHQUFaLEVBQWlCO0FBQ2YsbUJBQUtyQixXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBWCxHQUFlLENBQXpDO0FBQ0EsbUJBQUtxRCxXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQztBQUNBLG1CQUFLOEIsS0FBTCxHQUFhLFFBQWI7QUFDQTtBQUNEOztBQUVIO0FBQ0UsZ0JBQ0EsS0FBS0YsV0FBTCxDQUFpQjVCLFVBQWpCLEtBRUdpRCxRQUFRLEdBQVIsSUFBZSxLQUFLckIsV0FBTCxDQUFpQjVCLFVBQWpCLENBQTRCcEMsSUFBNUIsS0FBcUMsTUFBckQsSUFDQ3FGLFFBQVEsR0FBUixJQUFlLEtBQUtyQixXQUFMLENBQWlCNUIsVUFBakIsQ0FBNEJwQyxJQUE1QixLQUFxQyxTQUh2RCxDQURBLEVBTUE7QUFDRSxtQkFBS2dFLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFYLEdBQWUsQ0FBekM7QUFDQSxtQkFBS3FELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDOztBQUVBLG1CQUFLNEIsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLElBQTFCO0FBQ0EsbUJBQUt5QixXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBckM7QUFDQSxtQkFBS3FELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0EsbUJBQUs4QixLQUFMLEdBQWEsUUFBYjs7QUFFQWtCO0FBQ0E7QUFDRDs7QUFFRCxnQkFBSSxDQUFDQyxRQUFRLEdBQVIsSUFBZUEsUUFBUSxHQUF4QixLQUFnQyxLQUFLckIsV0FBTCxDQUFpQnVCLFFBQWpCLEVBQXBDLEVBQWlFO0FBQy9ELG1CQUFLdkIsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLFVBQXhCO0FBQ0EsbUJBQUtnRSxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxtQkFBSzJCLEtBQUwsR0FBYSxVQUFiO0FBQ0Q7O0FBRUg7QUFDRSxnQkFBSW1CLFFBQVEsR0FBUixLQUFnQixLQUFLckIsV0FBTCxDQUFpQlksTUFBakIsQ0FBd0IsTUFBeEIsRUFBZ0MsS0FBaEMsS0FBMEMsS0FBS1osV0FBTCxDQUFpQlksTUFBakIsQ0FBd0IsV0FBeEIsRUFBcUMsS0FBckMsQ0FBMUQsQ0FBSixFQUE0RztBQUMxRyxtQkFBS1osV0FBTCxDQUFpQnNCLE1BQWpCLEdBQTBCLEtBQUs3RCxHQUFMLEdBQVdkLENBQXJDO0FBQ0EsbUJBQUtxRCxXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBTCxDQUFpQjVCLFVBQWpDLEVBQTZDLEtBQUtYLEdBQUwsR0FBV2QsQ0FBeEQsQ0FBbkI7QUFDQSxtQkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixTQUF4QjtBQUNBLG1CQUFLZ0UsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLEtBQTFCO0FBQ0EsbUJBQUsyQixLQUFMLEdBQWEsUUFBYjtBQUNBO0FBQ0Q7O0FBRUQsZ0JBQUltQixRQUFRLEdBQVosRUFBaUI7QUFDZixvQkFBTSxJQUFJdEQsS0FBSixDQUFVLDZDQUE2QyxLQUFLTixHQUE1RCxDQUFOO0FBQ0Q7O0FBRUg7QUFDRSxnQkFBSSwrQkFBWWxDLE9BQVosQ0FBb0I4RixHQUFwQixJQUEyQixDQUEzQixJQUFnQ0EsUUFBUSxHQUF4QyxJQUErQyxFQUFFQSxRQUFRLEdBQVIsSUFBZSxLQUFLckIsV0FBTCxDQUFpQlksTUFBakIsQ0FBd0IsSUFBeEIsQ0FBakIsQ0FBbkQsRUFBb0c7QUFDbEcsb0JBQU0sSUFBSTdDLEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRCxhQUZELE1BRU8sSUFBSSxLQUFLcUQsV0FBTCxDQUFpQlksTUFBakIsQ0FBd0IsS0FBeEIsQ0FBSixFQUFvQztBQUN6QyxvQkFBTSxJQUFJN0MsS0FBSixDQUFVLGtDQUFrQyxLQUFLTixHQUFMLEdBQVdkLENBQTdDLENBQVYsQ0FBTjtBQUNEOztBQUVELGlCQUFLcUQsV0FBTCxDQUFpQnRCLFFBQWpCLEdBQTRCL0IsSUFBSSxDQUFoQztBQUNBOztBQUVGLGVBQUssUUFBTDs7QUFFQTtBQUNFLGdCQUFJMEUsUUFBUSxHQUFaLEVBQWlCO0FBQ2YsbUJBQUtyQixXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBckM7QUFDQSxtQkFBS3FELFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLG1CQUFLeUIsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7QUFDQSxtQkFBSzhCLEtBQUwsR0FBYSxRQUFiOztBQUVBa0I7QUFDQTtBQUNEOztBQUVIO0FBQ0UsZ0JBQUlDLFFBQVEsSUFBWixFQUFrQjtBQUNoQixtQkFBS3JCLFdBQUwsQ0FBaUJ4QixTQUFqQixDQUEyQnZCLElBQTNCLENBQWdDTixJQUFJLEtBQUtxRCxXQUFMLENBQWlCdkIsVUFBckQ7QUFDQTlCO0FBQ0Esa0JBQUlBLEtBQUt3RSxHQUFULEVBQWM7QUFDWixzQkFBTSxJQUFJcEQsS0FBSixDQUFVLDBDQUEwQyxLQUFLTixHQUFMLEdBQVdkLENBQXJELENBQVYsQ0FBTjtBQUNEO0FBQ0QwRSxvQkFBTW5FLE9BQU9YLFlBQVAsQ0FBb0IsS0FBS0MsVUFBTCxDQUFnQkcsQ0FBaEIsQ0FBcEIsQ0FBTjtBQUNEOztBQUVIOzs7Ozs7QUFNRSxpQkFBS3FELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0Qi9CLElBQUksQ0FBaEM7QUFDQTs7QUFFRixlQUFLLFNBQUw7QUFDRSxnQkFBSTBFLFFBQVEsR0FBWixFQUFpQjtBQUNmLGtCQUFJLEtBQUtyQixXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQUosRUFBd0M7QUFDdEMsc0JBQU0sSUFBSXhCLEtBQUosQ0FBVSwyQ0FBMkMsS0FBS04sR0FBMUQsQ0FBTjtBQUNEO0FBQ0QsbUJBQUt1QyxXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBckM7QUFDQSxtQkFBS3FELFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLG1CQUFLeUIsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7QUFDQSxtQkFBSzhCLEtBQUwsR0FBYSxRQUFiO0FBQ0FrQjtBQUNBO0FBQ0Q7O0FBRUQsZ0JBQUlDLFFBQVEsR0FBUixLQUFnQixDQUFDLEtBQUtyQixXQUFMLENBQWlCVixjQUFqQixFQUFELElBQXNDLEtBQUtVLFdBQUwsQ0FBaUJ3QixZQUFqQixDQUE4QixHQUE5QixDQUF0RCxDQUFKLEVBQStGO0FBQzdGLG9CQUFNLElBQUl6RCxLQUFKLENBQVUsZ0RBQWdELEtBQUtOLEdBQS9ELENBQU47QUFDRDs7QUFFRCxnQkFBSSwyQkFBUWxDLE9BQVIsQ0FBZ0I4RixHQUFoQixJQUF1QixDQUF2QixJQUE0QkEsUUFBUSxHQUF4QyxFQUE2QztBQUMzQyxvQkFBTSxJQUFJdEQsS0FBSixDQUFVLGtDQUFrQyxLQUFLTixHQUFMLEdBQVdkLENBQTdDLENBQVYsQ0FBTjtBQUNEOztBQUVELGdCQUFJMEUsUUFBUSxHQUFSLEtBQWdCLEtBQUtyQixXQUFMLENBQWlCWSxNQUFqQixDQUF3QixHQUF4QixLQUFnQyxLQUFLWixXQUFMLENBQWlCVCxRQUFqQixDQUEwQixJQUExQixFQUFnQyxDQUFDLENBQWpDLENBQWhELENBQUosRUFBMEY7QUFDeEYsb0JBQU0sSUFBSXhCLEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRDs7QUFFRCxpQkFBS3FELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0Qi9CLElBQUksQ0FBaEM7QUFDQTs7QUFFRixlQUFLLFNBQUw7QUFDRSxnQkFBSSxLQUFLcUQsV0FBTCxDQUFpQnlCLE9BQXJCLEVBQThCO0FBQzVCLGtCQUFJSixRQUFRLElBQVosRUFBc0I7QUFDcEIsc0JBQU0sSUFBSXRELEtBQUosQ0FBVSxtQ0FBbUMsS0FBS04sR0FBTCxHQUFXZCxDQUE5QyxDQUFWLENBQU47QUFDRDtBQUNELG1CQUFLcUQsV0FBTCxDQUFpQnRCLFFBQWpCLEdBQTRCL0IsSUFBSSxDQUFoQzs7QUFFQSxrQkFBSSxLQUFLcUQsV0FBTCxDQUFpQlYsY0FBakIsTUFBcUMsS0FBS1UsV0FBTCxDQUFpQjBCLGFBQTFELEVBQXlFO0FBQ3ZFLHFCQUFLMUIsV0FBTCxDQUFpQnNCLE1BQWpCLEdBQTBCLEtBQUs3RCxHQUFMLEdBQVdkLENBQXJDO0FBQ0EscUJBQUtxRCxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxxQkFBS3lCLFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0EscUJBQUs4QixLQUFMLEdBQWEsUUFBYjtBQUNBa0I7QUFDRDtBQUNEO0FBQ0Q7O0FBRUQsZ0JBQUlDLFFBQVEsR0FBUixJQUFlLEtBQUt2RyxPQUFMLENBQWE2RyxXQUFoQyxFQUE2QztBQUMzQyxtQkFBSzNCLFdBQUwsQ0FBaUIyQixXQUFqQixHQUErQixJQUEvQjtBQUNBO0FBQ0Q7O0FBRUQsZ0JBQUlOLFFBQVEsR0FBWixFQUFpQjtBQUNmLGtCQUFJLEVBQUUsbUJBQW1CLEtBQUtyQixXQUExQixDQUFKLEVBQTRDO0FBQzFDLHNCQUFNLElBQUlqQyxLQUFKLENBQVUsdURBQXVELEtBQUtOLEdBQUwsR0FBV2QsQ0FBbEUsQ0FBVixDQUFOO0FBQ0Q7QUFDRCxrQkFBSSxLQUFLSCxVQUFMLENBQWdCRyxJQUFJLENBQXBCLE1BQTJCVCxRQUEvQixFQUF5QztBQUN2Q1M7QUFDRCxlQUZELE1BRU8sSUFBSSxLQUFLSCxVQUFMLENBQWdCRyxJQUFJLENBQXBCLE1BQTJCUixRQUEzQixJQUF1QyxLQUFLSyxVQUFMLENBQWdCRyxJQUFJLENBQXBCLE1BQTJCVCxRQUF0RSxFQUFnRjtBQUNyRlMscUJBQUssQ0FBTDtBQUNELGVBRk0sTUFFQTtBQUNMLHNCQUFNLElBQUlvQixLQUFKLENBQVUsa0NBQWtDLEtBQUtOLEdBQUwsR0FBV2QsQ0FBN0MsQ0FBVixDQUFOO0FBQ0Q7QUFDRCxtQkFBS3FELFdBQUwsQ0FBaUJ2QixVQUFqQixHQUE4QjlCLElBQUksQ0FBbEM7QUFDQSxtQkFBS3FELFdBQUwsQ0FBaUIwQixhQUFqQixHQUFpQ1QsT0FBTyxLQUFLakIsV0FBTCxDQUFpQjBCLGFBQXhCLENBQWpDO0FBQ0EsbUJBQUsxQixXQUFMLENBQWlCeUIsT0FBakIsR0FBMkIsSUFBM0I7O0FBRUEsa0JBQUksQ0FBQyxLQUFLekIsV0FBTCxDQUFpQjBCLGFBQXRCLEVBQXFDO0FBQ3JDO0FBQ0E7QUFDRSxxQkFBSzFCLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFyQztBQUNBLHFCQUFLcUQsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLElBQTFCO0FBQ0EscUJBQUt5QixXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQztBQUNBLHFCQUFLOEIsS0FBTCxHQUFhLFFBQWI7QUFDQWtCO0FBQ0Q7QUFDRDtBQUNEO0FBQ0QsZ0JBQUksMkJBQVE3RixPQUFSLENBQWdCOEYsR0FBaEIsSUFBdUIsQ0FBM0IsRUFBOEI7QUFDNUIsb0JBQU0sSUFBSXRELEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRDtBQUNELGdCQUFJLEtBQUtxRCxXQUFMLENBQWlCMEIsYUFBakIsS0FBbUMsR0FBdkMsRUFBNEM7QUFDMUMsb0JBQU0sSUFBSTNELEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRDtBQUNELGlCQUFLcUQsV0FBTCxDQUFpQjBCLGFBQWpCLEdBQWlDLENBQUMsS0FBSzFCLFdBQUwsQ0FBaUIwQixhQUFqQixJQUFrQyxFQUFuQyxJQUF5Q0wsR0FBMUU7QUFDQTs7QUFFRixlQUFLLFVBQUw7QUFDQTtBQUNFLGdCQUFJQSxRQUFRLEdBQVosRUFBaUI7QUFDZixrQkFBSSxDQUFDLEtBQUtyQixXQUFMLENBQWlCTCxPQUFqQixDQUF5QixDQUFDLENBQTFCLENBQUQsSUFBaUMsQ0FBQyxLQUFLSyxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQXRDLEVBQTBFO0FBQ3hFLHNCQUFNLElBQUl4QixLQUFKLENBQVUsd0NBQXdDLEtBQUtOLEdBQUwsR0FBV2QsQ0FBbkQsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsa0JBQUksS0FBS3FELFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsS0FBc0MsQ0FBQyxLQUFLUyxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQTNDLEVBQStFO0FBQzdFLHNCQUFNLElBQUl4QixLQUFKLENBQVUsd0NBQXdDLEtBQUtOLEdBQUwsR0FBV2QsQ0FBbkQsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsbUJBQUtxRCxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxtQkFBS3lCLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFYLEdBQWUsQ0FBekM7QUFDQSxtQkFBS3FELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0EsbUJBQUs4QixLQUFMLEdBQWEsUUFBYjtBQUNBO0FBQ0QsYUFkRCxNQWNPLElBQUksS0FBS0YsV0FBTCxDQUFpQjVCLFVBQWpCLElBQ1hpRCxRQUFRLEdBREcsSUFFWCxLQUFLckIsV0FBTCxDQUFpQjVCLFVBQWpCLENBQTRCcEMsSUFBNUIsS0FBcUMsU0FGOUIsRUFFeUM7QUFDOUMsbUJBQUtnRSxXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBWCxHQUFlLENBQXpDO0FBQ0EsbUJBQUtxRCxXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQzs7QUFFQSxtQkFBSzRCLFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLG1CQUFLeUIsV0FBTCxDQUFpQnNCLE1BQWpCLEdBQTBCLEtBQUs3RCxHQUFMLEdBQVdkLENBQXJDO0FBQ0EsbUJBQUtxRCxXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQztBQUNBLG1CQUFLOEIsS0FBTCxHQUFhLFFBQWI7O0FBRUFrQjtBQUNBO0FBQ0Q7O0FBRUQsZ0JBQUlDLFFBQVEsR0FBWixFQUFpQjtBQUNmLGtCQUFJLENBQUMsS0FBS3JCLFdBQUwsQ0FBaUJMLE9BQWpCLENBQXlCLENBQUMsQ0FBMUIsQ0FBRCxJQUFpQyxDQUFDLEtBQUtLLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBdEMsRUFBMEU7QUFDeEUsc0JBQU0sSUFBSXhCLEtBQUosQ0FBVSwrQ0FBK0MsS0FBS04sR0FBTCxHQUFXZCxDQUExRCxDQUFWLENBQU47QUFDRDtBQUNGLGFBSkQsTUFJTyxJQUFJMEUsUUFBUSxHQUFaLEVBQWlCO0FBQ3RCLGtCQUFJLENBQUMsS0FBS3JCLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBRCxJQUF1QyxDQUFDLEtBQUtTLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBNUMsRUFBZ0Y7QUFDOUUsc0JBQU0sSUFBSXhCLEtBQUosQ0FBVSw0Q0FBNEMsS0FBS04sR0FBTCxHQUFXZCxDQUF2RCxDQUFWLENBQU47QUFDRDtBQUNGLGFBSk0sTUFJQSxJQUFJMEUsUUFBUSxHQUFaLEVBQWlCO0FBQ3RCLGtCQUFJLENBQUMsS0FBS3JCLFdBQUwsQ0FBaUJMLE9BQWpCLENBQXlCLENBQUMsQ0FBMUIsQ0FBRCxJQUFpQyxDQUFDLEtBQUtLLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBdEMsRUFBMEU7QUFDeEUsc0JBQU0sSUFBSXhCLEtBQUosQ0FBVSxrREFBa0QsS0FBS04sR0FBTCxHQUFXZCxDQUE3RCxDQUFWLENBQU47QUFDRDtBQUNELGtCQUFJLEtBQUtxRCxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLEtBQXNDLENBQUMsS0FBS1MsV0FBTCxDQUFpQlQsUUFBakIsQ0FBMEIsR0FBMUIsRUFBK0IsQ0FBQyxDQUFoQyxDQUEzQyxFQUErRTtBQUM3RSxzQkFBTSxJQUFJeEIsS0FBSixDQUFVLGtEQUFrRCxLQUFLTixHQUFMLEdBQVdkLENBQTdELENBQVYsQ0FBTjtBQUNEO0FBQ0YsYUFQTSxNQU9BLElBQUksQ0FBQyxLQUFLaUYsSUFBTCxDQUFVUCxHQUFWLENBQUwsRUFBcUI7QUFDMUIsb0JBQU0sSUFBSXRELEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRDs7QUFFRCxnQkFBSSxLQUFLaUYsSUFBTCxDQUFVUCxHQUFWLEtBQWtCLEtBQUtyQixXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQXRCLEVBQTBEO0FBQ3hELG9CQUFNLElBQUl4QixLQUFKLENBQVUsb0NBQW9DLEtBQUtOLEdBQUwsR0FBV2QsQ0FBL0MsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsaUJBQUtxRCxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEIvQixJQUFJLENBQWhDO0FBQ0E7QUEzWEo7QUE2WEQ7QUFDRiIsImZpbGUiOiJwYXJzZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBTUCwgRElHSVQsIEFUT01fQ0hBUixcbiAgVEFHLCBDT01NQU5ELCB2ZXJpZnlcbn0gZnJvbSAnLi9mb3JtYWwtc3ludGF4J1xuXG5sZXQgQVNDSUlfTkwgPSAxMFxubGV0IEFTQ0lJX0NSID0gMTNcbmxldCBBU0NJSV9TUEFDRSA9IDMyXG5sZXQgQVNDSUlfTEVGVF9CUkFDS0VUID0gOTFcbmxldCBBU0NJSV9SSUdIVF9CUkFDS0VUID0gOTNcblxuZnVuY3Rpb24gZnJvbUNoYXJDb2RlICh1aW50OEFycmF5KSB7XG4gIGNvbnN0IGJhdGNoU2l6ZSA9IDEwMjQwXG4gIHZhciBzdHJpbmdzID0gW11cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHVpbnQ4QXJyYXkubGVuZ3RoOyBpICs9IGJhdGNoU2l6ZSkge1xuICAgIGNvbnN0IGJlZ2luID0gaVxuICAgIGNvbnN0IGVuZCA9IE1hdGgubWluKGkgKyBiYXRjaFNpemUsIHVpbnQ4QXJyYXkubGVuZ3RoKVxuICAgIHN0cmluZ3MucHVzaChTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIHVpbnQ4QXJyYXkuc3ViYXJyYXkoYmVnaW4sIGVuZCkpKVxuICB9XG5cbiAgcmV0dXJuIHN0cmluZ3Muam9pbignJylcbn1cblxuZnVuY3Rpb24gZnJvbUNoYXJDb2RlVHJpbW1lZCAodWludDhBcnJheSkge1xuICBsZXQgYmVnaW4gPSAwXG4gIGxldCBlbmQgPSB1aW50OEFycmF5Lmxlbmd0aFxuXG4gIHdoaWxlICh1aW50OEFycmF5W2JlZ2luXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICBiZWdpbisrXG4gIH1cblxuICB3aGlsZSAodWludDhBcnJheVtlbmQgLSAxXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICBlbmQtLVxuICB9XG5cbiAgaWYgKGJlZ2luICE9PSAwIHx8IGVuZCAhPT0gdWludDhBcnJheS5sZW5ndGgpIHtcbiAgICB1aW50OEFycmF5ID0gdWludDhBcnJheS5zdWJhcnJheShiZWdpbiwgZW5kKVxuICB9XG5cbiAgcmV0dXJuIGZyb21DaGFyQ29kZSh1aW50OEFycmF5KVxufVxuXG5mdW5jdGlvbiBpc0VtcHR5ICh1aW50OEFycmF5KSB7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdWludDhBcnJheS5sZW5ndGg7IGkrKykge1xuICAgIGlmICh1aW50OEFycmF5W2ldICE9PSBBU0NJSV9TUEFDRSkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRydWVcbn1cblxuY2xhc3MgUGFyc2VySW5zdGFuY2Uge1xuICBjb25zdHJ1Y3RvciAoaW5wdXQsIG9wdGlvbnMpIHtcbiAgICB0aGlzLnJlbWFpbmRlciA9IG5ldyBVaW50OEFycmF5KGlucHV0IHx8IDApXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIHRoaXMucG9zID0gMFxuICB9XG4gIGdldFRhZyAoKSB7XG4gICAgaWYgKCF0aGlzLnRhZykge1xuICAgICAgdGhpcy50YWcgPSB0aGlzLmdldEVsZW1lbnQoVEFHKCkgKyAnKisnLCB0cnVlKVxuICAgIH1cbiAgICByZXR1cm4gdGhpcy50YWdcbiAgfVxuXG4gIGdldENvbW1hbmQgKCkge1xuICAgIGlmICghdGhpcy5jb21tYW5kKSB7XG4gICAgICB0aGlzLmNvbW1hbmQgPSB0aGlzLmdldEVsZW1lbnQoQ09NTUFORCgpKVxuICAgIH1cblxuICAgIHN3aXRjaCAoKHRoaXMuY29tbWFuZCB8fCAnJykudG9TdHJpbmcoKS50b1VwcGVyQ2FzZSgpKSB7XG4gICAgICBjYXNlICdPSyc6XG4gICAgICBjYXNlICdOTyc6XG4gICAgICBjYXNlICdCQUQnOlxuICAgICAgY2FzZSAnUFJFQVVUSCc6XG4gICAgICBjYXNlICdCWUUnOlxuICAgICAgICBsZXQgbGFzdFJpZ2h0QnJhY2tldCA9IHRoaXMucmVtYWluZGVyLmxhc3RJbmRleE9mKEFTQ0lJX1JJR0hUX0JSQUNLRVQpXG4gICAgICAgIGlmICh0aGlzLnJlbWFpbmRlclsxXSA9PT0gQVNDSUlfTEVGVF9CUkFDS0VUICYmIGxhc3RSaWdodEJyYWNrZXQgPiAxKSB7XG4gICAgICAgICAgdGhpcy5odW1hblJlYWRhYmxlID0gZnJvbUNoYXJDb2RlVHJpbW1lZCh0aGlzLnJlbWFpbmRlci5zdWJhcnJheShsYXN0UmlnaHRCcmFja2V0ICsgMSkpXG4gICAgICAgICAgdGhpcy5yZW1haW5kZXIgPSB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgwLCBsYXN0UmlnaHRCcmFja2V0ICsgMSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmh1bWFuUmVhZGFibGUgPSBmcm9tQ2hhckNvZGVUcmltbWVkKHRoaXMucmVtYWluZGVyKVxuICAgICAgICAgIHRoaXMucmVtYWluZGVyID0gbmV3IFVpbnQ4QXJyYXkoMClcbiAgICAgICAgfVxuICAgICAgICBicmVha1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmNvbW1hbmRcbiAgfVxuXG4gIGdldEVsZW1lbnQgKHN5bnRheCkge1xuICAgIGxldCBlbGVtZW50XG4gICAgaWYgKHRoaXMucmVtYWluZGVyWzBdID09PSBBU0NJSV9TUEFDRSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHdoaXRlc3BhY2UgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGxldCBmaXJzdFNwYWNlID0gdGhpcy5yZW1haW5kZXIuaW5kZXhPZihBU0NJSV9TUEFDRSlcbiAgICBpZiAodGhpcy5yZW1haW5kZXIubGVuZ3RoID4gMCAmJiBmaXJzdFNwYWNlICE9PSAwKSB7XG4gICAgICBpZiAoZmlyc3RTcGFjZSA9PT0gLTEpIHtcbiAgICAgICAgZWxlbWVudCA9IGZyb21DaGFyQ29kZSh0aGlzLnJlbWFpbmRlcilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsZW1lbnQgPSBmcm9tQ2hhckNvZGUodGhpcy5yZW1haW5kZXIuc3ViYXJyYXkoMCwgZmlyc3RTcGFjZSkpXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGVyclBvcyA9IHZlcmlmeShlbGVtZW50LCBzeW50YXgpXG4gICAgICBpZiAoZXJyUG9zID49IDApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGVyclBvcykpXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIHRoaXMucG9zICs9IGVsZW1lbnQubGVuZ3RoXG4gICAgdGhpcy5yZW1haW5kZXIgPSB0aGlzLnJlbWFpbmRlci5zdWJhcnJheShlbGVtZW50Lmxlbmd0aClcblxuICAgIHJldHVybiBlbGVtZW50XG4gIH1cblxuICBnZXRTcGFjZSAoKSB7XG4gICAgaWYgKCF0aGlzLnJlbWFpbmRlci5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGlmICh2ZXJpZnkoU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnJlbWFpbmRlclswXSksIFNQKCkpID49IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICB0aGlzLnBvcysrXG4gICAgdGhpcy5yZW1haW5kZXIgPSB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgxKVxuICB9XG5cbiAgZ2V0QXR0cmlidXRlcyAoKSB7XG4gICAgaWYgKCF0aGlzLnJlbWFpbmRlci5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIGlmICh0aGlzLnJlbWFpbmRlclswXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFRva2VuUGFyc2VyKHRoaXMsIHRoaXMucG9zLCB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgpLCB0aGlzLm9wdGlvbnMpLmdldEF0dHJpYnV0ZXMoKVxuICB9XG59XG5cbmNsYXNzIE5vZGUge1xuICBjb25zdHJ1Y3RvciAodWludDhBcnJheSwgcGFyZW50Tm9kZSwgc3RhcnRQb3MpIHtcbiAgICB0aGlzLnVpbnQ4QXJyYXkgPSB1aW50OEFycmF5XG4gICAgdGhpcy5jaGlsZE5vZGVzID0gW11cbiAgICB0aGlzLnR5cGUgPSBmYWxzZVxuICAgIHRoaXMuY2xvc2VkID0gdHJ1ZVxuICAgIHRoaXMudmFsdWVTa2lwID0gW11cbiAgICB0aGlzLnN0YXJ0UG9zID0gc3RhcnRQb3NcbiAgICB0aGlzLnZhbHVlU3RhcnQgPSB0aGlzLnZhbHVlRW5kID0gdHlwZW9mIHN0YXJ0UG9zID09PSAnbnVtYmVyJyA/IHN0YXJ0UG9zICsgMSA6IDBcblxuICAgIGlmIChwYXJlbnROb2RlKSB7XG4gICAgICB0aGlzLnBhcmVudE5vZGUgPSBwYXJlbnROb2RlXG4gICAgICBwYXJlbnROb2RlLmNoaWxkTm9kZXMucHVzaCh0aGlzKVxuICAgIH1cbiAgfVxuXG4gIGdldFZhbHVlICgpIHtcbiAgICBsZXQgdmFsdWUgPSBmcm9tQ2hhckNvZGUodGhpcy5nZXRWYWx1ZUFycmF5KCkpXG4gICAgcmV0dXJuIHRoaXMudmFsdWVUb1VwcGVyQ2FzZSA/IHZhbHVlLnRvVXBwZXJDYXNlKCkgOiB2YWx1ZVxuICB9XG5cbiAgZ2V0VmFsdWVMZW5ndGggKCkge1xuICAgIHJldHVybiB0aGlzLnZhbHVlRW5kIC0gdGhpcy52YWx1ZVN0YXJ0IC0gdGhpcy52YWx1ZVNraXAubGVuZ3RoXG4gIH1cblxuICBnZXRWYWx1ZUFycmF5ICgpIHtcbiAgICBjb25zdCB2YWx1ZUFycmF5ID0gdGhpcy51aW50OEFycmF5LnN1YmFycmF5KHRoaXMudmFsdWVTdGFydCwgdGhpcy52YWx1ZUVuZClcblxuICAgIGlmICh0aGlzLnZhbHVlU2tpcC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB2YWx1ZUFycmF5XG4gICAgfVxuXG4gICAgbGV0IGZpbHRlcmVkQXJyYXkgPSBuZXcgVWludDhBcnJheSh2YWx1ZUFycmF5Lmxlbmd0aCAtIHRoaXMudmFsdWVTa2lwLmxlbmd0aClcbiAgICBsZXQgYmVnaW4gPSAwXG4gICAgbGV0IG9mZnNldCA9IDBcbiAgICBsZXQgc2tpcCA9IHRoaXMudmFsdWVTa2lwLnNsaWNlKClcblxuICAgIHNraXAucHVzaCh2YWx1ZUFycmF5Lmxlbmd0aClcblxuICAgIHNraXAuZm9yRWFjaChmdW5jdGlvbiAoZW5kKSB7XG4gICAgICBpZiAoZW5kID4gYmVnaW4pIHtcbiAgICAgICAgdmFyIHN1YkFycmF5ID0gdmFsdWVBcnJheS5zdWJhcnJheShiZWdpbiwgZW5kKVxuICAgICAgICBmaWx0ZXJlZEFycmF5LnNldChzdWJBcnJheSwgb2Zmc2V0KVxuICAgICAgICBvZmZzZXQgKz0gc3ViQXJyYXkubGVuZ3RoXG4gICAgICB9XG4gICAgICBiZWdpbiA9IGVuZCArIDFcbiAgICB9KVxuXG4gICAgcmV0dXJuIGZpbHRlcmVkQXJyYXlcbiAgfVxuXG4gIGVxdWFscyAodmFsdWUsIGNhc2VTZW5zaXRpdmUpIHtcbiAgICBpZiAodGhpcy5nZXRWYWx1ZUxlbmd0aCgpICE9PSB2YWx1ZS5sZW5ndGgpIHtcbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmVxdWFsc0F0KHZhbHVlLCAwLCBjYXNlU2Vuc2l0aXZlKVxuICB9XG5cbiAgZXF1YWxzQXQgKHZhbHVlLCBpbmRleCwgY2FzZVNlbnNpdGl2ZSkge1xuICAgIGNhc2VTZW5zaXRpdmUgPSB0eXBlb2YgY2FzZVNlbnNpdGl2ZSA9PT0gJ2Jvb2xlYW4nID8gY2FzZVNlbnNpdGl2ZSA6IHRydWVcblxuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIGluZGV4ID0gdGhpcy52YWx1ZUVuZCArIGluZGV4XG5cbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKHRoaXMudmFsdWVTdGFydCArIGluZGV4KSA+PSAwKSB7XG4gICAgICAgIGluZGV4LS1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlU3RhcnQgKyBpbmRleFxuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWUubGVuZ3RoOyBpKyspIHtcbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKGluZGV4IC0gdGhpcy52YWx1ZVN0YXJ0KSA+PSAwKSB7XG4gICAgICAgIGluZGV4KytcbiAgICAgIH1cblxuICAgICAgaWYgKGluZGV4ID49IHRoaXMudmFsdWVFbmQpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG5cbiAgICAgIGxldCB1aW50OENoYXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMudWludDhBcnJheVtpbmRleF0pXG4gICAgICBsZXQgY2hhciA9IHZhbHVlW2ldXG5cbiAgICAgIGlmICghY2FzZVNlbnNpdGl2ZSkge1xuICAgICAgICB1aW50OENoYXIgPSB1aW50OENoYXIudG9VcHBlckNhc2UoKVxuICAgICAgICBjaGFyID0gY2hhci50b1VwcGVyQ2FzZSgpXG4gICAgICB9XG5cbiAgICAgIGlmICh1aW50OENoYXIgIT09IGNoYXIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG5cbiAgICAgIGluZGV4KytcbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgaXNOdW1iZXIgKCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy52YWx1ZUVuZCAtIHRoaXMudmFsdWVTdGFydDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy52YWx1ZVNraXAuaW5kZXhPZihpKSA+PSAwKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5pc0RpZ2l0KGkpKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBpc0RpZ2l0IChpbmRleCkge1xuICAgIGlmIChpbmRleCA8IDApIHtcbiAgICAgIGluZGV4ID0gdGhpcy52YWx1ZUVuZCArIGluZGV4XG5cbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKHRoaXMudmFsdWVTdGFydCArIGluZGV4KSA+PSAwKSB7XG4gICAgICAgIGluZGV4LS1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlU3RhcnQgKyBpbmRleFxuXG4gICAgICB3aGlsZSAodGhpcy52YWx1ZVNraXAuaW5kZXhPZih0aGlzLnZhbHVlU3RhcnQgKyBpbmRleCkgPj0gMCkge1xuICAgICAgICBpbmRleCsrXG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGFzY2lpID0gdGhpcy51aW50OEFycmF5W2luZGV4XVxuICAgIHJldHVybiBhc2NpaSA+PSA0OCAmJiBhc2NpaSA8PSA1N1xuICB9XG5cbiAgY29udGFpbnNDaGFyIChjaGFyKSB7XG4gICAgbGV0IGFzY2lpID0gY2hhci5jaGFyQ29kZUF0KDApXG5cbiAgICBmb3IgKGxldCBpID0gdGhpcy52YWx1ZVN0YXJ0OyBpIDwgdGhpcy52YWx1ZUVuZDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy52YWx1ZVNraXAuaW5kZXhPZihpIC0gdGhpcy52YWx1ZVN0YXJ0KSA+PSAwKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLnVpbnQ4QXJyYXlbaV0gPT09IGFzY2lpKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuY2xhc3MgVG9rZW5QYXJzZXIge1xuICBjb25zdHJ1Y3RvciAocGFyZW50LCBzdGFydFBvcywgdWludDhBcnJheSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy51aW50OEFycmF5ID0gdWludDhBcnJheVxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnNcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudFxuXG4gICAgdGhpcy50cmVlID0gdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSgpXG4gICAgdGhpcy5wb3MgPSBzdGFydFBvcyB8fCAwXG5cbiAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnVFJFRSdcblxuICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy52YWx1ZUFzU3RyaW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMub3B0aW9ucy52YWx1ZUFzU3RyaW5nID0gdHJ1ZVxuICAgIH1cblxuICAgIHRoaXMucHJvY2Vzc1N0cmluZygpXG4gIH1cblxuICBnZXRBdHRyaWJ1dGVzICgpIHtcbiAgICBsZXQgYXR0cmlidXRlcyA9IFtdXG4gICAgbGV0IGJyYW5jaCA9IGF0dHJpYnV0ZXNcblxuICAgIGxldCB3YWxrID0gbm9kZSA9PiB7XG4gICAgICBsZXQgZWxtXG4gICAgICBsZXQgY3VyQnJhbmNoID0gYnJhbmNoXG4gICAgICBsZXQgcGFydGlhbFxuXG4gICAgICBpZiAoIW5vZGUuY2xvc2VkICYmIG5vZGUudHlwZSA9PT0gJ1NFUVVFTkNFJyAmJiBub2RlLmVxdWFscygnKicpKSB7XG4gICAgICAgIG5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICBub2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgIH1cblxuICAgIC8vIElmIHRoZSBub2RlIHdhcyBuZXZlciBjbG9zZWQsIHRocm93IGl0XG4gICAgICBpZiAoIW5vZGUuY2xvc2VkKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIHRoaXMudWludDhBcnJheS5sZW5ndGggLSAxKSlcbiAgICAgIH1cblxuICAgICAgc3dpdGNoIChub2RlLnR5cGUudG9VcHBlckNhc2UoKSkge1xuICAgICAgICBjYXNlICdMSVRFUkFMJzpcbiAgICAgICAgY2FzZSAnU1RSSU5HJzpcbiAgICAgICAgICBlbG0gPSB7XG4gICAgICAgICAgICB0eXBlOiBub2RlLnR5cGUudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLm9wdGlvbnMudmFsdWVBc1N0cmluZyA/IG5vZGUuZ2V0VmFsdWUoKSA6IG5vZGUuZ2V0VmFsdWVBcnJheSgpXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyYW5jaC5wdXNoKGVsbSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdTRVFVRU5DRSc6XG4gICAgICAgICAgZWxtID0ge1xuICAgICAgICAgICAgdHlwZTogbm9kZS50eXBlLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICB2YWx1ZTogbm9kZS5nZXRWYWx1ZSgpXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyYW5jaC5wdXNoKGVsbSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdBVE9NJzpcbiAgICAgICAgICBpZiAobm9kZS5lcXVhbHMoJ05JTCcsIHRydWUpKSB7XG4gICAgICAgICAgICBicmFuY2gucHVzaChudWxsKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgICAgZWxtID0ge1xuICAgICAgICAgICAgdHlwZTogbm9kZS50eXBlLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICB2YWx1ZTogbm9kZS5nZXRWYWx1ZSgpXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyYW5jaC5wdXNoKGVsbSlcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdTRUNUSU9OJzpcbiAgICAgICAgICBicmFuY2ggPSBicmFuY2hbYnJhbmNoLmxlbmd0aCAtIDFdLnNlY3Rpb24gPSBbXVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ0xJU1QnOlxuICAgICAgICAgIGVsbSA9IFtdXG4gICAgICAgICAgYnJhbmNoLnB1c2goZWxtKVxuICAgICAgICAgIGJyYW5jaCA9IGVsbVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ1BBUlRJQUwnOlxuICAgICAgICAgIHBhcnRpYWwgPSBub2RlLmdldFZhbHVlKCkuc3BsaXQoJy4nKS5tYXAoTnVtYmVyKVxuICAgICAgICAgIGJyYW5jaFticmFuY2gubGVuZ3RoIC0gMV0ucGFydGlhbCA9IHBhcnRpYWxcbiAgICAgICAgICBicmVha1xuICAgICAgfVxuXG4gICAgICBub2RlLmNoaWxkTm9kZXMuZm9yRWFjaChmdW5jdGlvbiAoY2hpbGROb2RlKSB7XG4gICAgICAgIHdhbGsoY2hpbGROb2RlKVxuICAgICAgfSlcbiAgICAgIGJyYW5jaCA9IGN1ckJyYW5jaFxuICAgIH1cblxuICAgIHdhbGsodGhpcy50cmVlKVxuXG4gICAgcmV0dXJuIGF0dHJpYnV0ZXNcbiAgfVxuXG4gIGNyZWF0ZU5vZGUgKHBhcmVudE5vZGUsIHN0YXJ0UG9zKSB7XG4gICAgcmV0dXJuIG5ldyBOb2RlKHRoaXMudWludDhBcnJheSwgcGFyZW50Tm9kZSwgc3RhcnRQb3MpXG4gIH1cblxuICBwcm9jZXNzU3RyaW5nICgpIHtcbiAgICBsZXQgaVxuICAgIGxldCBsZW5cbiAgICBjb25zdCBjaGVja1NQID0gKHBvcykgPT4ge1xuICAgIC8vIGp1bXAgdG8gdGhlIG5leHQgbm9uIHdoaXRlc3BhY2UgcG9zXG4gICAgICB3aGlsZSAodGhpcy51aW50OEFycmF5W2kgKyAxXSA9PT0gJyAnKSB7XG4gICAgICAgIGkrK1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoaSA9IDAsIGxlbiA9IHRoaXMudWludDhBcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgbGV0IGNociA9IFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy51aW50OEFycmF5W2ldKVxuXG4gICAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgICAgY2FzZSAnTk9STUFMJzpcblxuICAgICAgICAgIHN3aXRjaCAoY2hyKSB7XG4gICAgICAgICAgLy8gRFFVT1RFIHN0YXJ0cyBhIG5ldyBzdHJpbmdcbiAgICAgICAgICAgIGNhc2UgJ1wiJzpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnc3RyaW5nJ1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1NUUklORydcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgLy8gKCBzdGFydHMgYSBuZXcgbGlzdFxuICAgICAgICAgICAgY2FzZSAnKCc6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0xJU1QnXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgIC8vICkgY2xvc2VzIGEgbGlzdFxuICAgICAgICAgICAgY2FzZSAnKSc6XG4gICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLnR5cGUgIT09ICdMSVNUJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBsaXN0IHRlcm1pbmF0b3IgKSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgLy8gXSBjbG9zZXMgc2VjdGlvbiBncm91cFxuICAgICAgICAgICAgY2FzZSAnXSc6XG4gICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLnR5cGUgIT09ICdTRUNUSU9OJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzZWN0aW9uIHRlcm1pbmF0b3IgXSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAvLyA8IHN0YXJ0cyBhIG5ldyBwYXJ0aWFsXG4gICAgICAgICAgICBjYXNlICc8JzpcbiAgICAgICAgICAgICAgaWYgKFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy51aW50OEFycmF5W2kgLSAxXSkgIT09ICddJykge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnUEFSVElBTCdcbiAgICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1BBUlRJQUwnXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAvLyB7IHN0YXJ0cyBhIG5ldyBsaXRlcmFsXG4gICAgICAgICAgICBjYXNlICd7JzpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnTElURVJBTCdcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdMSVRFUkFMJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAvLyAoIHN0YXJ0cyBhIG5ldyBzZXF1ZW5jZVxuICAgICAgICAgICAgY2FzZSAnKic6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFUVVFTkNFJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAvLyBub3JtYWxseSBhIHNwYWNlIHNob3VsZCBuZXZlciBvY2N1clxuICAgICAgICAgICAgY2FzZSAnICc6XG4gICAgICAgICAgICAvLyBqdXN0IGlnbm9yZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgLy8gWyBzdGFydHMgc2VjdGlvblxuICAgICAgICAgICAgY2FzZSAnWyc6XG4gICAgICAgICAgICAvLyBJZiBpdCBpcyB0aGUgKmZpcnN0KiBlbGVtZW50IGFmdGVyIHJlc3BvbnNlIGNvbW1hbmQsIHRoZW4gcHJvY2VzcyBhcyBhIHJlc3BvbnNlIGFyZ3VtZW50IGxpc3RcbiAgICAgICAgICAgICAgaWYgKFsnT0snLCAnTk8nLCAnQkFEJywgJ0JZRScsICdQUkVBVVRIJ10uaW5kZXhPZih0aGlzLnBhcmVudC5jb21tYW5kLnRvVXBwZXJDYXNlKCkpID49IDAgJiYgdGhpcy5jdXJyZW50Tm9kZSA9PT0gdGhpcy50cmVlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcblxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VDVElPTidcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgICAgLy8gUkZDMjIyMSBkZWZpbmVzIGEgcmVzcG9uc2UgY29kZSBSRUZFUlJBTCB3aG9zZSBwYXlsb2FkIGlzIGFuXG4gICAgICAgICAgICAgIC8vIFJGQzIxOTIvUkZDNTA5MiBpbWFwdXJsIHRoYXQgd2Ugd2lsbCB0cnkgdG8gcGFyc2UgYXMgYW4gQVRPTSBidXRcbiAgICAgICAgICAgICAgLy8gZmFpbCBxdWl0ZSBiYWRseSBhdCBwYXJzaW5nLiAgU2luY2UgdGhlIGltYXB1cmwgaXMgc3VjaCBhIHVuaXF1ZVxuICAgICAgICAgICAgICAvLyAoYW5kIGNyYXp5KSB0ZXJtLCB3ZSBqdXN0IHNwZWNpYWxpemUgdGhhdCBjYXNlIGhlcmUuXG4gICAgICAgICAgICAgICAgaWYgKGZyb21DaGFyQ29kZSh0aGlzLnVpbnQ4QXJyYXkuc3ViYXJyYXkoaSArIDEsIGkgKyAxMCkpLnRvVXBwZXJDYXNlKCkgPT09ICdSRUZFUlJBTCAnKSB7XG4gICAgICAgICAgICAgICAgLy8gY3JlYXRlIHRoZSBSRUZFUlJBTCBhdG9tXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIHRoaXMucG9zICsgaSArIDEpXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpICsgOFxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaSArIDFcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgOVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVRvVXBwZXJDYXNlID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICAgICAgLy8gZWF0IGFsbCB0aGUgd2F5IHRocm91Z2ggdGhlIF0gdG8gYmUgdGhlICBJTUFQVVJMIHRva2VuLlxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCB0aGlzLnBvcyArIGkgKyAxMClcbiAgICAgICAgICAgICAgICAvLyBqdXN0IGNhbGwgdGhpcyBhbiBBVE9NLCBldmVuIHRob3VnaCBJTUFQVVJMIG1pZ2h0IGJlIG1vcmUgY29ycmVjdFxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgICAgLy8ganVtcCBpIHRvIHRoZSAnXSdcbiAgICAgICAgICAgICAgICAgIGkgPSB0aGlzLnVpbnQ4QXJyYXkuaW5kZXhPZihBU0NJSV9SSUdIVF9CUkFDS0VULCBpICsgMTApXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IHRoaXMuY3VycmVudE5vZGUuc3RhcnRQb3MgLSB0aGlzLnBvc1xuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IHRoaXMuY3VycmVudE5vZGUuZW5kUG9zIC0gdGhpcy5wb3MgKyAxXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG5cbiAgICAgICAgICAgICAgICAvLyBjbG9zZSBvdXQgdGhlIFNFQ1RJT05cbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAvLyBBbnkgQVRPTSBzdXBwb3J0ZWQgY2hhciBzdGFydHMgYSBuZXcgQXRvbSBzZXF1ZW5jZSwgb3RoZXJ3aXNlIHRocm93IGFuIGVycm9yXG4gICAgICAgICAgICAvLyBBbGxvdyBcXCBhcyB0aGUgZmlyc3QgY2hhciBmb3IgYXRvbSB0byBzdXBwb3J0IHN5c3RlbSBmbGFnc1xuICAgICAgICAgICAgLy8gQWxsb3cgJSB0byBzdXBwb3J0IExJU1QgJycgJVxuICAgICAgICAgICAgICBpZiAoQVRPTV9DSEFSKCkuaW5kZXhPZihjaHIpIDwgMCAmJiBjaHIgIT09ICdcXFxcJyAmJiBjaHIgIT09ICclJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBjYXNlICdBVE9NJzpcblxuICAgICAgICAvLyBzcGFjZSBmaW5pc2hlcyBhbiBhdG9tXG4gICAgICAgICAgaWYgKGNociA9PT0gJyAnKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgLy9cbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlICYmXG4gICAgICAgICAgKFxuICAgICAgICAgICAgKGNociA9PT0gJyknICYmIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnTElTVCcpIHx8XG4gICAgICAgICAgICAoY2hyID09PSAnXScgJiYgdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlLnR5cGUgPT09ICdTRUNUSU9OJylcbiAgICAgICAgICApXG4gICAgICAgICkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGkgLSAxXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG5cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuXG4gICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKChjaHIgPT09ICcsJyB8fCBjaHIgPT09ICc6JykgJiYgdGhpcy5jdXJyZW50Tm9kZS5pc051bWJlcigpKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgfVxuXG4gICAgICAgIC8vIFsgc3RhcnRzIGEgc2VjdGlvbiBncm91cCBmb3IgdGhpcyBlbGVtZW50XG4gICAgICAgICAgaWYgKGNociA9PT0gJ1snICYmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnQk9EWScsIGZhbHNlKSB8fCB0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnQk9EWS5QRUVLJywgZmFsc2UpKSkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlLCB0aGlzLnBvcyArIGkpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VDVElPTidcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSAnPCcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzdGFydCBvZiBwYXJ0aWFsIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICAgICAgICB9XG5cbiAgICAgICAgLy8gaWYgdGhlIGNoYXIgaXMgbm90IEFUT00gY29tcGF0aWJsZSwgdGhyb3cuIEFsbG93IFxcKiBhcyBhbiBleGNlcHRpb25cbiAgICAgICAgICBpZiAoQVRPTV9DSEFSKCkuaW5kZXhPZihjaHIpIDwgMCAmJiBjaHIgIT09ICddJyAmJiAhKGNociA9PT0gJyonICYmIHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCdcXFxcJykpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnXFxcXConKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnU1RSSU5HJzpcblxuICAgICAgICAvLyBEUVVPVEUgZW5kcyB0aGUgc3RyaW5nIHNlcXVlbmNlXG4gICAgICAgICAgaWYgKGNociA9PT0gJ1wiJykge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgLy8gXFwgRXNjYXBlcyB0aGUgZm9sbG93aW5nIGNoYXJcbiAgICAgICAgICBpZiAoY2hyID09PSAnXFxcXCcpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTa2lwLnB1c2goaSAtIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydClcbiAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgaWYgKGkgPj0gbGVuKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgaW5wdXQgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY2hyID0gU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnVpbnQ4QXJyYXlbaV0pXG4gICAgICAgICAgfVxuXG4gICAgICAgIC8qIC8vIHNraXAgdGhpcyBjaGVjaywgb3RoZXJ3aXNlIHRoZSBwYXJzZXIgbWlnaHQgZXhwbG9kZSBvbiBiaW5hcnkgaW5wdXRcbiAgICAgICAgaWYgKFRFWFRfQ0hBUigpLmluZGV4T2YoY2hyKSA8IDApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSk7XG4gICAgICAgIH1cbiAgICAgICAgKi9cblxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnUEFSVElBTCc6XG4gICAgICAgICAgaWYgKGNociA9PT0gJz4nKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnLicsIC0xKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIHBhcnRpYWwgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNociA9PT0gJy4nICYmICghdGhpcy5jdXJyZW50Tm9kZS5nZXRWYWx1ZUxlbmd0aCgpIHx8IHRoaXMuY3VycmVudE5vZGUuY29udGFpbnNDaGFyKCcuJykpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgcGFydGlhbCBzZXBhcmF0b3IgLiBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKERJR0lUKCkuaW5kZXhPZihjaHIpIDwgMCAmJiBjaHIgIT09ICcuJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgIT09ICcuJyAmJiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHMoJzAnKSB8fCB0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcuMCcsIC0yKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwYXJ0aWFsIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIGNhc2UgJ0xJVEVSQUwnOlxuICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLnN0YXJ0ZWQpIHtcbiAgICAgICAgICAgIGlmIChjaHIgPT09ICdcXHUwMDAwJykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgXFxcXHgwMCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcblxuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUuZ2V0VmFsdWVMZW5ndGgoKSA+PSB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSAnKycgJiYgdGhpcy5vcHRpb25zLmxpdGVyYWxQbHVzKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxQbHVzID0gdHJ1ZVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSAnfScpIHtcbiAgICAgICAgICAgIGlmICghKCdsaXRlcmFsTGVuZ3RoJyBpbiB0aGlzLmN1cnJlbnROb2RlKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgbGl0ZXJhbCBwcmVmaXggZW5kIGNoYXIgfSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy51aW50OEFycmF5W2kgKyAxXSA9PT0gQVNDSUlfTkwpIHtcbiAgICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMudWludDhBcnJheVtpICsgMV0gPT09IEFTQ0lJX0NSICYmIHRoaXMudWludDhBcnJheVtpICsgMl0gPT09IEFTQ0lJX05MKSB7XG4gICAgICAgICAgICAgIGkgKz0gMlxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaSArIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCA9IE51bWJlcih0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGgpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnN0YXJ0ZWQgPSB0cnVlXG5cbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoKSB7XG4gICAgICAgICAgICAvLyBzcGVjaWFsIGNhc2Ugd2hlcmUgbGl0ZXJhbCBjb250ZW50IGxlbmd0aCBpcyAwXG4gICAgICAgICAgICAvLyBjbG9zZSB0aGUgbm9kZSByaWdodCBhd2F5LCBkbyBub3Qgd2FpdCBmb3IgYWRkaXRpb25hbCBpbnB1dFxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoRElHSVQoKS5pbmRleE9mKGNocikgPCAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPT09ICcwJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpdGVyYWwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPSAodGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoIHx8ICcnKSArIGNoclxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnU0VRVUVOQ0UnOlxuICAgICAgICAvLyBzcGFjZSBmaW5pc2hlcyB0aGUgc2VxdWVuY2Ugc2V0XG4gICAgICAgICAgaWYgKGNociA9PT0gJyAnKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudE5vZGUuaXNEaWdpdCgtMSkgJiYgIXRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJyonLCAtMSkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHdoaXRlc3BhY2UgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnOicsIC0yKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgd2hpdGVzcGFjZSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGkgLSAxXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGUgJiZcbiAgICAgICAgICBjaHIgPT09ICddJyAmJlxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnU0VDVElPTicpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09ICc6Jykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByYW5nZSBzZXBhcmF0b3IgOiBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICcqJykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcsJywgLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCc6JywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByYW5nZSB3aWxkY2FyZCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICcsJykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzZXF1ZW5jZSBzZXBhcmF0b3IgLCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnOicsIC0yKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc2VxdWVuY2Ugc2VwYXJhdG9yICwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoIS9cXGQvLnRlc3QoY2hyKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICgvXFxkLy50ZXN0KGNocikgJiYgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIG51bWJlciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGJ1ZmZlcnMsIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgcGFyc2VyID0gbmV3IFBhcnNlckluc3RhbmNlKGJ1ZmZlcnMsIG9wdGlvbnMpXG4gIGxldCByZXNwb25zZSA9IHt9XG5cbiAgcmVzcG9uc2UudGFnID0gcGFyc2VyLmdldFRhZygpXG4gIHBhcnNlci5nZXRTcGFjZSgpXG4gIHJlc3BvbnNlLmNvbW1hbmQgPSBwYXJzZXIuZ2V0Q29tbWFuZCgpXG5cbiAgaWYgKFsnVUlEJywgJ0FVVEhFTlRJQ0FURSddLmluZGV4T2YoKHJlc3BvbnNlLmNvbW1hbmQgfHwgJycpLnRvVXBwZXJDYXNlKCkpID49IDApIHtcbiAgICBwYXJzZXIuZ2V0U3BhY2UoKVxuICAgIHJlc3BvbnNlLmNvbW1hbmQgKz0gJyAnICsgcGFyc2VyLmdldEVsZW1lbnQoQ09NTUFORCgpKVxuICB9XG5cbiAgaWYgKCFpc0VtcHR5KHBhcnNlci5yZW1haW5kZXIpKSB7XG4gICAgcGFyc2VyLmdldFNwYWNlKClcbiAgICByZXNwb25zZS5hdHRyaWJ1dGVzID0gcGFyc2VyLmdldEF0dHJpYnV0ZXMoKVxuICB9XG5cbiAgaWYgKHBhcnNlci5odW1hblJlYWRhYmxlKSB7XG4gICAgcmVzcG9uc2UuYXR0cmlidXRlcyA9IChyZXNwb25zZS5hdHRyaWJ1dGVzIHx8IFtdKS5jb25jYXQoe1xuICAgICAgdHlwZTogJ1RFWFQnLFxuICAgICAgdmFsdWU6IHBhcnNlci5odW1hblJlYWRhYmxlXG4gICAgfSlcbiAgfVxuXG4gIHJldHVybiByZXNwb25zZVxufVxuIl19