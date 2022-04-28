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
    response.command += ' ' + parser.getElement(_formalSyntax.IS_COMMAND);
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

  while (uint8Array[begin] === _formalSyntax.ASCII_SPACE) {
    begin++;
  }

  while (uint8Array[end - 1] === _formalSyntax.ASCII_SPACE) {
    end--;
  }

  if (begin !== 0 || end !== uint8Array.length) {
    uint8Array = uint8Array.subarray(begin, end);
  }

  return fromCharCode(uint8Array);
}

function isEmpty(uint8Array) {
  for (var i = 0; i < uint8Array.length; i++) {
    if (uint8Array[i] !== _formalSyntax.ASCII_SPACE) {
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
        var syntaxChecker = function syntaxChecker(chr) {
          return (0, _formalSyntax.IS_TAG)(chr) || chr === _formalSyntax.ASCII_ASTERISK || chr === _formalSyntax.ASCII_PLUS;
        };
        this.tag = this.getElement(syntaxChecker);
      }
      return this.tag;
    }
  }, {
    key: 'getCommand',
    value: function getCommand() {
      if (!this.command) {
        this.command = this.getElement(_formalSyntax.IS_COMMAND);
      }

      switch ((this.command || '').toString().toUpperCase()) {
        case 'OK':
        case 'NO':
        case 'BAD':
        case 'PREAUTH':
        case 'BYE':
          var lastRightBracket = this.remainder.lastIndexOf(_formalSyntax.ASCII_RIGHT_BRACKET);
          if (this.remainder[1] === _formalSyntax.ASCII_LEFT_BRACKET && lastRightBracket > 1) {
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
    value: function getElement(syntaxChecker) {
      var element = void 0;
      if (this.remainder[0] === _formalSyntax.ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      var firstSpace = this.remainder.indexOf(_formalSyntax.ASCII_SPACE);
      if (this.remainder.length > 0 && firstSpace !== 0) {
        if (firstSpace === -1) {
          element = this.remainder;
        } else {
          element = this.remainder.subarray(0, firstSpace);
        }

        for (var i = 0; i < element.length; i++) {
          if (!syntaxChecker(element[i])) {
            throw new Error('Unexpected char at position ' + (this.pos + i));
          }
        }
      } else {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      this.pos += element.length;
      this.remainder = this.remainder.subarray(element.length);

      return fromCharCode(element);
    }
  }, {
    key: 'getSpace',
    value: function getSpace() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if (this.remainder[0] !== _formalSyntax.ASCII_SPACE) {
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

      if (this.remainder[0] === _formalSyntax.ASCII_SPACE) {
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

      return (0, _formalSyntax.IS_DIGIT)(this.uint8Array[index]);
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
        while (_this2.uint8Array[i + 1] === _formalSyntax.ASCII_SPACE) {
          i++;
        }
      };

      for (i = 0, len = this.uint8Array.length; i < len; i++) {
        var chr = this.uint8Array[i];

        switch (this.state) {
          case 'NORMAL':

            switch (chr) {
              // DQUOTE starts a new string
              case _formalSyntax.ASCII_DQUOTE:
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'string';
                this.state = 'STRING';
                this.currentNode.closed = false;
                break;

              // ( starts a new list
              case _formalSyntax.ASCII_LEFT_PARENTHESIS:
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LIST';
                this.currentNode.closed = false;
                break;

              // ) closes a list
              case _formalSyntax.ASCII_RIGHT_PARENTHESIS:
                if (this.currentNode.type !== 'LIST') {
                  throw new Error('Unexpected list terminator ) at position ' + (this.pos + i));
                }

                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;

                checkSP();
                break;

              // ] closes section group
              case _formalSyntax.ASCII_RIGHT_BRACKET:
                if (this.currentNode.type !== 'SECTION') {
                  throw new Error('Unexpected section terminator ] at position ' + (this.pos + i));
                }
                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;
                checkSP();
                break;

              // < starts a new partial
              case _formalSyntax.ASCII_LESS_THAN_SIGN:
                if (this.uint8Array[i - 1] !== _formalSyntax.ASCII_RIGHT_BRACKET) {
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
              case _formalSyntax.ASCII_LEFT_CURLY_BRACKET:
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LITERAL';
                this.state = 'LITERAL';
                this.currentNode.closed = false;
                break;

              // ( starts a new sequence
              case _formalSyntax.ASCII_ASTERISK:
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'SEQUENCE';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.currentNode.closed = false;
                this.state = 'SEQUENCE';
                break;

              // normally a space should never occur
              case _formalSyntax.ASCII_SPACE:
                // just ignore
                break;

              // start of a literal8, handle in case ASCII_LEFT_CURLY_BRACKET
              case _formalSyntax.ASCII_TILDE:
                break;

              // [ starts section
              case _formalSyntax.ASCII_LEFT_BRACKET:
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
                    i = this.uint8Array.indexOf(_formalSyntax.ASCII_RIGHT_BRACKET, i + 10);
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
                if (!(0, _formalSyntax.IS_ATOM_CHAR)(chr) && chr !== _formalSyntax.ASCII_BACKSLASH && chr !== _formalSyntax.ASCII_PERCENT_SIGN) {
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
            if (chr === _formalSyntax.ASCII_SPACE) {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            }

            //
            if (this.currentNode.parentNode && (chr === _formalSyntax.ASCII_RIGHT_PARENTHESIS && this.currentNode.parentNode.type === 'LIST' || chr === _formalSyntax.ASCII_RIGHT_BRACKET && this.currentNode.parentNode.type === 'SECTION')) {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if ((chr === _formalSyntax.ASCII_COMMA || chr === _formalSyntax.ASCII_COLON) && this.currentNode.isNumber()) {
              this.currentNode.type = 'SEQUENCE';
              this.currentNode.closed = true;
              this.state = 'SEQUENCE';
            }

            // [ starts a section group for this element
            if (chr === _formalSyntax.ASCII_LEFT_BRACKET && (this.currentNode.equals('BODY', false) || this.currentNode.equals('BODY.PEEK', false))) {
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.createNode(this.currentNode.parentNode, this.pos + i);
              this.currentNode.type = 'SECTION';
              this.currentNode.closed = false;
              this.state = 'NORMAL';
              break;
            }

            if (chr === _formalSyntax.ASCII_LESS_THAN_SIGN) {
              throw new Error('Unexpected start of partial at position ' + this.pos);
            }

            // if the char is not ATOM compatible, throw. Allow \* as an exception
            if (!(0, _formalSyntax.IS_ATOM_CHAR)(chr) && chr !== _formalSyntax.ASCII_RIGHT_BRACKET && !(chr === _formalSyntax.ASCII_ASTERISK && this.currentNode.equals('\\'))) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            } else if (this.currentNode.equals('\\*')) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'STRING':

            // DQUOTE ends the string sequence
            if (chr === _formalSyntax.ASCII_DQUOTE) {
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            // \ Escapes the following char
            if (chr === _formalSyntax.ASCII_BACKSLASH) {
              this.currentNode.valueSkip.push(i - this.currentNode.valueStart);
              i++;
              if (i >= len) {
                throw new Error('Unexpected end of input at position ' + (this.pos + i));
              }
              chr = this.uint8Array[i];
            }

            /* // skip this check, otherwise the parser might explode on binary input
            if (TEXT_CHAR().indexOf(chr) < 0) {
                throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            */

            this.currentNode.valueEnd = i + 1;
            break;

          case 'PARTIAL':
            if (chr === _formalSyntax.ASCII_GREATER_THAN_SIGN) {
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

            if (chr === _formalSyntax.ASCII_FULL_STOP && (!this.currentNode.getValueLength() || this.currentNode.containsChar('.'))) {
              throw new Error('Unexpected partial separator . at position ' + this.pos);
            }

            if (!(0, _formalSyntax.IS_DIGIT)(chr) && chr !== _formalSyntax.ASCII_FULL_STOP) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if (chr !== _formalSyntax.ASCII_FULL_STOP && (this.currentNode.equals('0') || this.currentNode.equalsAt('.0', -2))) {
              throw new Error('Invalid partial at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'LITERAL':
            if (this.currentNode.started) {
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

            if (chr === _formalSyntax.ASCII_PLUS) {
              // assuming capability LITERAL+ or LITERAL-
              this.currentNode.literalPlus = true;
              break;
            }

            if (chr === _formalSyntax.ASCII_RIGHT_CURLY_BRACKET) {
              if (!('literalLength' in this.currentNode)) {
                throw new Error('Unexpected literal prefix end char } at position ' + (this.pos + i));
              }
              if (this.uint8Array[i + 1] === _formalSyntax.ASCII_NL) {
                i++;
              } else if (this.uint8Array[i + 1] === _formalSyntax.ASCII_CR && this.uint8Array[i + 2] === _formalSyntax.ASCII_NL) {
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
            if (!(0, _formalSyntax.IS_DIGIT)(chr)) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            if (this.currentNode.literalLength === '0') {
              throw new Error('Invalid literal at position ' + (this.pos + i));
            }
            this.currentNode.literalLength = (this.currentNode.literalLength || '') + String.fromCharCode(chr);
            break;

          case 'SEQUENCE':
            // space finishes the sequence set
            if (chr === _formalSyntax.ASCII_SPACE) {
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
            } else if (this.currentNode.parentNode && chr === _formalSyntax.ASCII_RIGHT_BRACKET && this.currentNode.parentNode.type === 'SECTION') {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if (chr === _formalSyntax.ASCII_COLON) {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected range separator : at position ' + (this.pos + i));
              }
            } else if (chr === _formalSyntax.ASCII_ASTERISK) {
              if (!this.currentNode.equalsAt(',', -1) && !this.currentNode.equalsAt(':', -1)) {
                throw new Error('Unexpected range wildcard at position ' + (this.pos + i));
              }
            } else if (chr === _formalSyntax.ASCII_COMMA) {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
            } else if (!(0, _formalSyntax.IS_DIGIT)(chr)) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if ((0, _formalSyntax.IS_DIGIT)(chr) && this.currentNode.equalsAt('*', -1)) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wYXJzZXIuanMiXSwibmFtZXMiOlsiYnVmZmVycyIsIm9wdGlvbnMiLCJwYXJzZXIiLCJQYXJzZXJJbnN0YW5jZSIsInJlc3BvbnNlIiwidGFnIiwiZ2V0VGFnIiwiZ2V0U3BhY2UiLCJjb21tYW5kIiwiZ2V0Q29tbWFuZCIsImluZGV4T2YiLCJ0b1VwcGVyQ2FzZSIsImdldEVsZW1lbnQiLCJJU19DT01NQU5EIiwiaXNFbXB0eSIsInJlbWFpbmRlciIsImF0dHJpYnV0ZXMiLCJnZXRBdHRyaWJ1dGVzIiwiaHVtYW5SZWFkYWJsZSIsImNvbmNhdCIsInR5cGUiLCJ2YWx1ZSIsImZyb21DaGFyQ29kZSIsInVpbnQ4QXJyYXkiLCJiYXRjaFNpemUiLCJzdHJpbmdzIiwiaSIsImxlbmd0aCIsImJlZ2luIiwiZW5kIiwiTWF0aCIsIm1pbiIsInB1c2giLCJTdHJpbmciLCJhcHBseSIsInN1YmFycmF5Iiwiam9pbiIsImZyb21DaGFyQ29kZVRyaW1tZWQiLCJBU0NJSV9TUEFDRSIsImlucHV0IiwiVWludDhBcnJheSIsInBvcyIsInN5bnRheENoZWNrZXIiLCJjaHIiLCJBU0NJSV9BU1RFUklTSyIsIkFTQ0lJX1BMVVMiLCJ0b1N0cmluZyIsImxhc3RSaWdodEJyYWNrZXQiLCJsYXN0SW5kZXhPZiIsIkFTQ0lJX1JJR0hUX0JSQUNLRVQiLCJBU0NJSV9MRUZUX0JSQUNLRVQiLCJlbGVtZW50IiwiRXJyb3IiLCJmaXJzdFNwYWNlIiwiVG9rZW5QYXJzZXIiLCJOb2RlIiwicGFyZW50Tm9kZSIsInN0YXJ0UG9zIiwiY2hpbGROb2RlcyIsImNsb3NlZCIsInZhbHVlU2tpcCIsInZhbHVlU3RhcnQiLCJ2YWx1ZUVuZCIsImdldFZhbHVlQXJyYXkiLCJ2YWx1ZVRvVXBwZXJDYXNlIiwidmFsdWVBcnJheSIsImZpbHRlcmVkQXJyYXkiLCJvZmZzZXQiLCJza2lwIiwic2xpY2UiLCJmb3JFYWNoIiwic3ViQXJyYXkiLCJzZXQiLCJjYXNlU2Vuc2l0aXZlIiwiZ2V0VmFsdWVMZW5ndGgiLCJlcXVhbHNBdCIsImluZGV4IiwidWludDhDaGFyIiwiY2hhciIsImlzRGlnaXQiLCJhc2NpaSIsImNoYXJDb2RlQXQiLCJwYXJlbnQiLCJ0cmVlIiwiY3VycmVudE5vZGUiLCJjcmVhdGVOb2RlIiwic3RhdGUiLCJ2YWx1ZUFzU3RyaW5nIiwidW5kZWZpbmVkIiwicHJvY2Vzc1N0cmluZyIsImJyYW5jaCIsIndhbGsiLCJlbG0iLCJjdXJCcmFuY2giLCJwYXJ0aWFsIiwibm9kZSIsImVxdWFscyIsImdldFZhbHVlIiwic2VjdGlvbiIsInNwbGl0IiwibWFwIiwiTnVtYmVyIiwiY2hpbGROb2RlIiwibGVuIiwiY2hlY2tTUCIsIkFTQ0lJX0RRVU9URSIsIkFTQ0lJX0xFRlRfUEFSRU5USEVTSVMiLCJBU0NJSV9SSUdIVF9QQVJFTlRIRVNJUyIsImVuZFBvcyIsIkFTQ0lJX0xFU1NfVEhBTl9TSUdOIiwiQVNDSUlfTEVGVF9DVVJMWV9CUkFDS0VUIiwiQVNDSUlfVElMREUiLCJBU0NJSV9CQUNLU0xBU0giLCJBU0NJSV9QRVJDRU5UX1NJR04iLCJBU0NJSV9DT01NQSIsIkFTQ0lJX0NPTE9OIiwiaXNOdW1iZXIiLCJBU0NJSV9HUkVBVEVSX1RIQU5fU0lHTiIsIkFTQ0lJX0ZVTExfU1RPUCIsImNvbnRhaW5zQ2hhciIsInN0YXJ0ZWQiLCJsaXRlcmFsTGVuZ3RoIiwibGl0ZXJhbFBsdXMiLCJBU0NJSV9SSUdIVF9DVVJMWV9CUkFDS0VUIiwiQVNDSUlfTkwiLCJBU0NJSV9DUiJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7a0JBc3lCZSxVQUFVQSxPQUFWLEVBQWlDO0FBQUEsTUFBZEMsT0FBYyx1RUFBSixFQUFJOztBQUM5QyxNQUFJQyxTQUFTLElBQUlDLGNBQUosQ0FBbUJILE9BQW5CLEVBQTRCQyxPQUE1QixDQUFiO0FBQ0EsTUFBSUcsV0FBVyxFQUFmOztBQUVBQSxXQUFTQyxHQUFULEdBQWVILE9BQU9JLE1BQVAsRUFBZjtBQUNBSixTQUFPSyxRQUFQO0FBQ0FILFdBQVNJ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QUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQTNDLEVBQStFO0FBQzdFLHNCQUFNLElBQUl2QixLQUFKLENBQVUsa0RBQWtELEtBQUtYLEdBQUwsR0FBV2YsQ0FBN0QsQ0FBVixDQUFOO0FBQ0Q7QUFDRixhQVBNLE1BT0EsSUFBSSxDQUFDLDRCQUFTaUIsR0FBVCxDQUFMLEVBQW9CO0FBQ3pCLG9CQUFNLElBQUlTLEtBQUosQ0FBVSxrQ0FBa0MsS0FBS1gsR0FBTCxHQUFXZixDQUE3QyxDQUFWLENBQU47QUFDRDs7QUFFRCxnQkFBSSw0QkFBU2lCLEdBQVQsS0FBaUIsS0FBS3lDLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBckIsRUFBeUQ7QUFDdkQsb0JBQU0sSUFBSXZCLEtBQUosQ0FBVSxvQ0FBb0MsS0FBS1gsR0FBTCxHQUFXZixDQUEvQyxDQUFWLENBQU47QUFDRDs7QUFFRCxpQkFBSzBELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0QnBDLElBQUksQ0FBaEM7QUFDQTtBQTdYSjtBQStYRDtBQUNGIiwiZmlsZSI6InBhcnNlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIEFTQ0lJX0FTVEVSSVNLLFxuICBBU0NJSV9CQUNLU0xBU0gsXG4gIEFTQ0lJX0NPTE9OLFxuICBBU0NJSV9DT01NQSxcbiAgQVNDSUlfQ1IsXG4gIEFTQ0lJX0RRVU9URSxcbiAgQVNDSUlfRlVMTF9TVE9QLFxuICBBU0NJSV9HUkVBVEVSX1RIQU5fU0lHTixcbiAgQVNDSUlfTEVGVF9CUkFDS0VULFxuICBBU0NJSV9MRUZUX0NVUkxZX0JSQUNLRVQsXG4gIEFTQ0lJX0xFRlRfUEFSRU5USEVTSVMsXG4gIEFTQ0lJX0xFU1NfVEhBTl9TSUdOLFxuICBBU0NJSV9OTCxcbiAgQVNDSUlfUEVSQ0VOVF9TSUdOLFxuICBBU0NJSV9QTFVTLFxuICBBU0NJSV9SSUdIVF9CUkFDS0VULFxuICBBU0NJSV9SSUdIVF9DVVJMWV9CUkFDS0VULFxuICBBU0NJSV9SSUdIVF9QQVJFTlRIRVNJUyxcbiAgQVNDSUlfU1BBQ0UsXG4gIEFTQ0lJX1RJTERFLFxuICBJU19DT01NQU5ELFxuICBJU19ESUdJVCxcbiAgSVNfQVRPTV9DSEFSLFxuICBJU19UQUdcbn0gZnJvbSAnLi9mb3JtYWwtc3ludGF4J1xuXG5mdW5jdGlvbiBmcm9tQ2hhckNvZGUgKHVpbnQ4QXJyYXkpIHtcbiAgY29uc3QgYmF0Y2hTaXplID0gMTAyNDBcbiAgdmFyIHN0cmluZ3MgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdWludDhBcnJheS5sZW5ndGg7IGkgKz0gYmF0Y2hTaXplKSB7XG4gICAgY29uc3QgYmVnaW4gPSBpXG4gICAgY29uc3QgZW5kID0gTWF0aC5taW4oaSArIGJhdGNoU2l6ZSwgdWludDhBcnJheS5sZW5ndGgpXG4gICAgc3RyaW5ncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgdWludDhBcnJheS5zdWJhcnJheShiZWdpbiwgZW5kKSkpXG4gIH1cblxuICByZXR1cm4gc3RyaW5ncy5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQ2hhckNvZGVUcmltbWVkICh1aW50OEFycmF5KSB7XG4gIGxldCBiZWdpbiA9IDBcbiAgbGV0IGVuZCA9IHVpbnQ4QXJyYXkubGVuZ3RoXG5cbiAgd2hpbGUgKHVpbnQ4QXJyYXlbYmVnaW5dID09PSBBU0NJSV9TUEFDRSkge1xuICAgIGJlZ2luKytcbiAgfVxuXG4gIHdoaWxlICh1aW50OEFycmF5W2VuZCAtIDFdID09PSBBU0NJSV9TUEFDRSkge1xuICAgIGVuZC0tXG4gIH1cblxuICBpZiAoYmVnaW4gIT09IDAgfHwgZW5kICE9PSB1aW50OEFycmF5Lmxlbmd0aCkge1xuICAgIHVpbnQ4QXJyYXkgPSB1aW50OEFycmF5LnN1YmFycmF5KGJlZ2luLCBlbmQpXG4gIH1cblxuICByZXR1cm4gZnJvbUNoYXJDb2RlKHVpbnQ4QXJyYXkpXG59XG5cbmZ1bmN0aW9uIGlzRW1wdHkgKHVpbnQ4QXJyYXkpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB1aW50OEFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHVpbnQ4QXJyYXlbaV0gIT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZVxufVxuXG5jbGFzcyBQYXJzZXJJbnN0YW5jZSB7XG4gIGNvbnN0cnVjdG9yIChpbnB1dCwgb3B0aW9ucykge1xuICAgIHRoaXMucmVtYWluZGVyID0gbmV3IFVpbnQ4QXJyYXkoaW5wdXQgfHwgMClcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gICAgdGhpcy5wb3MgPSAwXG4gIH1cbiAgZ2V0VGFnICgpIHtcbiAgICBpZiAoIXRoaXMudGFnKSB7XG4gICAgICBjb25zdCBzeW50YXhDaGVja2VyID0gKGNocikgPT4gSVNfVEFHKGNocikgfHwgY2hyID09PSBBU0NJSV9BU1RFUklTSyB8fCBjaHIgPT09IEFTQ0lJX1BMVVNcbiAgICAgIHRoaXMudGFnID0gdGhpcy5nZXRFbGVtZW50KHN5bnRheENoZWNrZXIpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLnRhZ1xuICB9XG5cbiAgZ2V0Q29tbWFuZCAoKSB7XG4gICAgaWYgKCF0aGlzLmNvbW1hbmQpIHtcbiAgICAgIHRoaXMuY29tbWFuZCA9IHRoaXMuZ2V0RWxlbWVudChJU19DT01NQU5EKVxuICAgIH1cblxuICAgIHN3aXRjaCAoKHRoaXMuY29tbWFuZCB8fCAnJykudG9TdHJpbmcoKS50b1VwcGVyQ2FzZSgpKSB7XG4gICAgICBjYXNlICdPSyc6XG4gICAgICBjYXNlICdOTyc6XG4gICAgICBjYXNlICdCQUQnOlxuICAgICAgY2FzZSAnUFJFQVVUSCc6XG4gICAgICBjYXNlICdCWUUnOlxuICAgICAgICBsZXQgbGFzdFJpZ2h0QnJhY2tldCA9IHRoaXMucmVtYWluZGVyLmxhc3RJbmRleE9mKEFTQ0lJX1JJR0hUX0JSQUNLRVQpXG4gICAgICAgIGlmICh0aGlzLnJlbWFpbmRlclsxXSA9PT0gQVNDSUlfTEVGVF9CUkFDS0VUICYmIGxhc3RSaWdodEJyYWNrZXQgPiAxKSB7XG4gICAgICAgICAgdGhpcy5odW1hblJlYWRhYmxlID0gZnJvbUNoYXJDb2RlVHJpbW1lZCh0aGlzLnJlbWFpbmRlci5zdWJhcnJheShsYXN0UmlnaHRCcmFja2V0ICsgMSkpXG4gICAgICAgICAgdGhpcy5yZW1haW5kZXIgPSB0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgwLCBsYXN0UmlnaHRCcmFja2V0ICsgMSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLmh1bWFuUmVhZGFibGUgPSBmcm9tQ2hhckNvZGVUcmltbWVkKHRoaXMucmVtYWluZGVyKVxuICAgICAgICAgIHRoaXMucmVtYWluZGVyID0gbmV3IFVpbnQ4QXJyYXkoMClcbiAgICAgICAgfVxuICAgICAgICBicmVha1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmNvbW1hbmRcbiAgfVxuXG4gIGdldEVsZW1lbnQgKHN5bnRheENoZWNrZXIpIHtcbiAgICBsZXQgZWxlbWVudFxuICAgIGlmICh0aGlzLnJlbWFpbmRlclswXSA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICBsZXQgZmlyc3RTcGFjZSA9IHRoaXMucmVtYWluZGVyLmluZGV4T2YoQVNDSUlfU1BBQ0UpXG4gICAgaWYgKHRoaXMucmVtYWluZGVyLmxlbmd0aCA+IDAgJiYgZmlyc3RTcGFjZSAhPT0gMCkge1xuICAgICAgaWYgKGZpcnN0U3BhY2UgPT09IC0xKSB7XG4gICAgICAgIGVsZW1lbnQgPSB0aGlzLnJlbWFpbmRlclxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWxlbWVudCA9IHRoaXMucmVtYWluZGVyLnN1YmFycmF5KDAsIGZpcnN0U3BhY2UpXG4gICAgICB9XG5cbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZWxlbWVudC5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoIXN5bnRheENoZWNrZXIoZWxlbWVudFtpXSkpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgdGhpcy5wb3MgKz0gZWxlbWVudC5sZW5ndGhcbiAgICB0aGlzLnJlbWFpbmRlciA9IHRoaXMucmVtYWluZGVyLnN1YmFycmF5KGVsZW1lbnQubGVuZ3RoKVxuXG4gICAgcmV0dXJuIGZyb21DaGFyQ29kZShlbGVtZW50KVxuICB9XG5cbiAgZ2V0U3BhY2UgKCkge1xuICAgIGlmICghdGhpcy5yZW1haW5kZXIubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICBpZiAodGhpcy5yZW1haW5kZXJbMF0gIT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgdGhpcy5wb3MrK1xuICAgIHRoaXMucmVtYWluZGVyID0gdGhpcy5yZW1haW5kZXIuc3ViYXJyYXkoMSlcbiAgfVxuXG4gIGdldEF0dHJpYnV0ZXMgKCkge1xuICAgIGlmICghdGhpcy5yZW1haW5kZXIubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICB9XG5cbiAgICBpZiAodGhpcy5yZW1haW5kZXJbMF0gPT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgd2hpdGVzcGFjZSBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBUb2tlblBhcnNlcih0aGlzLCB0aGlzLnBvcywgdGhpcy5yZW1haW5kZXIuc3ViYXJyYXkoKSwgdGhpcy5vcHRpb25zKS5nZXRBdHRyaWJ1dGVzKClcbiAgfVxufVxuXG5jbGFzcyBOb2RlIHtcbiAgY29uc3RydWN0b3IgKHVpbnQ4QXJyYXksIHBhcmVudE5vZGUsIHN0YXJ0UG9zKSB7XG4gICAgdGhpcy51aW50OEFycmF5ID0gdWludDhBcnJheVxuICAgIHRoaXMuY2hpbGROb2RlcyA9IFtdXG4gICAgdGhpcy50eXBlID0gZmFsc2VcbiAgICB0aGlzLmNsb3NlZCA9IHRydWVcbiAgICB0aGlzLnZhbHVlU2tpcCA9IFtdXG4gICAgdGhpcy5zdGFydFBvcyA9IHN0YXJ0UG9zXG4gICAgdGhpcy52YWx1ZVN0YXJ0ID0gdGhpcy52YWx1ZUVuZCA9IHR5cGVvZiBzdGFydFBvcyA9PT0gJ251bWJlcicgPyBzdGFydFBvcyArIDEgOiAwXG5cbiAgICBpZiAocGFyZW50Tm9kZSkge1xuICAgICAgdGhpcy5wYXJlbnROb2RlID0gcGFyZW50Tm9kZVxuICAgICAgcGFyZW50Tm9kZS5jaGlsZE5vZGVzLnB1c2godGhpcylcbiAgICB9XG4gIH1cblxuICBnZXRWYWx1ZSAoKSB7XG4gICAgbGV0IHZhbHVlID0gZnJvbUNoYXJDb2RlKHRoaXMuZ2V0VmFsdWVBcnJheSgpKVxuICAgIHJldHVybiB0aGlzLnZhbHVlVG9VcHBlckNhc2UgPyB2YWx1ZS50b1VwcGVyQ2FzZSgpIDogdmFsdWVcbiAgfVxuXG4gIGdldFZhbHVlTGVuZ3RoICgpIHtcbiAgICByZXR1cm4gdGhpcy52YWx1ZUVuZCAtIHRoaXMudmFsdWVTdGFydCAtIHRoaXMudmFsdWVTa2lwLmxlbmd0aFxuICB9XG5cbiAgZ2V0VmFsdWVBcnJheSAoKSB7XG4gICAgY29uc3QgdmFsdWVBcnJheSA9IHRoaXMudWludDhBcnJheS5zdWJhcnJheSh0aGlzLnZhbHVlU3RhcnQsIHRoaXMudmFsdWVFbmQpXG5cbiAgICBpZiAodGhpcy52YWx1ZVNraXAubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gdmFsdWVBcnJheVxuICAgIH1cblxuICAgIGxldCBmaWx0ZXJlZEFycmF5ID0gbmV3IFVpbnQ4QXJyYXkodmFsdWVBcnJheS5sZW5ndGggLSB0aGlzLnZhbHVlU2tpcC5sZW5ndGgpXG4gICAgbGV0IGJlZ2luID0gMFxuICAgIGxldCBvZmZzZXQgPSAwXG4gICAgbGV0IHNraXAgPSB0aGlzLnZhbHVlU2tpcC5zbGljZSgpXG5cbiAgICBza2lwLnB1c2godmFsdWVBcnJheS5sZW5ndGgpXG5cbiAgICBza2lwLmZvckVhY2goZnVuY3Rpb24gKGVuZCkge1xuICAgICAgaWYgKGVuZCA+IGJlZ2luKSB7XG4gICAgICAgIHZhciBzdWJBcnJheSA9IHZhbHVlQXJyYXkuc3ViYXJyYXkoYmVnaW4sIGVuZClcbiAgICAgICAgZmlsdGVyZWRBcnJheS5zZXQoc3ViQXJyYXksIG9mZnNldClcbiAgICAgICAgb2Zmc2V0ICs9IHN1YkFycmF5Lmxlbmd0aFxuICAgICAgfVxuICAgICAgYmVnaW4gPSBlbmQgKyAxXG4gICAgfSlcblxuICAgIHJldHVybiBmaWx0ZXJlZEFycmF5XG4gIH1cblxuICBlcXVhbHMgKHZhbHVlLCBjYXNlU2Vuc2l0aXZlKSB7XG4gICAgaWYgKHRoaXMuZ2V0VmFsdWVMZW5ndGgoKSAhPT0gdmFsdWUubGVuZ3RoKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5lcXVhbHNBdCh2YWx1ZSwgMCwgY2FzZVNlbnNpdGl2ZSlcbiAgfVxuXG4gIGVxdWFsc0F0ICh2YWx1ZSwgaW5kZXgsIGNhc2VTZW5zaXRpdmUpIHtcbiAgICBjYXNlU2Vuc2l0aXZlID0gdHlwZW9mIGNhc2VTZW5zaXRpdmUgPT09ICdib29sZWFuJyA/IGNhc2VTZW5zaXRpdmUgOiB0cnVlXG5cbiAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICBpbmRleCA9IHRoaXMudmFsdWVFbmQgKyBpbmRleFxuXG4gICAgICB3aGlsZSAodGhpcy52YWx1ZVNraXAuaW5kZXhPZih0aGlzLnZhbHVlU3RhcnQgKyBpbmRleCkgPj0gMCkge1xuICAgICAgICBpbmRleC0tXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGluZGV4ID0gdGhpcy52YWx1ZVN0YXJ0ICsgaW5kZXhcbiAgICB9XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHZhbHVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICB3aGlsZSAodGhpcy52YWx1ZVNraXAuaW5kZXhPZihpbmRleCAtIHRoaXMudmFsdWVTdGFydCkgPj0gMCkge1xuICAgICAgICBpbmRleCsrXG4gICAgICB9XG5cbiAgICAgIGlmIChpbmRleCA+PSB0aGlzLnZhbHVlRW5kKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuXG4gICAgICBsZXQgdWludDhDaGFyID0gU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnVpbnQ4QXJyYXlbaW5kZXhdKVxuICAgICAgbGV0IGNoYXIgPSB2YWx1ZVtpXVxuXG4gICAgICBpZiAoIWNhc2VTZW5zaXRpdmUpIHtcbiAgICAgICAgdWludDhDaGFyID0gdWludDhDaGFyLnRvVXBwZXJDYXNlKClcbiAgICAgICAgY2hhciA9IGNoYXIudG9VcHBlckNhc2UoKVxuICAgICAgfVxuXG4gICAgICBpZiAodWludDhDaGFyICE9PSBjaGFyKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgICAgfVxuXG4gICAgICBpbmRleCsrXG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuXG4gIGlzTnVtYmVyICgpIHtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMudmFsdWVFbmQgLSB0aGlzLnZhbHVlU3RhcnQ7IGkrKykge1xuICAgICAgaWYgKHRoaXMudmFsdWVTa2lwLmluZGV4T2YoaSkgPj0gMCkge1xuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMuaXNEaWdpdChpKSkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZVxuICB9XG5cbiAgaXNEaWdpdCAoaW5kZXgpIHtcbiAgICBpZiAoaW5kZXggPCAwKSB7XG4gICAgICBpbmRleCA9IHRoaXMudmFsdWVFbmQgKyBpbmRleFxuXG4gICAgICB3aGlsZSAodGhpcy52YWx1ZVNraXAuaW5kZXhPZih0aGlzLnZhbHVlU3RhcnQgKyBpbmRleCkgPj0gMCkge1xuICAgICAgICBpbmRleC0tXG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGluZGV4ID0gdGhpcy52YWx1ZVN0YXJ0ICsgaW5kZXhcblxuICAgICAgd2hpbGUgKHRoaXMudmFsdWVTa2lwLmluZGV4T2YodGhpcy52YWx1ZVN0YXJ0ICsgaW5kZXgpID49IDApIHtcbiAgICAgICAgaW5kZXgrK1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBJU19ESUdJVCh0aGlzLnVpbnQ4QXJyYXlbaW5kZXhdKVxuICB9XG5cbiAgY29udGFpbnNDaGFyIChjaGFyKSB7XG4gICAgbGV0IGFzY2lpID0gY2hhci5jaGFyQ29kZUF0KDApXG5cbiAgICBmb3IgKGxldCBpID0gdGhpcy52YWx1ZVN0YXJ0OyBpIDwgdGhpcy52YWx1ZUVuZDsgaSsrKSB7XG4gICAgICBpZiAodGhpcy52YWx1ZVNraXAuaW5kZXhPZihpIC0gdGhpcy52YWx1ZVN0YXJ0KSA+PSAwKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLnVpbnQ4QXJyYXlbaV0gPT09IGFzY2lpKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cbn1cblxuY2xhc3MgVG9rZW5QYXJzZXIge1xuICBjb25zdHJ1Y3RvciAocGFyZW50LCBzdGFydFBvcywgdWludDhBcnJheSwgb3B0aW9ucyA9IHt9KSB7XG4gICAgdGhpcy51aW50OEFycmF5ID0gdWludDhBcnJheVxuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnNcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudFxuXG4gICAgdGhpcy50cmVlID0gdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSgpXG4gICAgdGhpcy5wb3MgPSBzdGFydFBvcyB8fCAwXG5cbiAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnVFJFRSdcblxuICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy52YWx1ZUFzU3RyaW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMub3B0aW9ucy52YWx1ZUFzU3RyaW5nID0gdHJ1ZVxuICAgIH1cblxuICAgIHRoaXMucHJvY2Vzc1N0cmluZygpXG4gIH1cblxuICBnZXRBdHRyaWJ1dGVzICgpIHtcbiAgICBsZXQgYXR0cmlidXRlcyA9IFtdXG4gICAgbGV0IGJyYW5jaCA9IGF0dHJpYnV0ZXNcblxuICAgIGxldCB3YWxrID0gbm9kZSA9PiB7XG4gICAgICBsZXQgZWxtXG4gICAgICBsZXQgY3VyQnJhbmNoID0gYnJhbmNoXG4gICAgICBsZXQgcGFydGlhbFxuXG4gICAgICBpZiAoIW5vZGUuY2xvc2VkICYmIG5vZGUudHlwZSA9PT0gJ1NFUVVFTkNFJyAmJiBub2RlLmVxdWFscygnKicpKSB7XG4gICAgICAgIG5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICBub2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgIH1cblxuICAgICAgLy8gSWYgdGhlIG5vZGUgd2FzIG5ldmVyIGNsb3NlZCwgdGhyb3cgaXRcbiAgICAgIGlmICghbm9kZS5jbG9zZWQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgdGhpcy51aW50OEFycmF5Lmxlbmd0aCAtIDEpKVxuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpKSB7XG4gICAgICAgIGNhc2UgJ0xJVEVSQUwnOlxuICAgICAgICBjYXNlICdTVFJJTkcnOlxuICAgICAgICAgIGVsbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgdmFsdWU6IHRoaXMub3B0aW9ucy52YWx1ZUFzU3RyaW5nID8gbm9kZS5nZXRWYWx1ZSgpIDogbm9kZS5nZXRWYWx1ZUFycmF5KClcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJhbmNoLnB1c2goZWxtKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ1NFUVVFTkNFJzpcbiAgICAgICAgICBlbG0gPSB7XG4gICAgICAgICAgICB0eXBlOiBub2RlLnR5cGUudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICAgIHZhbHVlOiBub2RlLmdldFZhbHVlKClcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJhbmNoLnB1c2goZWxtKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ0FUT00nOlxuICAgICAgICAgIGlmIChub2RlLmVxdWFscygnTklMJywgdHJ1ZSkpIHtcbiAgICAgICAgICAgIGJyYW5jaC5wdXNoKG51bGwpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbG0gPSB7XG4gICAgICAgICAgICB0eXBlOiBub2RlLnR5cGUudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICAgIHZhbHVlOiBub2RlLmdldFZhbHVlKClcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJhbmNoLnB1c2goZWxtKVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgJ1NFQ1RJT04nOlxuICAgICAgICAgIGJyYW5jaCA9IGJyYW5jaFticmFuY2gubGVuZ3RoIC0gMV0uc2VjdGlvbiA9IFtdXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnTElTVCc6XG4gICAgICAgICAgZWxtID0gW11cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJhbmNoID0gZWxtXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnUEFSVElBTCc6XG4gICAgICAgICAgcGFydGlhbCA9IG5vZGUuZ2V0VmFsdWUoKS5zcGxpdCgnLicpLm1hcChOdW1iZXIpXG4gICAgICAgICAgYnJhbmNoW2JyYW5jaC5sZW5ndGggLSAxXS5wYXJ0aWFsID0gcGFydGlhbFxuICAgICAgICAgIGJyZWFrXG4gICAgICB9XG5cbiAgICAgIG5vZGUuY2hpbGROb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChjaGlsZE5vZGUpIHtcbiAgICAgICAgd2FsayhjaGlsZE5vZGUpXG4gICAgICB9KVxuICAgICAgYnJhbmNoID0gY3VyQnJhbmNoXG4gICAgfVxuXG4gICAgd2Fsayh0aGlzLnRyZWUpXG5cbiAgICByZXR1cm4gYXR0cmlidXRlc1xuICB9XG5cbiAgY3JlYXRlTm9kZSAocGFyZW50Tm9kZSwgc3RhcnRQb3MpIHtcbiAgICByZXR1cm4gbmV3IE5vZGUodGhpcy51aW50OEFycmF5LCBwYXJlbnROb2RlLCBzdGFydFBvcylcbiAgfVxuXG4gIHByb2Nlc3NTdHJpbmcgKCkge1xuICAgIGxldCBpXG4gICAgbGV0IGxlblxuICAgIGNvbnN0IGNoZWNrU1AgPSAocG9zKSA9PiB7XG4gICAgICAvLyBqdW1wIHRvIHRoZSBuZXh0IG5vbiB3aGl0ZXNwYWNlIHBvc1xuICAgICAgd2hpbGUgKHRoaXMudWludDhBcnJheVtpICsgMV0gPT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICAgIGkrK1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoaSA9IDAsIGxlbiA9IHRoaXMudWludDhBcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgbGV0IGNociA9IHRoaXMudWludDhBcnJheVtpXVxuXG4gICAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgICAgY2FzZSAnTk9STUFMJzpcblxuICAgICAgICAgIHN3aXRjaCAoY2hyKSB7XG4gICAgICAgICAgICAvLyBEUVVPVEUgc3RhcnRzIGEgbmV3IHN0cmluZ1xuICAgICAgICAgICAgY2FzZSBBU0NJSV9EUVVPVEU6XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ3N0cmluZydcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdTVFJJTkcnXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gKCBzdGFydHMgYSBuZXcgbGlzdFxuICAgICAgICAgICAgY2FzZSBBU0NJSV9MRUZUX1BBUkVOVEhFU0lTOlxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdMSVNUJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vICkgY2xvc2VzIGEgbGlzdFxuICAgICAgICAgICAgY2FzZSBBU0NJSV9SSUdIVF9QQVJFTlRIRVNJUzpcbiAgICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUudHlwZSAhPT0gJ0xJU1QnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGxpc3QgdGVybWluYXRvciApIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG5cbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vIF0gY2xvc2VzIHNlY3Rpb24gZ3JvdXBcbiAgICAgICAgICAgIGNhc2UgQVNDSUlfUklHSFRfQlJBQ0tFVDpcbiAgICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUudHlwZSAhPT0gJ1NFQ1RJT04nKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHNlY3Rpb24gdGVybWluYXRvciBdIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gPCBzdGFydHMgYSBuZXcgcGFydGlhbFxuICAgICAgICAgICAgY2FzZSBBU0NJSV9MRVNTX1RIQU5fU0lHTjpcbiAgICAgICAgICAgICAgaWYgKHRoaXMudWludDhBcnJheVtpIC0gMV0gIT09IEFTQ0lJX1JJR0hUX0JSQUNLRVQpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaVxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1BBUlRJQUwnXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdQQVJUSUFMJ1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyB7IHN0YXJ0cyBhIG5ldyBsaXRlcmFsXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX0xFRlRfQ1VSTFlfQlJBQ0tFVDpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnTElURVJBTCdcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdMSVRFUkFMJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vICggc3RhcnRzIGEgbmV3IHNlcXVlbmNlXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX0FTVEVSSVNLOlxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdTRVFVRU5DRSdcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1NFUVVFTkNFJ1xuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyBub3JtYWxseSBhIHNwYWNlIHNob3VsZCBuZXZlciBvY2N1clxuICAgICAgICAgICAgY2FzZSBBU0NJSV9TUEFDRTpcbiAgICAgICAgICAgICAgLy8ganVzdCBpZ25vcmVcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gc3RhcnQgb2YgYSBsaXRlcmFsOCwgaGFuZGxlIGluIGNhc2UgQVNDSUlfTEVGVF9DVVJMWV9CUkFDS0VUXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX1RJTERFOlxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyBbIHN0YXJ0cyBzZWN0aW9uXG4gICAgICAgICAgICBjYXNlIEFTQ0lJX0xFRlRfQlJBQ0tFVDpcbiAgICAgICAgICAgICAgLy8gSWYgaXQgaXMgdGhlICpmaXJzdCogZWxlbWVudCBhZnRlciByZXNwb25zZSBjb21tYW5kLCB0aGVuIHByb2Nlc3MgYXMgYSByZXNwb25zZSBhcmd1bWVudCBsaXN0XG4gICAgICAgICAgICAgIGlmIChbJ09LJywgJ05PJywgJ0JBRCcsICdCWUUnLCAnUFJFQVVUSCddLmluZGV4T2YodGhpcy5wYXJlbnQuY29tbWFuZC50b1VwcGVyQ2FzZSgpKSA+PSAwICYmIHRoaXMuY3VycmVudE5vZGUgPT09IHRoaXMudHJlZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFQ1RJT04nXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuXG4gICAgICAgICAgICAgICAgLy8gUkZDMjIyMSBkZWZpbmVzIGEgcmVzcG9uc2UgY29kZSBSRUZFUlJBTCB3aG9zZSBwYXlsb2FkIGlzIGFuXG4gICAgICAgICAgICAgICAgLy8gUkZDMjE5Mi9SRkM1MDkyIGltYXB1cmwgdGhhdCB3ZSB3aWxsIHRyeSB0byBwYXJzZSBhcyBhbiBBVE9NIGJ1dFxuICAgICAgICAgICAgICAgIC8vIGZhaWwgcXVpdGUgYmFkbHkgYXQgcGFyc2luZy4gIFNpbmNlIHRoZSBpbWFwdXJsIGlzIHN1Y2ggYSB1bmlxdWVcbiAgICAgICAgICAgICAgICAvLyAoYW5kIGNyYXp5KSB0ZXJtLCB3ZSBqdXN0IHNwZWNpYWxpemUgdGhhdCBjYXNlIGhlcmUuXG4gICAgICAgICAgICAgICAgaWYgKGZyb21DaGFyQ29kZSh0aGlzLnVpbnQ4QXJyYXkuc3ViYXJyYXkoaSArIDEsIGkgKyAxMCkpLnRvVXBwZXJDYXNlKCkgPT09ICdSRUZFUlJBTCAnKSB7XG4gICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdGhlIFJFRkVSUkFMIGF0b21cbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgdGhpcy5wb3MgKyBpICsgMSlcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGkgKyA4XG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpICsgMVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyA5XG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlVG9VcHBlckNhc2UgPSB0cnVlXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG5cbiAgICAgICAgICAgICAgICAgIC8vIGVhdCBhbGwgdGhlIHdheSB0aHJvdWdoIHRoZSBdIHRvIGJlIHRoZSAgSU1BUFVSTCB0b2tlbi5cbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgdGhpcy5wb3MgKyBpICsgMTApXG4gICAgICAgICAgICAgICAgICAvLyBqdXN0IGNhbGwgdGhpcyBhbiBBVE9NLCBldmVuIHRob3VnaCBJTUFQVVJMIG1pZ2h0IGJlIG1vcmUgY29ycmVjdFxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgICAgICAvLyBqdW1wIGkgdG8gdGhlICddJ1xuICAgICAgICAgICAgICAgICAgaSA9IHRoaXMudWludDhBcnJheS5pbmRleE9mKEFTQ0lJX1JJR0hUX0JSQUNLRVQsIGkgKyAxMClcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gdGhpcy5jdXJyZW50Tm9kZS5zdGFydFBvcyAtIHRoaXMucG9zXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgLSB0aGlzLnBvcyArIDFcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgICAgICAgLy8gY2xvc2Ugb3V0IHRoZSBTRUNUSU9OXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIC8vIEFueSBBVE9NIHN1cHBvcnRlZCBjaGFyIHN0YXJ0cyBhIG5ldyBBdG9tIHNlcXVlbmNlLCBvdGhlcndpc2UgdGhyb3cgYW4gZXJyb3JcbiAgICAgICAgICAgICAgLy8gQWxsb3cgXFwgYXMgdGhlIGZpcnN0IGNoYXIgZm9yIGF0b20gdG8gc3VwcG9ydCBzeXN0ZW0gZmxhZ3NcbiAgICAgICAgICAgICAgLy8gQWxsb3cgJSB0byBzdXBwb3J0IExJU1QgJycgJVxuICAgICAgICAgICAgICBpZiAoIUlTX0FUT01fQ0hBUihjaHIpICYmIGNociAhPT0gQVNDSUlfQkFDS1NMQVNIICYmIGNociAhPT0gQVNDSUlfUEVSQ0VOVF9TSUdOKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIGNhc2UgJ0FUT00nOlxuXG4gICAgICAgICAgLy8gc3BhY2UgZmluaXNoZXMgYW4gYXRvbVxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvL1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZSAmJlxuICAgICAgICAgICAgKFxuICAgICAgICAgICAgICAoY2hyID09PSBBU0NJSV9SSUdIVF9QQVJFTlRIRVNJUyAmJiB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGUudHlwZSA9PT0gJ0xJU1QnKSB8fFxuICAgICAgICAgICAgICAoY2hyID09PSBBU0NJSV9SSUdIVF9CUkFDS0VUICYmIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnU0VDVElPTicpXG4gICAgICAgICAgICApXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoKGNociA9PT0gQVNDSUlfQ09NTUEgfHwgY2hyID09PSBBU0NJSV9DT0xPTikgJiYgdGhpcy5jdXJyZW50Tm9kZS5pc051bWJlcigpKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gWyBzdGFydHMgYSBzZWN0aW9uIGdyb3VwIGZvciB0aGlzIGVsZW1lbnRcbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9MRUZUX0JSQUNLRVQgJiYgKHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCdCT0RZJywgZmFsc2UpIHx8IHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCdCT0RZLlBFRUsnLCBmYWxzZSkpKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGUsIHRoaXMucG9zICsgaSlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdTRUNUSU9OJ1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX0xFU1NfVEhBTl9TSUdOKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc3RhcnQgb2YgcGFydGlhbCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gaWYgdGhlIGNoYXIgaXMgbm90IEFUT00gY29tcGF0aWJsZSwgdGhyb3cuIEFsbG93IFxcKiBhcyBhbiBleGNlcHRpb25cbiAgICAgICAgICBpZiAoIUlTX0FUT01fQ0hBUihjaHIpICYmIGNociAhPT0gQVNDSUlfUklHSFRfQlJBQ0tFVCAmJiAhKGNociA9PT0gQVNDSUlfQVNURVJJU0sgJiYgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHMoJ1xcXFwnKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCdcXFxcKicpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBjYXNlICdTVFJJTkcnOlxuXG4gICAgICAgICAgLy8gRFFVT1RFIGVuZHMgdGhlIHN0cmluZyBzZXF1ZW5jZVxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX0RRVU9URSkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBcXCBFc2NhcGVzIHRoZSBmb2xsb3dpbmcgY2hhclxuICAgICAgICAgIGlmIChjaHIgPT09IEFTQ0lJX0JBQ0tTTEFTSCkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVNraXAucHVzaChpIC0gdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0KVxuICAgICAgICAgICAgaSsrXG4gICAgICAgICAgICBpZiAoaSA+PSBsZW4pIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjaHIgPSB0aGlzLnVpbnQ4QXJyYXlbaV1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvKiAvLyBza2lwIHRoaXMgY2hlY2ssIG90aGVyd2lzZSB0aGUgcGFyc2VyIG1pZ2h0IGV4cGxvZGUgb24gYmluYXJ5IGlucHV0XG4gICAgICAgICAgaWYgKFRFWFRfQ0hBUigpLmluZGV4T2YoY2hyKSA8IDApIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgKi9cblxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnUEFSVElBTCc6XG4gICAgICAgICAgaWYgKGNociA9PT0gQVNDSUlfR1JFQVRFUl9USEFOX1NJR04pIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcuJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgcGFydGlhbCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9GVUxMX1NUT1AgJiYgKCF0aGlzLmN1cnJlbnROb2RlLmdldFZhbHVlTGVuZ3RoKCkgfHwgdGhpcy5jdXJyZW50Tm9kZS5jb250YWluc0NoYXIoJy4nKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBwYXJ0aWFsIHNlcGFyYXRvciAuIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIUlTX0RJR0lUKGNocikgJiYgY2hyICE9PSBBU0NJSV9GVUxMX1NUT1ApIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyICE9PSBBU0NJSV9GVUxMX1NUT1AgJiYgKHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCcwJykgfHwgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnLjAnLCAtMikpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcGFydGlhbCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBjYXNlICdMSVRFUkFMJzpcbiAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5zdGFydGVkKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gaSArIDFcblxuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUuZ2V0VmFsdWVMZW5ndGgoKSA+PSB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGgpIHtcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9QTFVTKSB7XG4gICAgICAgICAgICAvLyBhc3N1bWluZyBjYXBhYmlsaXR5IExJVEVSQUwrIG9yIExJVEVSQUwtXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxQbHVzID0gdHJ1ZVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9SSUdIVF9DVVJMWV9CUkFDS0VUKSB7XG4gICAgICAgICAgICBpZiAoISgnbGl0ZXJhbExlbmd0aCcgaW4gdGhpcy5jdXJyZW50Tm9kZSkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGxpdGVyYWwgcHJlZml4IGVuZCBjaGFyIH0gYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMudWludDhBcnJheVtpICsgMV0gPT09IEFTQ0lJX05MKSB7XG4gICAgICAgICAgICAgIGkrK1xuICAgICAgICAgICAgfSBlbHNlIGlmICh0aGlzLnVpbnQ4QXJyYXlbaSArIDFdID09PSBBU0NJSV9DUiAmJiB0aGlzLnVpbnQ4QXJyYXlbaSArIDJdID09PSBBU0NJSV9OTCkge1xuICAgICAgICAgICAgICBpICs9IDJcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IGkgKyAxXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPSBOdW1iZXIodGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoKVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5zdGFydGVkID0gdHJ1ZVxuXG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCkge1xuICAgICAgICAgICAgICAvLyBzcGVjaWFsIGNhc2Ugd2hlcmUgbGl0ZXJhbCBjb250ZW50IGxlbmd0aCBpcyAwXG4gICAgICAgICAgICAgIC8vIGNsb3NlIHRoZSBub2RlIHJpZ2h0IGF3YXksIGRvIG5vdCB3YWl0IGZvciBhZGRpdGlvbmFsIGlucHV0XG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gdHJ1ZVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghSVNfRElHSVQoY2hyKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoID09PSAnMCcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsaXRlcmFsIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoID0gKHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCB8fCAnJykgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKGNocilcbiAgICAgICAgICBicmVha1xuXG4gICAgICAgIGNhc2UgJ1NFUVVFTkNFJzpcbiAgICAgICAgICAvLyBzcGFjZSBmaW5pc2hlcyB0aGUgc2VxdWVuY2Ugc2V0XG4gICAgICAgICAgaWYgKGNociA9PT0gQVNDSUlfU1BBQ0UpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Tm9kZS5pc0RpZ2l0KC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgd2hpdGVzcGFjZSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCc6JywgLTIpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZSAmJlxuICAgICAgICAgICAgY2hyID09PSBBU0NJSV9SSUdIVF9CUkFDS0VUICYmXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGUudHlwZSA9PT0gJ1NFQ1RJT04nKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSBBU0NJSV9DT0xPTikge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByYW5nZSBzZXBhcmF0b3IgOiBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09IEFTQ0lJX0FTVEVSSVNLKSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJywnLCAtMSkgJiYgIXRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJzonLCAtMSkpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHJhbmdlIHdpbGRjYXJkIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKGNociA9PT0gQVNDSUlfQ09NTUEpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Tm9kZS5pc0RpZ2l0KC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc2VxdWVuY2Ugc2VwYXJhdG9yICwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJyonLCAtMSkgJiYgIXRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJzonLCAtMikpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHNlcXVlbmNlIHNlcGFyYXRvciAsIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKCFJU19ESUdJVChjaHIpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKElTX0RJR0lUKGNocikgJiYgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIG51bWJlciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGJ1ZmZlcnMsIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgcGFyc2VyID0gbmV3IFBhcnNlckluc3RhbmNlKGJ1ZmZlcnMsIG9wdGlvbnMpXG4gIGxldCByZXNwb25zZSA9IHt9XG5cbiAgcmVzcG9uc2UudGFnID0gcGFyc2VyLmdldFRhZygpXG4gIHBhcnNlci5nZXRTcGFjZSgpXG4gIHJlc3BvbnNlLmNvbW1hbmQgPSBwYXJzZXIuZ2V0Q29tbWFuZCgpXG5cbiAgaWYgKFsnVUlEJywgJ0FVVEhFTlRJQ0FURSddLmluZGV4T2YoKHJlc3BvbnNlLmNvbW1hbmQgfHwgJycpLnRvVXBwZXJDYXNlKCkpID49IDApIHtcbiAgICBwYXJzZXIuZ2V0U3BhY2UoKVxuICAgIHJlc3BvbnNlLmNvbW1hbmQgKz0gJyAnICsgcGFyc2VyLmdldEVsZW1lbnQoSVNfQ09NTUFORClcbiAgfVxuXG4gIGlmICghaXNFbXB0eShwYXJzZXIucmVtYWluZGVyKSkge1xuICAgIHBhcnNlci5nZXRTcGFjZSgpXG4gICAgcmVzcG9uc2UuYXR0cmlidXRlcyA9IHBhcnNlci5nZXRBdHRyaWJ1dGVzKClcbiAgfVxuXG4gIGlmIChwYXJzZXIuaHVtYW5SZWFkYWJsZSkge1xuICAgIHJlc3BvbnNlLmF0dHJpYnV0ZXMgPSAocmVzcG9uc2UuYXR0cmlidXRlcyB8fCBbXSkuY29uY2F0KHtcbiAgICAgIHR5cGU6ICdURVhUJyxcbiAgICAgIHZhbHVlOiBwYXJzZXIuaHVtYW5SZWFkYWJsZVxuICAgIH0pXG4gIH1cblxuICByZXR1cm4gcmVzcG9uc2Vcbn1cbiJdfQ==